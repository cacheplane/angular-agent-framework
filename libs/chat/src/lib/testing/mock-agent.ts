// SPDX-License-Identifier: MIT
import { signal, WritableSignal } from '@angular/core';
import { EMPTY, type Observable } from 'rxjs';
import type {
  Agent,
  Message,
  AgentStatus,
  ToolCall,
  AgentInterrupt,
  Subagent,
  AgentSubmitInput,
  AgentSubmitOptions,
  AgentEvent,
  AgentCheckpoint,
} from '../agent';

export interface MockAgent extends Agent {
  messages:      WritableSignal<Message[]>;
  status:        WritableSignal<AgentStatus>;
  isLoading:     WritableSignal<boolean>;
  error:         WritableSignal<unknown>;
  toolCalls:     WritableSignal<ToolCall[]>;
  state:         WritableSignal<Record<string, unknown>>;
  interrupt?:    WritableSignal<AgentInterrupt | undefined>;
  subagents?:    WritableSignal<Map<string, Subagent>>;
  history?:      WritableSignal<AgentCheckpoint[]>;
  events$:       Observable<AgentEvent>;
  /** Captured calls to submit() in order. */
  submitCalls: Array<{ input: AgentSubmitInput; opts?: AgentSubmitOptions }>;
  /** Count of stop() invocations. */
  stopCount: number;
}

export interface MockAgentOptions {
  messages?: Message[];
  status?: AgentStatus;
  isLoading?: boolean;
  error?: unknown;
  toolCalls?: ToolCall[];
  state?: Record<string, unknown>;
  withInterrupt?: boolean;
  withSubagents?: boolean;
  history?: AgentCheckpoint[];
  events$?: Observable<AgentEvent>;
}

export function mockAgent(opts: MockAgentOptions = {}): MockAgent {
  const messages  = signal<Message[]>(opts.messages ?? []);
  const status    = signal<AgentStatus>(opts.status ?? 'idle');
  const isLoading = signal<boolean>(opts.isLoading ?? false);
  const error     = signal<unknown>(opts.error ?? null);
  const toolCalls = signal<ToolCall[]>(opts.toolCalls ?? []);
  const state     = signal<Record<string, unknown>>(opts.state ?? {});

  const interrupt = opts.withInterrupt
    ? signal<AgentInterrupt | undefined>(undefined)
    : undefined;
  const subagents = opts.withSubagents
    ? signal<Map<string, Subagent>>(new Map())
    : undefined;
  const history = opts.history
    ? signal<AgentCheckpoint[]>(opts.history)
    : undefined;

  const submitCalls: MockAgent['submitCalls'] = [];
  let stopCount = 0;

  const agent: MockAgent = {
    messages, status, isLoading, error, toolCalls, state,
    ...(interrupt ? { interrupt } : {}),
    ...(subagents ? { subagents } : {}),
    ...(history   ? { history }   : {}),
    events$: opts.events$ ?? EMPTY,
    submit: async (input, submitOpts) => { submitCalls.push({ input, opts: submitOpts }); },
    stop: async () => { stopCount++; },
    submitCalls,
    get stopCount() { return stopCount; },
  };

  return agent;
}
