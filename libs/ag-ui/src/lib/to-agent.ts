// SPDX-License-Identifier: MIT
import { signal } from '@angular/core';
import { Subject } from 'rxjs';
import type { AbstractAgent } from '@ag-ui/client';
import type {
  Agent, Message, AgentStatus, ToolCall, AgentEvent,
  AgentSubmitInput, AgentSubmitOptions,
} from '@ngaf/chat';
import { reduceEvent, type ReducerStore } from './reducer';

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
export function toAgent(source: AbstractAgent): Agent {
  const store: ReducerStore = {
    messages:  signal<Message[]>([]),
    status:    signal<AgentStatus>('idle'),
    isLoading: signal<boolean>(false),
    error:     signal<unknown>(null),
    toolCalls: signal<ToolCall[]>([]),
    state:     signal<Record<string, unknown>>({}),
    events$:   new Subject<AgentEvent>(),
  };

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
    },
  });

  return {
    messages:  store.messages,
    status:    store.status,
    isLoading: store.isLoading,
    error:     store.error,
    toolCalls: store.toolCalls,
    state:     store.state,
    events$:   store.events$.asObservable(),

    submit: async (input: AgentSubmitInput, _opts?: AgentSubmitOptions) => {
      // Optimistic append of user message to our signals and to the source
      // agent's own message list so runAgent() sees the new message.
      const userMsg = buildUserMessage(input);
      if (userMsg) {
        store.messages.update((prev) => [...prev, userMsg]);
        // Sync to AG-UI source so it's included in the next run's input.
        source.addMessage(userMsg as Parameters<typeof source.addMessage>[0]);
      }

      try {
        await source.runAgent();
      } catch (err) {
        // If the run was aborted via stop(), abortRun() resolves the promise
        // rather than rejecting — but catch any unexpected errors here.
        store.status.set('error');
        store.isLoading.set(false);
        store.error.set(err);
      }
    },

    stop: async () => {
      source.abortRun();
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
