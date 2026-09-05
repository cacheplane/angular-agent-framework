import { computed, isDevMode, signal, type Signal } from '@angular/core';
// eslint-disable-next-line @nx/enforce-module-boundaries -- Keep the postinstall module external through ng-packagr.
import { installationToken } from '#development-install';
declare const ngDevMode: boolean;
import { createDevelopmentRuntime, registerDevelopmentRuntimePolicy } from '@threadplane/telemetry/browser';
import { THREADPLANE_PACKAGE_VERSION as packageVersion } from './package-version';
import { Subject } from 'rxjs';
import type { AbstractAgent } from '@ag-ui/client';
import type { ResumeEntry } from '@ag-ui/core';
import {
  completeDelivery,
  staticDelivery,
  streamingDelivery,
  toAgentError,
  isAbortError,
  AgentError,
  AGENT_ERROR_MESSAGES,
} from '@threadplane/chat';
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
import {
  finalizeDeliveryRun,
  reduceEvent,
  type ReducerDeliveryRun,
  type ReducerStore,
  type CustomStreamEvent,
  type ActivityEntry,
} from './reducer';
import { createClientToolsCapability } from './client-tools';

export interface ToAgentOptions {
  /**
   * Omit to enable automatic development-only collection. Set `false` to disable.
   * An app-owned sink replaces the automatic destination and receives the
   * existing runtime lifecycle callbacks.
   */
  telemetry?: AgentRuntimeTelemetrySink | false;
  /**
   * A2UI client capabilities (catalog negotiation) to advertise to the agent.
   * When set, they are seeded once into the AG-UI shared state under the
   * `a2ui_client_capabilities` key, so every RunAgentInput.state carries them.
   * Use `@threadplane/chat`'s `a2uiClientCapabilities()` for the renderer's
   * standard value.
   */
  a2uiClientCapabilities?: { supportedCatalogIds: string[]; inlineCatalogs?: unknown[] };
}

type InternalToAgentOptions = ToAgentOptions & {
  protectOperationErrors?: boolean;
};

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
  try {
    if (isAbortError(error)) return 'AbortError';
    if (error instanceof AgentError) return 'AgentError';
    if (error instanceof Error) return 'Error';
  } catch {
    return 'UnknownError';
  }
  return 'UnknownError';
}

/**
 * The neutral Agent contract, widened with the AG-UI adapter's
 * `customEvents` signal (the chat composition feature-detects it to enable
 * live a2ui streaming), the browser client-tools capability, and concrete
 * ACTIVITY-backed `subagents`.
 * Mirrors langgraph's LangGraphAgent extension where the protocol surfaces
 * overlap.
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
 *
 * @example
 * ```ts
 * import { HttpAgent } from '@ag-ui/client';
 * import { toAgent } from '@threadplane/ag-ui';
 *
 * const agent = toAgent(new HttpAgent({ url: '/api/agent' }));
 * ```
 */
export function toAgent(source: AbstractAgent, options: ToAgentOptions = {}): AgUiAgent {
  return createAgentAdapter(source, options);
}

/** @internal Adapter integration seam used only by provideAgent. */
export function ɵtoAgentWithProtectedErrors(
  source: AbstractAgent,
  options: ToAgentOptions,
): AgUiAgent {
  return createAgentAdapter(source, { ...options, protectOperationErrors: true });
}

function createAgentAdapter(
  source: AbstractAgent,
  options: InternalToAgentOptions,
): AgUiAgent {
  // Advertise A2UI capabilities via the AG-UI shared state so every
  // RunAgentInput.state carries them (transport metadata, A2UI v0.9).
  if (options.a2uiClientCapabilities) {
    source.state = {
      ...((source.state as Record<string, unknown>) ?? {}),
      a2ui_client_capabilities: options.a2uiClientCapabilities,
    };
  }

  let generationSequence = 0;
  const allocateDeliveryGeneration = (scope: string): string =>
    `${scope}-${++generationSequence}-${Math.random().toString(36).slice(2, 10)}`;
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
    deliveryRun: null,
    allocateDeliveryGeneration,
  };
  const telemetryProperties = { transport: 'ag-ui' as const, surface: 'to_agent' };
  const developmentRuntime = createDevelopmentRuntime({
    integration: 'ag-ui', packageName: '@threadplane/ag-ui', packageVersion,
    installationToken: (typeof ngDevMode === 'undefined' || ngDevMode) && isDevMode() ? installationToken : null,
    enabled: () => options.telemetry === undefined,
  });
  interface AdapterRun extends ReducerDeliveryRun {
    startedAt: number;
    telemetrySettled: boolean;
    resumedInterrupt: boolean;
  }
  let activeRun: AdapterRun | null = null;
  const runsByProtocolId = new Map<string, AdapterRun>();

  // Tracks the last AgentSubmitInput so retry() can re-run it without
  // duplicating the user message. Set at the top of submit()'s message path.
  let lastInput: AgentSubmitInput | undefined;

  function resolveCallbackRun(protocolRunId: string | undefined): AdapterRun | null {
    if (!protocolRunId) return activeRun;
    const known = runsByProtocolId.get(protocolRunId);
    if (known) return known;
    if (!activeRun || activeRun.protocolRunId) return null;
    activeRun.protocolRunId = protocolRunId;
    runsByProtocolId.set(protocolRunId, activeRun);
    while (runsByProtocolId.size > 16) {
      const oldestId = runsByProtocolId.keys().next().value as string | undefined;
      if (!oldestId) break;
      if (runsByProtocolId.get(oldestId) === activeRun) {
        const current = runsByProtocolId.get(oldestId)!;
        runsByProtocolId.delete(oldestId);
        runsByProtocolId.set(oldestId, current);
        continue;
      }
      runsByProtocolId.delete(oldestId);
    }
    return activeRun;
  }

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
    'tplane:runtime_instance_created',
    telemetryProperties,
  );

  function beginRun(requestType: string, allowBaselineTail = false, resumedInterrupt = false): AdapterRun {
    developmentRuntime.touch();
    if (activeRun && activeRun.outcome === undefined) {
      const supersededRun = activeRun;
      finalizeDeliveryRun(store, supersededRun, 'interrupted');
      const interruption = new Error('Run superseded by a newer request');
      interruption.name = 'InterruptedError';
      failRunTelemetry(interruption, supersededRun);
    }
    const run: AdapterRun = {
      generation: allocateDeliveryGeneration('run'),
      baselineMessageIds: new Set(store.messages().map(message => message.id)),
      ownedMessageIds: new Set(),
      snapshotReplacementIds: new Set(),
      eligibleBaselineAssistantId: allowBaselineTail
        ? getTailAssistantMessageId(store.messages())
        : undefined,
      startedAt: Date.now(),
      telemetrySettled: false,
      resumedInterrupt,
    };
    activeRun = run;
    store.deliveryRun = run;
    captureAgentRuntimeTelemetry(options.telemetry, 'tplane:runtime_request_created', {
      ...telemetryProperties,
      requestType,
    });
    captureAgentRuntimeTelemetry(options.telemetry, 'tplane:stream_started', telemetryProperties);
    return run;
  }

  function finishRunTelemetry(run: AdapterRun): void {
    if (run.telemetrySettled) return;
    run.telemetrySettled = true;
    captureAgentRuntimeTelemetry(options.telemetry, 'tplane:stream_ended', {
      ...telemetryProperties,
      durationMs: Date.now() - run.startedAt,
    });
  }

  function failRunTelemetry(error: unknown, run: AdapterRun | null = activeRun): void {
    if (!run || run.telemetrySettled) return;
    run.telemetrySettled = true;
    captureAgentRuntimeTelemetry(options.telemetry, 'tplane:stream_errored', {
      ...telemetryProperties,
      durationMs: Date.now() - run.startedAt,
      errorClass: agentRuntimeTelemetryErrorClass(error),
    });
  }

  function failRun(run: AdapterRun, error: unknown): void {
    if (run.outcome !== undefined) return;
    finalizeDeliveryRun(store, run, 'error');
    if (activeRun === run) {
      store.status.set('error');
      store.isLoading.set(false);
      store.error.set(options.protectOperationErrors ? protectedAgentError() : projectAgentError(error));
    }
    failRunTelemetry(options.protectOperationErrors ? undefined : error, run);
  }

  function settleTransportClose(run: AdapterRun): void {
    if (run.outcome === undefined) {
      finalizeDeliveryRun(store, run, run.ownedMessageIds.size > 0 ? 'interrupted' : 'success');
      if (activeRun === run) {
        store.status.set('idle');
        store.isLoading.set(false);
        store.error.set(undefined);
      }
    }
    finishRunTelemetry(run);
  }

  type RunParameters = Parameters<AbstractAgent['runAgent']>[0];

  async function executeRun(
    requestType: string,
    parameters?: RunParameters,
    allowBaselineTail = false,
    resumedInterrupt = false,
  ): Promise<void> {
    const run = beginRun(requestType, allowBaselineTail, resumedInterrupt);
    const tools = clientToolsCap.catalogAsAgUiTools();
    const runParameters = parameters === undefined && tools.length === 0
      ? undefined
      : { ...parameters, ...(tools.length > 0 ? { tools } : {}) };
    // @ag-ui/client@0.0.59 records RUN_FINISHED interrupt outcomes on
    // source.pendingInterrupts and REFUSES the next runAgent() unless a
    // `resume` entry addresses every pending id (AGUIError thrown in
    // onInitialize). The adapter's own interrupt signal governs resume flow:
    // when this run resolves the interrupt through forwardedProps (Mastra,
    // LangGraph — their measured wire shapes carry no top-level resume) or is
    // a plain submit that abandons the interrupt (the pre-0.0.59 semantics),
    // clear the client-side ledger so the run is sent exactly as before.
    if (runParameters?.resume === undefined) {
      const pending = (source as { pendingInterrupts?: unknown }).pendingInterrupts;
      if (Array.isArray(pending) && pending.length > 0) {
        (source as { pendingInterrupts: unknown[] }).pendingInterrupts = [];
      }
    }
    try {
      await source.runAgent(runParameters);
      settleTransportClose(run);
    } catch (err) {
      if (run.outcome === 'aborted' && safeIsAbortError(err)) return;
      failRun(run, err);
    }
  }

  const clientToolsCap = createClientToolsCapability(
    source,
    store,
    () => executeRun('client-tool-continuation', undefined, true),
  );

  // Tap all events from the source agent via the AgentSubscriber API.
  // This subscription lives for the lifetime of `source`.
  source.subscribe({
    onRunInitialized({ input }) {
      resolveCallbackRun(input.runId);
    },
    onEvent({ event, input }) {
      const callbackRunId = input?.runId ?? (event as { runId?: string }).runId;
      const run = resolveCallbackRun(callbackRunId);
      if (!run) {
        if (!callbackRunId) reduceEvent(event, store);
        return;
      }
      if (run !== activeRun) {
        if (event.type === 'RUN_FINISHED') finalizeDeliveryRun(store, run, 'success');
        else if (event.type === 'RUN_ERROR') finalizeDeliveryRun(store, run, 'error');
        return;
      }
      if (event.type === 'RUN_ERROR' && run.outcome === 'aborted') return;
      const hasDevelopmentEvidence = event.type !== 'RUN_FINISHED' || hasValidFinishedOutcome(event);
      if (run.outcome === undefined && hasDevelopmentEvidence && supportedDevelopmentEventTypes.has(event.type)) {
        developmentRuntime.milestone('transport.connected');
      }
      if (event.type === 'RUN_ERROR' && options.protectOperationErrors) {
        failRun(run, undefined);
        return;
      }
      const wasPending = run.outcome === undefined;
      reduceEvent(event, store);
      if (run && event.type === 'RUN_FINISHED' && run.outcome === 'success') {
        if (wasPending && hasDevelopmentEvidence && !store.interrupt() && !store.error()) {
          developmentRuntime.milestone('runtime.first_stream_completed', Date.now() - run.startedAt);
          if (run.resumedInterrupt) developmentRuntime.milestone('interrupt.handled');
        }
        finishRunTelemetry(run);
      } else if (run && event.type === 'RUN_ERROR' && run.outcome === 'error') {
        failRunTelemetry((event as { message?: unknown }).message ?? event, run);
      }
    },
    onRunFailed({ error, input }) {
      const run = resolveCallbackRun(input?.runId);
      if (run) {
        if (run.outcome === 'aborted' && safeIsAbortError(error)) {
          return options.protectOperationErrors ? ({ stopPropagation: true } as never) : undefined;
        }
        failRun(run, error);
        return options.protectOperationErrors ? ({ stopPropagation: true } as never) : undefined;
      }
      if (input?.runId) {
        return options.protectOperationErrors ? ({ stopPropagation: true } as never) : undefined;
      }
      store.status.set('error');
      store.isLoading.set(false);
      store.error.set(options.protectOperationErrors ? protectedAgentError() : projectAgentError(error));
      return options.protectOperationErrors ? ({ stopPropagation: true } as never) : undefined;
    },
  });

  // Stable Subagent wrappers per messageId so chat-subagents (tracks by
  // toolCallId) doesn't churn as activity content streams.
  const subagentWrappers = new Map<string, { generation: string; wrapper: Subagent }>();
  function subagentFor(id: string, entry: ActivityEntry): Subagent {
    const cached = subagentWrappers.get(id);
    let w = cached?.generation === entry.generation ? cached.wrapper : undefined;
    if (!w) {
      w = {
        toolCallId: (entry.content()['toolCallId'] as string) ?? id,
        name: entry.content()['name'] as string | undefined,
        status: computed(() => (entry.content()['status'] as SubagentStatus) ?? 'running'),
        messages: computed<Message[]>(() => {
          const c = entry.content();
          const status = (c['status'] as SubagentStatus) ?? 'running';
          const assistantDelivery = status === 'error'
            ? completeDelivery(entry.generation, 'error')
            : status === 'complete'
              ? completeDelivery(entry.generation, 'success')
              : streamingDelivery(entry.generation);
          const raw = c['messages'];
          if (Array.isArray(raw)) {
            return (raw as Array<Record<string, unknown>>).map((m, i) => {
              const messageId = (m['id'] as string) ?? `${id}-${i}`;
              return {
                id: messageId,
                role: 'assistant' as Message['role'],
                content: typeof m['content'] === 'string' ? (m['content'] as string) : (m['content'] as Message['content']) ?? '',
                delivery: m['role'] === 'assistant' ? assistantDelivery : staticDelivery(messageId),
                ...(Array.isArray(m['toolCallIds']) ? { toolCallIds: m['toolCallIds'] as string[] } : {}),
                ...(typeof m['reasoning'] === 'string' ? { reasoning: m['reasoning'] as string } : {}),
              };
            });
          }
          return [{ id, role: 'assistant', content: String(c['text'] ?? ''), delivery: assistantDelivery }];
        }),
        toolCalls: computed<ToolCall[]>(() => {
          const raw = entry.content()['toolCalls'];
          return Array.isArray(raw) ? (raw as ToolCall[]) : [];
        }),
        state: computed(() => (entry.content()['state'] as Record<string, unknown>) ?? {}),
      };
      subagentWrappers.set(id, { generation: entry.generation, wrapper: w });
    }
    return w;
  }

  return registerDevelopmentRuntimePolicy<AgUiAgent>({
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
      if (input.resume !== undefined) {
        // Resume path: clear the pending interrupt and replay the run with the
        // resume payload. The wire mechanism (protocol-standard top-level
        // `resume` array vs forwardedProps) is derived from how the inbound
        // interrupt arrived — see buildResumeRunParameters.
        applyStatePatch(input.state);
        const pendingInterrupt = store.interrupt();
        store.interrupt.set(undefined);
        await executeRun(
          'resume',
          buildResumeRunParameters(input.resume, pendingInterrupt),
          true,
          pendingInterrupt !== undefined,
        );
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

      await executeRun('submit');
    },

    retry: async () => {
      if (store.isLoading()) return;   // no-op while a run is in flight
      if (lastInput === undefined) return; // nothing to retry
      store.error.set(undefined);
      // Re-run the same message list against the source without appending a
      // duplicate user message — the message is already in store.messages and
      // source's internal list from the original submit().
      await executeRun('retry', undefined, true);
    },

    stop: async () => {
      const run = activeRun;
      if (run && run.outcome === undefined) {
        finalizeDeliveryRun(store, run, 'aborted');
        store.status.set('idle');
        store.isLoading.set(false);
        store.error.set(undefined);
        finishRunTelemetry(run);
      }
      source.abortRun();
    },

    regenerate: async (assistantMessageIndex: number): Promise<void> => {
      if (store.isLoading()) {
        throw new Error('Cannot regenerate while agent is loading another response');
      }
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

      await executeRun('regenerate');
    },
  }, () => options.telemetry === undefined);
}

const supportedDevelopmentEventTypes = new Set([
  'RUN_STARTED', 'RUN_FINISHED', 'RUN_ERROR', 'TEXT_MESSAGE_START', 'TEXT_MESSAGE_CONTENT',
  'TEXT_MESSAGE_END', 'REASONING_MESSAGE_START', 'REASONING_MESSAGE_CONTENT', 'REASONING_MESSAGE_CHUNK',
  'REASONING_MESSAGE_END', 'TOOL_CALL_START', 'TOOL_CALL_ARGS', 'TOOL_CALL_END', 'TOOL_CALL_RESULT',
  'STATE_SNAPSHOT', 'STATE_DELTA', 'MESSAGES_SNAPSHOT', 'CUSTOM', 'SUBAGENT_STARTED',
  'SUBAGENT_FINISHED', 'SUBAGENT_ERROR', 'ACTIVITY_SNAPSHOT', 'ACTIVITY_DELTA',
]);

/** A malformed outcome must not turn the reducer's legacy fallback into evidence. */
function hasValidFinishedOutcome(event: object): boolean {
  const outcome = (event as { outcome?: unknown }).outcome;
  // The AG-UI schema explicitly accepts absent/null outcomes for older servers.
  if (outcome == null) return true;
  if (typeof outcome !== 'object' || Array.isArray(outcome)) return false;
  const value = outcome as Record<string, unknown>;
  if (value['type'] === 'success') return true;
  return value['type'] === 'interrupt' && Array.isArray(value['interrupts']);
}

function protectedAgentError(): AgentError {
  return new AgentError({
    kind: 'server',
    message: AGENT_ERROR_MESSAGES.server,
    retryable: true,
  });
}

function projectAgentError(error: unknown): AgentError {
  try {
    return toAgentError(error);
  } catch {
    return protectedAgentError();
  }
}

function safeIsAbortError(error: unknown): boolean {
  try {
    return isAbortError(error);
  } catch {
    return false;
  }
}

/**
 * Build the outgoing run parameters for a `submit({ resume })`.
 *
 * The wire mechanism is keyed on how the pending interrupt arrived, so each
 * runtime finds the resume payload where it reads it (all measured against
 * the 2026-08-31 runtime-portability spike captures):
 *
 * - LangGraph (CUSTOM on_interrupt with an opaque payload — no identifying
 *   fields): exactly `{ forwardedProps: { command: { resume } } }`,
 *   byte-for-byte the historical shape. Backward compatibility here is
 *   non-negotiable.
 * - Mastra (CUSTOM on_interrupt payload carrying `toolCallId` + `runId`):
 *   `{ forwardedProps: { command: { resume, interruptEvent: { toolCallId,
 *   runId } } } }` — the measured working request (fixtures/
 *   runtime-transcripts/mastra-resume-correct.request.json), byte-for-byte
 *   unchanged.
 * - Protocol-standard RUN_FINISHED interrupt outcome (AWS Strands, Microsoft
 *   Agent Framework — stored by the reducer as `{ interrupts: [...], runId }`):
 *   the protocol-standard TOP-LEVEL `resume` array, one
 *   `{ interruptId, status: 'resolved', payload }` entry per pending
 *   interrupt. RunAgentInputSchema@0.0.59 carries the field and
 *   prepareRunAgentInput serializes it (0.0.52 dropped it at assembly, which
 *   made Strands resume unsendable — the reason for the 0.0.59 upgrade).
 *   Strands reads exactly this shape (fixtures/runtime-transcripts/
 *   strands-resume.request.json, measured working); the Microsoft bridge
 *   reads the top-level field FIRST (`_extract_resume_payload` in
 *   agent_framework_ag_ui checks `input.resume` before
 *   forwardedProps.command.resume) and accepts `interruptId` entries. A
 *   caller that already provides entry-shaped `resume` values has them
 *   normalized to `ResumeEntry` (`id` → `interruptId`) and sent top-level.
 */
function buildResumeRunParameters(
  resume: unknown,
  interrupt: AgentInterrupt | undefined,
): { resume: ResumeEntry[] } | { forwardedProps: Record<string, unknown> } {
  const value = interrupt?.value;
  if (isRecord(value)) {
    if (typeof value['toolCallId'] === 'string') {
      return {
        forwardedProps: {
          command: {
            resume,
            interruptEvent: {
              toolCallId: value['toolCallId'],
              ...(typeof value['runId'] === 'string' ? { runId: value['runId'] } : {}),
            },
          },
        },
      };
    }
    if (Array.isArray(value['interrupts'])) {
      if (isStructuredResume(resume)) {
        return { resume: (resume as Record<string, unknown>[]).map(toResumeEntry) };
      }
      const entries = (value['interrupts'] as unknown[])
        .filter(isRecord)
        .filter((entry) => typeof entry['id'] === 'string');
      if (entries.length > 0) {
        return {
          resume: entries.map((entry) => ({
            interruptId: entry['id'] as string,
            status: 'resolved' as const,
            payload: resume,
          })),
        };
      }
    }
  }
  return { forwardedProps: { command: { resume } } };
}

/** True when the caller already provided per-interrupt entries
 *  (`[{ id | interruptId, ... }]`). */
function isStructuredResume(resume: unknown): boolean {
  return Array.isArray(resume)
    && resume.length > 0
    && resume.every((entry) =>
      isRecord(entry)
      && (typeof entry['id'] === 'string' || typeof entry['interruptId'] === 'string'),
    );
}

/** Normalize a caller-authored entry to the protocol's ResumeEntry shape:
 *  `id` becomes `interruptId`, status defaults to 'resolved', every other
 *  field (payload, metadata, …) rides along unchanged. */
function toResumeEntry(entry: Record<string, unknown>): ResumeEntry {
  const { id, interruptId, status, ...rest } = entry;
  return {
    interruptId: (typeof interruptId === 'string' ? interruptId : id) as string,
    status: status === 'cancelled' ? 'cancelled' : 'resolved',
    ...rest,
  } as ResumeEntry;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function buildUserMessage(input: AgentSubmitInput): Message | undefined {
  if (input.message === undefined) return undefined;
  const content = typeof input.message === 'string'
    ? input.message
    : input.message.map((b) => b.type === 'text' ? b.text : JSON.stringify(b)).join('');
  const id = randomId();
  return { id, role: 'user', content, delivery: staticDelivery(id) };
}

function randomId(): string {
  return Math.random().toString(36).slice(2);
}

function getTailAssistantMessageId(messages: readonly Message[]): string | undefined {
  const tail = messages[messages.length - 1];
  return tail?.role === 'assistant' ? tail.id : undefined;
}
