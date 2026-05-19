// SPDX-License-Identifier: MIT
import type { A2uiSurface, A2uiActionMessage } from '@ngaf/a2ui';

function toDynamicValue(v: unknown): unknown {
  if (typeof v === 'string') return { literalString: v };
  if (typeof v === 'number') return { literalNumber: v };
  if (typeof v === 'boolean') return { literalBoolean: v };
  return { literalString: String(v) };
}

/**
 * Derive a human-readable label for an outgoing action by walking from
 * the source component to its authored visible text. Today supported:
 * Button → child Text → literalString. Returns null for other component
 * types or when the linkage isn't well-formed; callers fall back to a
 * camelCase humanization of `action.name`.
 *
 * Why: the chat-lib used to ship a hardcoded `KNOWN_LABELS` map
 * (bookingSubmit → 'Search flights') that embedded app-specific
 * knowledge in the primitive. The LLM that authors a surface already
 * writes the Button's visible text — reuse it as the action label.
 * See spec 2026-05-19-llm-generated-labels-design.md.
 */
function deriveActionLabel(surface: A2uiSurface, sourceId: string): string | null {
  const source = surface.components.get(sourceId);
  if (!source) return null;
  const buttonProps = (source.component as { Button?: { child?: string } }).Button;
  if (!buttonProps?.child) return null;
  const labelText = surface.components.get(buttonProps.child);
  if (!labelText) return null;
  const textProps = (labelText.component as { Text?: { text?: { literalString?: string } } }).Text;
  const literal = textProps?.text?.literalString;
  return typeof literal === 'string' && literal.length > 0 ? literal : null;
}

/** Builds an A2uiActionMessage from handler params and the current surface.
 *  The action.context is serialized as v1 DynamicValue-wrapped entries.
 *  Sets action.label when the source component is a Button with a Text
 *  child whose literalString is non-empty. */
export function buildA2uiActionMessage(
  params: Record<string, unknown>,
  surface: A2uiSurface,
): A2uiActionMessage {
  const rawContext = (params['context'] as Record<string, unknown>) ?? {};
  const wrappedContext: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rawContext)) {
    wrappedContext[k] = toDynamicValue(v);
  }

  const sourceComponentId = params['sourceComponentId'] as string;

  const message: A2uiActionMessage = {
    version: 'v1',
    action: {
      name: params['name'] as string,
      surfaceId: surface.surfaceId,
      sourceComponentId,
      timestamp: new Date().toISOString(),
      context: wrappedContext,
    },
  };

  const label = deriveActionLabel(surface, sourceComponentId);
  if (label) message.action.label = label;

  if (surface.sendDataModel) {
    message.metadata = {
      a2uiClientDataModel: {
        version: 'v1',
        surfaces: { [surface.surfaceId]: surface.dataModel },
      },
    };
  }
  return message;
}
