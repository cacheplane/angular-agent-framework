// SPDX-License-Identifier: MIT
/**
 * Synthesize a short human-readable label for a serialized A2UI action
 * message, so the chat composition can render "Search flights" instead
 * of a raw `{"version":"v1","action":...}` JSON dump as a user bubble.
 *
 * Per the A2UI v0.9 spec, action messages flow on the client → agent
 * return channel and are framed as typed events (closer to tool calls
 * than user utterances). The spec is silent on chat-bubble rendering;
 * Google's "A2UI in Practice" article and the Stream Chat reference
 * both warn against modeling actions as chat-history user turns.
 *
 * This helper returns null for any content that isn't a v1 A2UI action
 * message; callers should fall back to the original content in that case.
 *
 * Sources:
 *   - https://a2ui.org/specification/v0.9-a2ui/
 *   - https://medium.com/google-cloud/a2ui-in-practice-patterns-pitfalls-and-the-messages-that-hold-it-together-658720b83789
 *   - https://getstream.io/blog/a2ui-chat-integration/
 */

/** Known action names that have a curated label. The default for any
 *  other action name is a camelCase → "Camel Case" humanization. */
const KNOWN_LABELS: Record<string, (ctx: unknown) => string> = {
  bookingSubmit: () => 'Search flights',
  flightSelect: (ctx) => {
    const id = unwrapContextString(ctx, 'flightId') ?? unwrapContextString(ctx, 'flight_id');
    return id ? `Selected flight ${id}` : 'Selected flight';
  },
  modifySearch: () => 'Modify search',
};

export function a2uiActionLabel(content: string): string | null {
  if (typeof content !== 'string' || content.length === 0) return null;
  // Cheap pre-check to skip parsing non-JSON content (markdown, prose, etc).
  const trimmed = content.trimStart();
  if (!trimmed.startsWith('{')) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  if (parsed['version'] !== 'v1') return null;
  const action = parsed['action'];
  if (!isRecord(action)) return null;
  const name = action['name'];
  if (typeof name !== 'string' || name.length === 0) return null;

  const known = KNOWN_LABELS[name];
  if (known) return known(action['context']);
  return humanizeCamelCase(name);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

/** "bookingSubmit" → "Booking submit". "addToCart" → "Add to cart". */
function humanizeCamelCase(name: string): string {
  const spaced = name.replace(/([a-z])([A-Z])/g, '$1 $2');
  const lower = spaced.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/**
 * Extract a string-typed value from an A2UI context structure. The v1
 * wire shape carries each value as a DynamicValue (`{literalString: ...}`,
 * `{literalNumber: ...}`, `{path: ...}`); we want the literal string only.
 *
 * Context can be either:
 *  - a dict: `{ key1: {literalString: "..."}, key2: ... }` (compact form)
 *  - an array of entries: `[{key, value: {literalString: "..."}}, ...]`
 *    (the spec's canonical wire shape for A2uiActionContextEntry[])
 */
function unwrapContextString(context: unknown, key: string): string | null {
  if (Array.isArray(context)) {
    const entry = context.find(
      (e): e is { key: unknown; value: unknown } =>
        isRecord(e) && (e as Record<string, unknown>)['key'] === key,
    );
    if (!entry) return null;
    return readLiteralString(entry.value);
  }
  if (isRecord(context)) {
    return readLiteralString(context[key]);
  }
  return null;
}

function readLiteralString(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (isRecord(value) && typeof value['literalString'] === 'string') {
    return value['literalString'] as string;
  }
  return null;
}
