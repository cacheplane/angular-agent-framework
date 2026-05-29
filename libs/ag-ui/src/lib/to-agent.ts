// SPDX-License-Identifier: MIT
import { signal } from '@angular/core';
import { Subject } from 'rxjs';
import type { AbstractAgent } from '@ag-ui/client';
import type {
  Agent, Message, AgentStatus, ToolCall, AgentEvent,
  AgentInterrupt,
  AgentRuntimeTelemetryEvent,
  AgentRuntimeTelemetryProperties,
  AgentRuntimeTelemetrySink,
  AgentSubmitInput, AgentSubmitOptions,
} from '@threadplane/chat';
import { reduceEvent, type ReducerStore } from './reducer';

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
export function toAgent(source: AbstractAgent, options: ToAgentOptions = {}): Agent {
  const store: ReducerStore = {
    messages:  signal<Message[]>([]),
    status:    signal<AgentStatus>('idle'),
    isLoading: signal<boolean>(false),
    error:     signal<unknown>(null),
    toolCalls: signal<ToolCall[]>([]),
    state:     signal<Record<string, unknown>>({}),
    interrupt: signal<AgentInterrupt | undefined>(undefined),
    events$:   new Subject<AgentEvent>(),
  };
  const telemetryProperties = { transport: 'ag-ui' as const, surface: 'to_agent' };
  let activeRun: { startedAt: number; errored: boolean } | null = null;

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

  // Tap all events from the source agent via the AgentSubscriber API.
  // This subscription lives for the lifetime of `source`.
  source.subscribe({
    onEvent({ event }) {
      reduceEvent(event, store);
    },
    onRunFailed({ error }) {
      store.status.set('error');
      store.isLoading.set(false);
      store.error.set(error);
      failRunTelemetry(error);
    },
  });

  return {
    messages:  store.messages,
    status:    store.status,
    isLoading: store.isLoading,
    error:     store.error,
    toolCalls: store.toolCalls,
    state:     store.state,
    interrupt: store.interrupt,
    events$:   store.events$.asObservable(),

    submit: async (input: AgentSubmitInput, _opts?: AgentSubmitOptions) => {
      if (input.resume !== undefined) {
        // Resume path: clear the pending interrupt and replay the run with the
        // resume payload forwarded to the LangGraph backend via AG-UI's
        // forwardedProps.command.resume mechanism.
        store.interrupt.set(undefined);
        const run = startRunTelemetry('resume');
        try {
          await source.runAgent({ forwardedProps: { command: { resume: input.resume } } });
          finishRunTelemetry(run);
        } catch (err) {
          store.status.set('error');
          store.isLoading.set(false);
          store.error.set(err);
          failRunTelemetry(err, run);
        }
        return;
      }

      // Optimistic append of user message to our signals and to the source
      // agent's own message list so runAgent() sees the new message.
      const userMsg = buildUserMessage(input);
      if (userMsg) {
        store.messages.update((prev) => [...prev, userMsg]);
        // Sync to AG-UI source so it's included in the next run's input.
        source.addMessage(userMsg as Parameters<typeof source.addMessage>[0]);
      }

      const run = startRunTelemetry('submit');
      try {
        await source.runAgent();
        finishRunTelemetry(run);
      } catch (err) {
        // If the run was aborted via stop(), abortRun() resolves the promise
        // rather than rejecting — but catch any unexpected errors here.
        store.status.set('error');
        store.isLoading.set(false);
        store.error.set(err);
        failRunTelemetry(err, run);
      }
    },

    stop: async () => {
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

      const run = startRunTelemetry('regenerate');
      try {
        await source.runAgent();
        finishRunTelemetry(run);
      } catch (err) {
        store.status.set('error');
        store.isLoading.set(false);
        store.error.set(err);
        failRunTelemetry(err, run);
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
