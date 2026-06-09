// SPDX-License-Identifier: MIT
import { computed, signal } from '@angular/core';
import type { Signal } from '@angular/core';
import type { ClientToolsCapability, ClientToolResult, ClientToolSpec } from '@threadplane/chat';
import type { ToolCall } from '@threadplane/chat';
import type { LangGraphSubmitOptions } from './agent.types';

/**
 * Minimal store surface consumed by createClientToolsCapability.
 * Typed narrowly so the factory is easy to fake in tests.
 */
export interface ClientToolsStore {
  toolCalls: Signal<readonly ToolCall[]>;
  isLoading: Signal<boolean>;
}

/**
 * The run-issuing function used by createClientToolsCapability.
 * Accepts a payload (input) and optional LangGraph submit options.
 * Corresponds to StreamManagerBridge.submit.
 */
export type SubmitFn = (payload: unknown, opts?: LangGraphSubmitOptions) => Promise<void>;

/** Serialize a tool result value to a string for the ToolMessage content. */
function safeStringify(v: unknown): string {
  return typeof v === 'string' ? v : JSON.stringify(v);
}

/**
 * Merge client_tools into a run payload.
 *
 * If payload is null we keep it null — a null payload signals a no-input
 * resume (used by regenerate and command resumes) and the server must
 * receive null, not an object. The catalog can only be injected when the
 * payload is a plain object that the graph's add_messages reducer can
 * process; it cannot be injected into a command-resume (null payload) or
 * into an already-typed non-record payload.
 *
 * Returns a new object; never mutates the original.
 */
export function mergeClientTools(
  payload: unknown,
  catalog: readonly ClientToolSpec[],
): unknown {
  if (catalog.length === 0) return payload;
  if (payload === null || payload === undefined) return payload;
  if (typeof payload !== 'object' || Array.isArray(payload)) return payload;
  return { ...(payload as Record<string, unknown>), client_tools: catalog };
}

/**
 * Creates a ClientToolsCapability backed by a LangGraph submit function and
 * a store of tool-call signals. Extracted into a factory so it can be
 * unit-tested in isolation without standing up a full Angular DI environment.
 *
 * The capability:
 *  - Maintains a catalog of client tool specs (setCatalog). The caller
 *    is responsible for threading the catalog into every run payload via
 *    mergeClientTools() before calling manager.submit — see agent.fn.ts.
 *  - Exposes a `pending` computed signal: tool calls whose name is in the
 *    catalog, have no backend result, and haven't been resolved client-side
 *    yet — but ONLY when the run is not in progress (isLoading===false).
 *    The backend ends the run without emitting a ToolMessage result for
 *    client tools, so `result` stays undefined on those entries.
 *  - resolve(id, result): marks the call as resolved, then issues a NEW
 *    run on the SAME thread by calling submitFn with:
 *      input: {
 *        messages: [{ type: 'tool', role: 'tool', tool_call_id: id, content }],
 *        client_tools: catalog(),
 *      }
 *    The `add_messages` reducer on the Python side appends the ToolMessage
 *    to thread state. Including `client_tools` ensures the model sees the
 *    full tool catalog on the continuation run.
 *
 * Catalog shipping: the catalog is NOT injected by this factory's
 * submitFn call in resolve() — the resolved-tool run builds the payload
 * directly. For normal submit/regenerate runs, the agent.fn.ts wrapper
 * uses mergeClientTools() to inject `client_tools` into the payload
 * before forwarding to manager.submit. This keeps injection concerns
 * co-located with the run-issuing call sites.
 */
export function createClientToolsCapability(
  submitFn: SubmitFn,
  store: ClientToolsStore,
): ClientToolsCapability & { catalog: Signal<readonly ClientToolSpec[]> } {
  const catalog = signal<readonly ClientToolSpec[]>([]);
  const resolvedIds = signal<ReadonlySet<string>>(new Set());

  const pending = computed<readonly ToolCall[]>(() => {
    // Client tools are only actionable after the run ends (the backend
    // signals this by ending the run WITHOUT emitting a ToolMessage result
    // for client tools).
    if (store.isLoading()) return [];
    const names = new Set(catalog().map((s) => s.name));
    const done = resolvedIds();
    return store.toolCalls().filter(
      (tc) => names.has(tc.name) && tc.result === undefined && !done.has(tc.id),
    );
  });

  const capability: ClientToolsCapability & { catalog: Signal<readonly ClientToolSpec[]> } = {
    catalog,

    setCatalog(specs: readonly ClientToolSpec[]): void {
      catalog.set([...specs]);
    },

    pending,

    resolve(id: string, result: ClientToolResult): void {
      // Mark as resolved first so pending() drops it immediately.
      resolvedIds.update((s) => new Set(s).add(id));

      const content = result.ok
        ? safeStringify(result.value)
        : `Error: ${result.error}`;

      // Issue a new run on the same thread. LangGraph's add_messages reducer
      // appends the ToolMessage to the thread state. `client_tools` is
      // included so the model sees the full tool catalog on the continuation.
      //
      // Message shape: both `type` and `role` are set for compatibility —
      // the LangGraph server's add_messages coercion reads `role` (Python
      // side), while the bridge's local optimistic-message path reads `type`
      // (via toMessage's normalizeMessageType). This mirrors the human-message
      // shape used in buildSubmitUpdate (agent.fn.ts line 732).
      const toolPayload = {
        messages: [{ type: 'tool', role: 'tool', tool_call_id: id, content }],
        client_tools: catalog(),
      };

      void submitFn(toolPayload);
    },
  };

  return capability;
}
