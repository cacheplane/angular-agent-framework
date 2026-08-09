// SPDX-License-Identifier: MIT
import { computed, signal } from '@angular/core';
import type { Signal } from '@angular/core';
import {
  selectPendingClientToolCalls,
  type ClientToolsCapability,
  type ClientToolResult,
  type ClientToolSpec,
} from '@threadplane/chat';
import type { ToolCall } from '@threadplane/chat';
import type { LangGraphSubmitOptions } from './agent.types';

/**
 * A patch written onto a local ToolCall when a client tool resolves.
 * Mirrors the fields the ag-ui adapter writes directly onto its WritableSignal.
 */
export interface ClientToolResultPatch {
  result: unknown;
  error?: unknown;
  status?: ToolCall['status'];
}

/**
 * Minimal store surface consumed by createClientToolsCapability.
 * Typed narrowly so the factory is easy to fake in tests.
 */
export interface ClientToolsStore {
  toolCalls: Signal<readonly ToolCall[]>;
  isLoading: Signal<boolean>;
  /**
   * Write a client-tool outcome onto the local ToolCall with the given id.
   * The LangGraph `toolCalls` signal is a read-only projection of the SDK's
   * stream, so the adapter layers these patches over the projection rather
   * than mutating it in place. This freezes the transcript card: toToolViewSpec
   * spreads the result into the mounted ask component's props on the next
   * render, letting it branch to a resolved/frozen state.
   */
  applyClientResult(id: string, patch: ClientToolResultPatch): void;
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

/** Wire shape for a settled client-tool result awaiting durability. */
export interface BufferedToolMessage {
  readonly type: 'tool';
  readonly role: 'tool';
  readonly tool_call_id: string;
  readonly content: string;
}

/** Writes settled tool messages into server thread state without starting a run. */
export type PersistToolMessagesFn = (
  messages: readonly BufferedToolMessage[],
) => Promise<void>;

/** Reads the thread a write would currently land on. */
export type CurrentThreadIdFn = () => string | null;

/**
 * A buffered tool message plus the thread it was settled on. The stamp is
 * internal bookkeeping and never reaches the wire — only `message` is sent.
 */
interface StagedToolMessage {
  readonly threadId: string | null;
  readonly message: BufferedToolMessage;
}

/**
 * Prepend staged tool messages to a run payload's message list.
 *
 * Mirrors mergeClientTools: a null payload signals a no-input resume and must
 * stay null, so staged messages cannot ride along and are left buffered.
 */
export function mergeStagedToolMessages(
  payload: unknown,
  staged: readonly BufferedToolMessage[],
): unknown {
  if (staged.length === 0) return payload;
  if (payload === null || payload === undefined) return payload;
  if (typeof payload !== 'object' || Array.isArray(payload)) return payload;
  const record = payload as Record<string, unknown>;
  const existing = Array.isArray(record['messages']) ? record['messages'] : [];
  return { ...record, messages: [...staged, ...existing] };
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
 *  - settle(id, result): marks the call as resolved, writes the local result,
 *    and buffers a ToolMessage without issuing a run.
 *  - flush(): makes the whole buffer durable in ONE persistFn call without
 *    starting a run — the settlement path for tool groups that never continue.
 *    The batch leaves the buffer at snapshot time and is re-staged only if the
 *    write fails. When persistFn is absent, a non-empty flush rejects without
 *    taking ownership of the buffer, retaining it for explicit recovery through
 *    the later-submit drainToolMessages() fallback. A concurrent resolve()/drain
 *    can never re-send an in-flight batch.
 *  - clearStagedToolMessages(): discards the buffer on a thread switch.
 *  - resolve(id, result): settles the result, then issues a NEW run on the SAME
 *    thread by calling submitFn with the full buffered ToolMessage group:
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
  persistFn?: PersistToolMessagesFn,
  currentThreadIdFn?: CurrentThreadIdFn,
): ClientToolsCapability & {
  catalog: Signal<readonly ClientToolSpec[]>;
  drainToolMessages(): BufferedToolMessage[];
  clearStagedToolMessages(): void;
} {
  const catalog = signal<readonly ClientToolSpec[]>([]);
  const resolvedIds = signal<ReadonlySet<string>>(new Set());
  const toolMessageBuffer: StagedToolMessage[] = [];
  let flushInFlight: Promise<void> | undefined;
  // Bumped whenever the buffer is discarded, so an in-flight flush can tell
  // whether its batch still belongs to the current thread.
  let bufferGeneration = 0;
  // Tool calls belonging to threads we have left. A handler still running when
  // the user switches threads settles AFTER the switch, by which point both the
  // store and the current thread id already describe the NEW thread — the id is
  // the only durable way left to recognise the result as stale.
  const retiredToolCallIds = new Set<string>();

  const pending = computed<readonly ToolCall[]>(() => {
    // Client tools are only actionable after the run ends (the backend
    // signals this by ending the run WITHOUT emitting a ToolMessage result
    // for client tools).
    return selectPendingClientToolCalls({
      isLoading: store.isLoading(),
      toolCalls: store.toolCalls(),
      catalogNames: new Set(catalog().map((s) => s.name)),
      resolvedIds: resolvedIds(),
    });
  });

  function settleResult(id: string, result: ClientToolResult): void {
    // Mark as resolved first so pending() drops it immediately.
    resolvedIds.update((s) => new Set(s).add(id));

    // Cast rather than rely on discriminant narrowing: consumer apps that
    // compile this source with `strictNullChecks: false` don't narrow the
    // ClientToolResult union in a ternary.
    const ok = result.ok;
    const value = (result as { value: unknown }).value;
    const error = (result as { error: string }).error;

    // Write the outcome onto the LOCAL ToolCall (via the adapter's override
    // layer). The client tool DID produce a result client-side, so this is
    // semantically correct — and it freezes the transcript card: the mounted
    // ask component re-renders with its own emitted value as props and can
    // branch to a resolved/frozen state. Without this, the LOCAL tool call
    // never gets a result (only the backend ToolMessage does) so the card
    // stays interactive forever.
    store.applyClientResult(id, {
      result: ok ? value : { error },
      ...(ok ? {} : { error, status: 'error' as const }),
    });

    const content = ok
      ? safeStringify(value)
      : `Error: ${error}`;

    // The tool call belongs to a thread the user has already left, so there is
    // nowhere valid to send this result: the current thread has no matching
    // tool call, and the old thread is no longer the write target.
    if (retiredToolCallIds.has(id)) {
      console.warn(
        `Discarding client tool result for ${id}: its thread is no longer active.`,
      );
      return;
    }

    // Message shape: both `type` and `role` are set for compatibility —
    // the LangGraph server's add_messages coercion reads `role` (Python
    // side), while the bridge's local optimistic-message path reads `type`
    // (via toMessage's normalizeMessageType). This mirrors the human-message
    // shape used in buildSubmitUpdate (agent.fn.ts line 732).
    toolMessageBuffer.push({
      threadId: currentThreadIdFn?.() ?? null,
      message: { type: 'tool', role: 'tool', tool_call_id: id, content },
    });
  }

  /**
   * Remove every staged entry, returning only those still valid for the thread
   * a write would land on right now. An entry is stale when it was stamped with
   * a different thread — dropped rather than misdelivered.
   *
   * A null on either side means "thread not tracked yet" (no threadId option
   * and no run has reported one); those are kept, since there is no evidence of
   * a switch and dropping them would lose results on untracked transports.
   */
  function takeStagedForCurrentThread(): StagedToolMessage[] {
    const current = currentThreadIdFn?.() ?? null;
    const taken = toolMessageBuffer.splice(0, toolMessageBuffer.length);
    return taken.filter((entry) => {
      const stale =
        entry.threadId !== null && current !== null && entry.threadId !== current;
      if (stale) {
        console.warn(
          `Discarding a client tool result staged for thread ${entry.threadId}; ` +
            `the active thread is now ${current}.`,
        );
      }
      return !stale;
    });
  }

  /**
   * Persist one batch. Takes ownership of the buffer at snapshot time:
   * resolve() and drainToolMessages() clear the buffer unconditionally and know
   * nothing about an in-flight write, so anything left staged across the await
   * could be re-sent (a duplicate ToolMessage for one tool_call_id) or removed
   * by the wrong index (dropping a result that was never persisted).
   */
  function runFlush(): Promise<void> {
    if (toolMessageBuffer.length === 0) return Promise.resolve();
    if (!persistFn) {
      return Promise.reject(
        new Error(
          'Cannot flush staged client tool results. ' +
            'Custom LangGraph transports using terminal client tools must implement updateState().',
        ),
      );
    }
    const staged = takeStagedForCurrentThread();
    if (staged.length === 0) return Promise.resolve();

    const generation = bufferGeneration;
    const batch = staged.map((entry) => entry.message);
    const inFlight = persistFn(batch)
      .catch((err: unknown) => {
        // Re-stage at the FRONT so ordering is preserved for the next drain —
        // unless the buffer was cleared meanwhile (thread switch), in which
        // case these results belong to a thread we have left.
        if (generation === bufferGeneration) {
          toolMessageBuffer.unshift(...staged);
        }
        console.warn(
          `Client tool flush failed; ${batch.length} result(s) remain staged for the next run.`,
          err,
        );
      })
      .finally(() => {
        // Only clear if no later flush has already claimed the slot.
        if (flushInFlight === inFlight) flushInFlight = undefined;
      });
    flushInFlight = inFlight;
    return inFlight;
  }

  const capability: ClientToolsCapability & {
    catalog: Signal<readonly ClientToolSpec[]>;
    drainToolMessages(): BufferedToolMessage[];
    clearStagedToolMessages(): void;
  } = {
    catalog,

    setCatalog(specs: readonly ClientToolSpec[]): void {
      catalog.set([...specs]);
    },

    pending,

    settle(id: string, result: ClientToolResult): void {
      settleResult(id, result);
    },

    /** Remove and return every buffered tool message valid for this thread. */
    drainToolMessages(): BufferedToolMessage[] {
      return takeStagedForCurrentThread().map((entry) => entry.message);
    },

    /**
     * Discard everything staged. Called when the active thread changes: a
     * ToolMessage only makes sense against the thread whose AIMessage produced
     * its tool_call_id, so carrying it over would poison the new thread.
     */
    clearStagedToolMessages(): void {
      // Retire the outgoing thread's tool calls so a handler that settles after
      // the switch is recognised as stale. Read the store BEFORE it resets —
      // agent.fn.ts calls this ahead of manager.switchThread for that reason.
      for (const toolCall of store.toolCalls()) retiredToolCallIds.add(toolCall.id);
      toolMessageBuffer.length = 0;
      // Invalidate any in-flight flush so its failure path cannot re-stage the
      // old thread's messages into the new thread's buffer.
      bufferGeneration += 1;
    },

    flush(): Promise<void> {
      if (flushInFlight) {
        // Chain rather than short-circuit. The caller's batch may have been
        // staged AFTER the in-flight write took its snapshot, so returning that
        // promise would resolve without ever persisting it — which is exactly
        // what happens when an abort fires one flush per settled call. The
        // chain terminates because runFlush() returns immediately once the
        // buffer is empty.
        const chained = flushInFlight.then(() => runFlush());
        flushInFlight = chained;
        return chained;
      }
      return runFlush();
    },

    resolve(id: string, result: ClientToolResult): void {
      settleResult(id, result);
      // Issue a new run on the same thread. LangGraph's add_messages reducer
      // appends the ToolMessages to the thread state. `client_tools` is
      // included so the model sees the full tool catalog on the continuation.
      const toolPayload = {
        messages: takeStagedForCurrentThread().map((entry) => entry.message),
        client_tools: catalog(),
      };

      void submitFn(toolPayload);
    },
  };

  return capability;
}
