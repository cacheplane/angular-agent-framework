// SPDX-License-Identifier: MIT
import { computed, signal, type Signal } from '@angular/core';
import { Subject } from 'rxjs';
import type { AbstractAgent } from '@ag-ui/client';
import { toAgentError, isAbortError, type AgentError } from '@threadplane/chat';
import type {
  Agent, Message, AgentStatus, ToolCall, AgentEvent,
  AgentInterrupt,
  AgentRuntimeTelemetryEvent,
  AgentRuntimeTelemetryProperties,
  AgentRuntimeTelemetrySink,
  AgentSubmitInput, AgentSubmitOptions,
  ClientToolsCapability,
  Subagent, SubagentStatus,
} from '@threadplane/chat';
import { reduceEvent, type ReducerStore, type CustomStreamEvent, type ActivityEntry } from './reducer';
import { createClientToolsCapability } from './client-tools';

export interface ToAgentOptions {
  /** Optional app-owned telemetry sink. No telemetry is emitted unless this is provided. */
  telemetry?: AgentRuntimeTelemetrySink | false;
}

function captureAgentRuntimeTelemetry(
  sink: AgentRuntimeTelemetrySink | false | undefined,
  event: AgentRuntimeTelemetryEvent,
  properties: AgentRuntimeTelemetryProperties,
): void {
  if (!sink) return;
  try {
    void Promise.resolve(sink({ event, properties })).catch(() => undefined);
  } catch {
    // Keep telemetry side effects isolated from adapter control flow.
  }
}

function agentRuntimeTelemetryErrorClass(error: unknown): string {
  if (error instanceof Error) return error.name || error.constructor.name || 'Error';
  if (
    error
    && typeof error === 'object'
    && 'name' in error
    && typeof error.name === 'string'
    && error.name.length > 0
  ) {
    return error.name;
  }
  return 'UnknownError';
}

/**
 * The neutral Agent contract, widened with the AG-UI adapter's optional
 * `customEvents` signal (the chat composition feature-detects it to enable
 * live a2ui streaming) and the optional `clientTools` capability.
 * Mirrors langgraph's LangGraphAgent extension.
 */
export interface AgUiAgent<TState = Record<string, unknown>> extends Agent<TState> {
  customEvents: Signal<CustomStreamEvent[]>;
  clientTools: ClientToolsCapability;
  /** Subagent activities (activityType==='subagent') projected to the neutral
   *  Subagent contract, keyed by messageId. Narrows the base Agent's optional
   *  `subagents?` to a concrete signal for AG-UI consumers. */
  subagents: Signal<Map<string, Subagent>>;
}

/**
 * Wraps an AG-UI AbstractAgent into the runtime-neutral Agent contract.
 *
 * The adapter subscribes to source.subscribe({ onEvent }) and reduces every
 * event into the produced Agent's signals. submit() optimistically appends the
 * user message to both our signals and the source agent's internal message
 * list, then calls source.runAgent(). stop() calls source.abortRun().
 *
 * Subscription cleanup: the returned Agent does NOT manage its own lifetime.
 * Callers using DI should rely on the provider's destroy hook; direct callers
 * of toAgent() should treat the returned object's lifecycle as tied to the
 * agent instance they constructed. The subscriber registered via
 * source.subscribe() will fire for the lifetime of source.
 */
export function toAgent(source: AbstractAgent, options: ToAgentOptions = {}): AgUiAgent {
  const store: ReducerStore = {
    messages:     signal<Message[]>([]),
    status:       signal<AgentStatus>('idle'),
    isLoading:    signal<boolean>(false),
    error:        signal<AgentError | undefined>(undefined),
    toolCalls:    signal<ToolCall[]>([]),
    state:        signal<Record<string, unknown>>({}),
    interrupt:    signal<AgentInterrupt | undefined>(undefined),
    events$:      new Subject<AgentEvent>(),
    customEvents: signal<CustomStreamEvent[]>([]),
    activities:   signal<Map<string, ActivityEntry>>(new Map()),
  };
  const telemetryProperties = { transport: 'ag-ui' as const, surface: 'to_agent' };
  let activeRun: { startedAt: number; errored: boolean } | null = null;

  // Set by stop(); lets run-failure handlers distinguish a user-initiated
  // abort (graceful cancel) from a genuine stream failure.
  let abortRequested = false;

  // Set to true the first time settleIfAborted() handles an abort error for the
  // current run. The AG-UI client can surface the same abort via both the event
  // stream (RUN_ERROR event) AND onRunFailed — abortSettled lets the second
  // delivery see through as a no-op rather than re-writing store state or
  // triggering a real error path. Both flags are reset together at the top of
  // submit() so the next run starts clean.
  let abortSettled = false;

  // Tracks the last AgentSubmitInput so retry() can re-run it without
  // duplicating the user message. Set at the top of submit()'s message path.
  let lastInput: AgentSubmitInput | undefined;

  /** Settles the store as idle for stop()-induced failures; returns true if handled. */
  function settleIfAborted(error: unknown): boolean {
    // If we already settled this abort (duplicate delivery — e.g. RUN_ERROR
    // event THEN onRunFailed), defensively re-apply the idle settle so any
    // state written between the two deliveries (e.g. RUN_STARTED from a new
    // run that started before flags were reset) is corrected. Telemetry is
    // not re-emitted — the guard returns true to suppress further processing.
    if (abortSettled && isAbortError(error)) {
      store.status.set('idle');
      store.isLoading.set(false);
      return true;
    }

    if (!abortRequested || !isAbortError(error)) return false;
    abortRequested = false;
    abortSettled = true;
    store.status.set('idle');
    store.isLoading.set(false);
    // Not a failure: leave store.error null and close out telemetry as a
    // normal finish so the aborted run doesn't count as errored.
    const run = activeRun;
    if (run) {
      finishRunTelemetry(run);
      // Mark errored so any subsequent finishRunTelemetry/failRunTelemetry
      // call on the same run object (e.g. from submit's try block resolving
      // after the abort) is a no-op — telemetry fires at most once per run.
      run.errored = true;
    }
    return true;
  }

  // Build the client-tools capability. catalogAsAgUiTools() is used below to
  // thread the catalog into every runAgent() call.
  const clientToolsCap = createClientToolsCapability(source, store);

  /** Forward a neutral-contract state patch onto the AG-UI run input.
   *  Mirrors the canonical demo's `input.state` mechanism: the patch is
   *  merged into the source agent's client state (carried on
   *  RunAgentInput.state) and reflected optimistically in the local
   *  state signal — the server's next STATE_SNAPSHOT stays authoritative. */
  const applyStatePatch = (patch: Record<string, unknown> | undefined): void => {
    if (!patch || Object.keys(patch).length === 0) return;
    source.state = { ...((source.state as Record<string, unknown>) ?? {}), ...patch };
    store.state.update((prev) => ({ ...prev, ...patch }));
  };

  captureAgentRuntimeTelemetry(
    options.telemetry,
    'ngaf:runtime_instance_created',
    telemetryProperties,
  );

  function startRunTelemetry(requestType: string): { startedAt: number; errored: boolean } {
    const run = { startedAt: Date.now(), errored: false };
    activeRun = run;
    captureAgentRuntimeTelemetry(options.telemetry, 'ngaf:runtime_request_created', {
      ...telemetryProperties,
      requestType,
    });
    captureAgentRuntimeTelemetry(options.telemetry, 'ngaf:stream_started', telemetryProperties);
    return run;
  }

  function finishRunTelemetry(run: { startedAt: number; errored: boolean }): void {
    if (run.errored) return;
    captureAgentRuntimeTelemetry(options.telemetry, 'ngaf:stream_ended', {
      ...telemetryProperties,
      durationMs: Date.now() - run.startedAt,
    });
    if (activeRun === run) activeRun = null;
  }

  function failRunTelemetry(error: unknown, run = activeRun): void {
    if (!run || run.errored) return;
    run.errored = true;
    captureAgentRuntimeTelemetry(options.telemetry, 'ngaf:stream_errored', {
      ...telemetryProperties,
      durationMs: Date.now() - run.startedAt,
      errorClass: agentRuntimeTelemetryErrorClass(error),
    });
    if (activeRun === run) activeRun = null;
  }

  /**
   * Fires the current message list against the source agent (no append).
   * Both submit() and retry() share this path; submit() appends the user
   * message first, retry() skips the append and calls this directly.
   */
  async function runCurrentMessages(): Promise<void> {
    const run = startRunTelemetry('submit');
    const tools = clientToolsCap.catalogAsAgUiTools();
    try {
      await source.runAgent(tools.length > 0 ? { tools } : undefined);
      finishRunTelemetry(run);
    } catch (err) {
      if (!settleIfAborted(err)) {
        store.status.set('error');
        store.isLoading.set(false);
        store.error.set(toAgentError(err));
        failRunTelemetry(err, run);
      }
    }
  }

  // Tap all events from the source agent via the AgentSubscriber API.
  // This subscription lives for the lifetime of `source`.
  source.subscribe({
    onEvent({ event }) {
      // The AG-UI client surfaces a user-initiated abort both as a
      // RUN_ERROR event (here) and via onRunFailed; guard the event path too
      // so the reducer never marks a deliberate stop as an error.
      if (event.type === 'RUN_ERROR') {
        const message = (event as { message?: string }).message ?? '';
        if (settleIfAborted(new Error(message))) return;
      }
      reduceEvent(event, store);
    },
    onRunFailed({ error }) {
      if (settleIfAborted(error)) return;
      store.status.set('error');
      store.isLoading.set(false);
      store.error.set(toAgentError(error));
      failRunTelemetry(error);
    },
  });

  // Stable Subagent wrappers per messageId so chat-subagents (tracks by
  // toolCallId) doesn't churn as activity content streams.
  const subagentWrappers = new Map<string, Subagent>();
  function subagentFor(id: string, entry: ActivityEntry): Subagent {
    let w = subagentWrappers.get(id);
    if (!w) {
      w = {
        toolCallId: (entry.content()['toolCallId'] as string) ?? id,
        name: entry.content()['name'] as string | undefined,
        status: computed(() => (entry.content()['status'] as SubagentStatus) ?? 'running'),
        messages: computed<Message[]>(() => {
          const c = entry.content();
          const raw = c['messages'];
          if (Array.isArray(raw)) {
            return (raw as Array<Record<string, unknown>>).map((m, i) => ({
              id: (m['id'] as string) ?? `${id}-${i}`,
              role: 'assistant' as Message['role'],
              content: typeof m['content'] === 'string' ? (m['content'] as string) : (m['content'] as Message['content']) ?? '',
              ...(Array.isArray(m['toolCallIds']) ? { toolCallIds: m['toolCallIds'] as string[] } : {}),
              ...(typeof m['reasoning'] === 'string' ? { reasoning: m['reasoning'] as string } : {}),
            }));
          }
          return [{ id, role: 'assistant', content: String(c['text'] ?? '') }];
        }),
        toolCalls: computed<ToolCall[]>(() => {
          const raw = entry.content()['toolCalls'];
          return Array.isArray(raw) ? (raw as ToolCall[]) : [];
        }),
        state: computed(() => (entry.content()['state'] as Record<string, unknown>) ?? {}),
      };
      subagentWrappers.set(id, w);
    }
    return w;
  }

  return {
    messages:  store.messages,
    status:    store.status,
    isLoading: store.isLoading,
    error:     store.error,
    toolCalls: store.toolCalls,
    state:     store.state,
    interrupt: store.interrupt,
    events$:      store.events$.asObservable(),
    customEvents: store.customEvents,
    subagents: computed<Map<string, Subagent>>(() => {
      const out = new Map<string, Subagent>();
      for (const [id, entry] of store.activities()) {
        if (entry.activityType !== 'subagent') continue;
        out.set(id, subagentFor(id, entry));
      }
      // Prune stale wrappers: keeps the cache bounded and prevents a reused
      // tool-call-id from binding to an orphaned (pre-RUN_STARTED) content signal.
      for (const id of subagentWrappers.keys()) {
        if (!out.has(id)) subagentWrappers.delete(id);
      }
      return out;
    }),
    clientTools:  clientToolsCap,

    submit: async (input: AgentSubmitInput, _opts?: AgentSubmitOptions) => {
      // Reset both abort flags so a new submit starts clean and genuine
      // failures after a previous stop are never swallowed.
      abortRequested = false;
      abortSettled = false;

      if (input.resume !== undefined) {
        // Resume path: clear the pending interrupt and replay the run with the
        // resume payload forwarded to the LangGraph backend via AG-UI's
        // forwardedProps.command.resume mechanism.
        applyStatePatch(input.state);
        store.interrupt.set(undefined);
        const run = startRunTelemetry('resume');
        const tools = clientToolsCap.catalogAsAgUiTools();
        try {
          await source.runAgent({
            forwardedProps: { command: { resume: input.resume } },
            ...(tools.length > 0 ? { tools } : {}),
          });
          finishRunTelemetry(run);
        } catch (err) {
          if (!settleIfAborted(err)) {
            store.status.set('error');
            store.isLoading.set(false);
            store.error.set(toAgentError(err));
            failRunTelemetry(err, run);
          }
        }
        return;
      }

      applyStatePatch(input.state);

      // Optimistic append of user message to our signals and to the source
      // agent's own message list so runAgent() sees the new message.
      const userMsg = buildUserMessage(input);
      if (userMsg) {
        store.messages.update((prev) => [...prev, userMsg]);
        // Sync to AG-UI source so it's included in the next run's input.
        source.addMessage(userMsg as Parameters<typeof source.addMessage>[0]);
      }

      // Record the input so retry() can re-run it without re-appending the
      // user message (the message is already in the list by this point).
      lastInput = input;

      await runCurrentMessages();
    },

    retry: async () => {
      if (store.isLoading()) return;   // no-op while a run is in flight
      if (lastInput === undefined) return; // nothing to retry
      store.error.set(undefined);
      // Re-run the same message list against the source without appending a
      // duplicate user message — the message is already in store.messages and
      // source's internal list from the original submit().
      await runCurrentMessages();
    },

    stop: async () => {
      abortRequested = true;
      source.abortRun();
    },

    regenerate: async (assistantMessageIndex: number): Promise<void> => {
      if (store.isLoading()) {
        throw new Error('Cannot regenerate while agent is loading another response');
      }
      // Reset abort flags so a regenerate starts clean, exactly like submit().
      // Without this, flags left over from a prior stop() would cause the
      // duplicate-delivery guard in settleIfAborted() to silently swallow the
      // abort error without settling, wedging the store in streaming/running.
      abortRequested = false;
      abortSettled = false;
      const msgs = store.messages();
      const target = msgs[assistantMessageIndex];
      if (!target || target.role !== 'assistant') {
        throw new Error(`Message at index ${assistantMessageIndex} is not an assistant message`);
      }

      // Find the user message immediately preceding the target assistant message.
      const userIdx = msgs
        .slice(0, assistantMessageIndex)
        .map((m, i) => ({ m, i }))
        .reverse()
        .find(({ m }) => m.role === 'user')?.i;
      if (userIdx === undefined) {
        throw new Error('No user message found before the target assistant message');
      }

      // Truncate local message buffer INCLUSIVE of the user message. This
      // preserves the user message in the UI (replace-semantics) while the
      // new assistant response streams in. The trailing user message becomes
      // the active prompt for the next run — we must NOT re-add it.
      const trimmed = msgs.slice(0, userIdx + 1);
      store.messages.set(trimmed);

      // Sync the trimmed list back to the source agent so its internal state
      // matches what we're about to re-run. source.setMessages() replaces the
      // agent's internal message list without appending — the trailing user
      // message in `trimmed` becomes the active prompt for the next run.
      source.setMessages(trimmed as Parameters<typeof source.setMessages>[0]);

      const run = startRunTelemetry('regenerate');
      const regenTools = clientToolsCap.catalogAsAgUiTools();
      try {
        await source.runAgent(regenTools.length > 0 ? { tools: regenTools } : undefined);
        finishRunTelemetry(run);
      } catch (err) {
        if (!settleIfAborted(err)) {
          store.status.set('error');
          store.isLoading.set(false);
          store.error.set(toAgentError(err));
          failRunTelemetry(err, run);
        }
      }
    },
  };
}

function buildUserMessage(input: AgentSubmitInput): Message | undefined {
  if (input.message === undefined) return undefined;
  const content = typeof input.message === 'string'
    ? input.message
    : input.message.map((b) => b.type === 'text' ? b.text : JSON.stringify(b)).join('');
  return { id: randomId(), role: 'user', content };
}

function randomId(): string {
  return Math.random().toString(36).slice(2);
}
