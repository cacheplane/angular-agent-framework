// SPDX-License-Identifier: MIT
import type { A2uiSurface, A2uiActionMessage } from '@ngaf/a2ui';

function toDynamicValue(v: unknown): unknown {
  if (typeof v === 'string') return { literalString: v };
  if (typeof v === 'number') return { literalNumber: v };
  if (typeof v === 'boolean') return { literalBoolean: v };
  return { literalString: String(v) };
}

/** Builds an A2uiActionMessage from handler params and the current surface.
 *  The action.context is serialized as v1 DynamicValue-wrapped entries. */
export function buildA2uiActionMessage(
  params: Record<string, unknown>,
  surface: A2uiSurface,
): A2uiActionMessage {
  const rawContext = (params['context'] as Record<string, unknown>) ?? {};
  const wrappedContext: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rawContext)) {
    wrappedContext[k] = toDynamicValue(v);
  }

  const message: A2uiActionMessage = {
    version: 'v1',
    action: {
      name: params['name'] as string,
      surfaceId: surface.surfaceId,
      sourceComponentId: params['sourceComponentId'] as string,
      timestamp: new Date().toISOString(),
      context: wrappedContext,
    },
  };
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
