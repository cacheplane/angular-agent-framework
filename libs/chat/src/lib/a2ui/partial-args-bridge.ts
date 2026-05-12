// libs/chat/src/lib/a2ui/partial-args-bridge.ts
// SPDX-License-Identifier: MIT
import { createPartialJsonParser, materialize } from '@cacheplane/partial-json';
import type { A2uiMessage, A2uiSurfaceUpdate } from '@ngaf/a2ui';
import type { A2uiSurfaceStore } from './surface-store';
import { normalizeEnvelopeArgs } from './envelope-normalizer';

export interface PartialArgsBridge {
  /**
   * Replace the cumulative argument-string buffer for `toolCallId` with
   * `argsSoFar` and re-extract any newly-complete envelopes. The args
   * string is expected to grow monotonically.
   */
  push(toolCallId: string, argsSoFar: string): void;
  /** True if a tool_call_id has been poisoned by malformed input. */
  isPoisoned(toolCallId: string): boolean;
}

interface BridgeState {
  parser: ReturnType<typeof createPartialJsonParser>;
  /** Number of envelopes already dispatched to the store. */
  dispatchedCount: number;
  /** Have we synthesised a beginRendering for this turn yet? */
  synthesised: boolean;
  /** surfaceId the synthesised beginRendering targets (to avoid double-mounting). */
  synthesisedSurfaceId: string | null;
  /** Once true, all subsequent pushes are ignored. */
  poisoned: boolean;
}

/**
 * Validate that `s` is a syntactically plausible JSON prefix. We can't
 * `JSON.parse` an incomplete string, so we run a lightweight scanner that
 * follows the grammar and tolerates only truncation at the right edge.
 * Returns false if any character violates JSON syntax mid-stream.
 *
 * The partial-json parser silently halts on bad input (setting an internal
 * error flag that is not exposed through its public API), so we use this
 * pre-check to detect poisoned streams.
 */
function isValidJsonPrefix(s: string): boolean {
  // Stack of expected closers: '}' for objects, ']' for arrays,
  // 'k' (object key expected), 'v' (value expected), ',' or ':'.
  // We model JSON with a small state machine. Returns true if the input
  // is consumable as a prefix of some valid JSON document.
  let i = 0;
  const len = s.length;
  // Outer state: 'value' (expecting any value), 'object-key' (after `{`
  // or `,`), 'after-key' (after a key string, expect `:`), 'after-value'
  // (after a value, expect `,` or matching close).
  type Frame = { container: 'object' | 'array' };
  const stack: Frame[] = [];
  let state: 'value' | 'object-key' | 'after-key' | 'after-value' = 'value';

  function skipWs(): void {
    while (i < len) {
      const c = s.charCodeAt(i);
      if (c === 0x20 || c === 0x09 || c === 0x0a || c === 0x0d) i++;
      else break;
    }
  }

  function scanString(): boolean {
    // Already at opening quote
    if (s[i] !== '"') return false;
    i++;
    while (i < len) {
      const c = s[i];
      if (c === '\\') {
        i++;
        if (i >= len) return true; // truncated escape
        i++;
        continue;
      }
      if (c === '"') { i++; return true; }
      i++;
    }
    // Truncated mid-string is OK for a prefix.
    return true;
  }

  function scanLiteral(lit: string): boolean {
    // Match as much of `lit` as remains in input. Truncation OK.
    let j = 0;
    while (i < len && j < lit.length) {
      if (s[i] !== lit[j]) return false;
      i++; j++;
    }
    return true;
  }

  function scanNumber(): boolean {
    // Lenient: consume digits, '.', 'e', 'E', '+', '-' starting from current
    if (s[i] === '-') i++;
    while (i < len) {
      const c = s[i];
      if ((c >= '0' && c <= '9') || c === '.' || c === 'e' || c === 'E' || c === '+' || c === '-') i++;
      else break;
    }
    return true;
  }

  while (i < len) {
    skipWs();
    if (i >= len) break;
    const c = s[i];

    if (state === 'value') {
      if (c === '{') {
        i++; stack.push({ container: 'object' }); state = 'object-key';
      } else if (c === '[') {
        i++; stack.push({ container: 'array' }); state = 'value';
      } else if (c === '"') {
        if (!scanString()) return false;
        state = 'after-value';
      } else if (c === 't') { if (!scanLiteral('true')) return false; state = 'after-value'; }
      else if (c === 'f') { if (!scanLiteral('false')) return false; state = 'after-value'; }
      else if (c === 'n') { if (!scanLiteral('null')) return false; state = 'after-value'; }
      else if (c === '-' || (c >= '0' && c <= '9')) { if (!scanNumber()) return false; state = 'after-value'; }
      else if (c === ']' && stack.length > 0 && stack[stack.length - 1].container === 'array') {
        // empty array close
        i++; stack.pop(); state = 'after-value';
      } else {
        return false;
      }
    } else if (state === 'object-key') {
      if (c === '"') {
        if (!scanString()) return false;
        state = 'after-key';
      } else if (c === '}' && stack.length > 0 && stack[stack.length - 1].container === 'object') {
        i++; stack.pop(); state = 'after-value';
      } else {
        return false;
      }
    } else if (state === 'after-key') {
      if (c === ':') { i++; state = 'value'; }
      else return false;
    } else if (state === 'after-value') {
      if (stack.length === 0) {
        // Trailing content after top-level value is invalid.
        return false;
      }
      const top = stack[stack.length - 1];
      if (c === ',') {
        i++;
        state = top.container === 'object' ? 'object-key' : 'value';
      } else if (c === '}' && top.container === 'object') {
        i++; stack.pop(); state = 'after-value';
      } else if (c === ']' && top.container === 'array') {
        i++; stack.pop(); state = 'after-value';
      } else {
        return false;
      }
    }
  }
  return true;
}

/**
 * Subscribes to LangGraph custom events of name 'a2ui-partial' and feeds
 * the surface store envelope-by-envelope as the parent LLM streams its
 * tool_call.arguments JSON. Uses @cacheplane/partial-json to extract
 * structurally-complete envelope objects from the growing args string.
 *
 * Synthesis safety net: if the first complete surfaceUpdate arrives and
 * no beginRendering has been extracted yet, the bridge synthesises one
 * targeted at the surfaceUpdate's first component (preferring id='root'
 * if present). This makes the surface mount IMMEDIATELY after the first
 * surfaceUpdate parses — without waiting for the LLM to emit beginRendering
 * at the end of its envelope list — so the render-element fallback gate
 * (PR #252) actually fires while dataModelUpdates flow in.
 *
 * The store's apply() already treats repeated beginRendering for the same
 * surfaceId as idempotent (just re-applies styles), so the LLM's eventual
 * beginRendering (if any) is a no-op rather than a conflict.
 */
export function createPartialArgsBridge(store: A2uiSurfaceStore): PartialArgsBridge {
  const states = new Map<string, BridgeState>();

  function stateOf(toolCallId: string): BridgeState {
    let s = states.get(toolCallId);
    if (!s) {
      s = {
        parser: createPartialJsonParser(),
        dispatchedCount: 0,
        synthesised: false,
        synthesisedSurfaceId: null,
        poisoned: false,
      };
      states.set(toolCallId, s);
    }
    return s;
  }

  function pickRoot(components: readonly { id: string }[]): string | null {
    if (components.length === 0) return null;
    const explicitRoot = components.find((c) => c.id === 'root');
    return explicitRoot ? explicitRoot.id : components[0].id;
  }

  function push(toolCallId: string, argsSoFar: string): void {
    const state = stateOf(toolCallId);
    if (state.poisoned) return;
    // Pre-check: poison if the args string isn't a valid JSON prefix.
    if (!isValidJsonPrefix(argsSoFar)) {
      state.poisoned = true;
      return;
    }
    try {
      // Reset the parser to a fresh state and feed the entire cumulative
      // string. The parser is monotonic — same input always yields the
      // same tree — so re-parsing is safe and avoids delta-tracking bugs.
      state.parser = createPartialJsonParser();
      state.parser.push(argsSoFar);
    } catch {
      state.poisoned = true;
      return;
    }
    const rootNode = state.parser.getByPath('/');
    if (!rootNode) return;
    const materialised = materialize(rootNode) as Record<string, unknown> | null;
    if (!materialised || typeof materialised !== 'object') return;
    const envelopes = normalizeEnvelopeArgs(materialised);
    if (!envelopes) return;

    // Dispatch envelopes that haven't been dispatched yet. partial-json
    // returns partially-built objects too; skip incomplete ones (those
    // missing the discriminator top-level key).
    const ready: A2uiMessage[] = [];
    let realDispatched = 0;
    for (let i = 0; i < envelopes.length; i++) {
      const env = envelopes[i] as A2uiMessage;
      if (!isStructurallyComplete(env)) continue;
      // Only dispatch envelopes BEYOND those already sent.
      if (i < state.dispatchedCount) {
        // already dispatched; do not re-send.
        continue;
      }
      ready.push(env);
      realDispatched++;
      // Inject synthesised beginRendering immediately after first surfaceUpdate.
      const synth = synthesisedBegin(env, state);
      if (synth) ready.push(synth);
    }
    if (ready.length === 0) return;

    state.dispatchedCount += realDispatched;
    store.applyPartialArgs(toolCallId, ready);
  }

  function synthesisedBegin(env: A2uiMessage, state: BridgeState): A2uiMessage | null {
    if (state.synthesised || !('surfaceUpdate' in env)) return null;
    const upd = (env as { surfaceUpdate: A2uiSurfaceUpdate }).surfaceUpdate;
    const root = pickRoot(upd.components);
    if (!root) return null;
    state.synthesised = true;
    state.synthesisedSurfaceId = upd.surfaceId;
    return { beginRendering: { surfaceId: upd.surfaceId, root } };
  }

  function isPoisoned(toolCallId: string): boolean {
    return stateOf(toolCallId).poisoned;
  }

  return { push, isPoisoned };
}

/** True if the envelope has a recognised discriminator key with an object value. */
function isStructurallyComplete(env: unknown): env is A2uiMessage {
  if (!env || typeof env !== 'object' || Array.isArray(env)) return false;
  const obj = env as Record<string, unknown>;
  for (const k of ['surfaceUpdate', 'beginRendering', 'dataModelUpdate', 'deleteSurface']) {
    if (k in obj && typeof obj[k] === 'object' && obj[k] !== null) {
      // For surfaceUpdate, also require non-undefined surfaceId + components.
      if (k === 'surfaceUpdate') {
        const su = obj[k] as { surfaceId?: unknown; components?: unknown };
        return typeof su.surfaceId === 'string' && Array.isArray(su.components);
      }
      return true;
    }
  }
  return false;
}
