// SPDX-License-Identifier: MIT
import { signal, WritableSignal } from '@angular/core';
import type { AgentRef, SubagentStreamRef, ResourceStatus as ResourceStatusType, Interrupt, ThreadState, SubmitOptions, CustomStreamEvent } from '../agent.types';
import type { ToolProgress, ToolCallWithResult } from '@langchain/langgraph-sdk';
import { ResourceStatus } from '../agent.types';
import type { BaseMessage, AIMessage as CoreAIMessage } from '@langchain/core/messages';
import type { MessageMetadata } from '@langchain/langgraph-sdk/ui';

/**
 * A AgentRef with writable signals for easy test control.
 * Cast the result of createMockAgentRef() to this type to access
 * writable signals without unsafe casts in test files.
 */
export interface MockAgentRef extends AgentRef<any, any> {
  messages: WritableSignal<BaseMessage[]>;
  status: WritableSignal<ResourceStatusType>;
  error: WritableSignal<unknown>;
  interrupt: WritableSignal<Interrupt<any> | undefined>;
  interrupts: WritableSignal<Interrupt<any>[]>;
  isLoading: WritableSignal<boolean>;
  hasValue: WritableSignal<boolean>;
  value: WritableSignal<any>;
  toolProgress: WritableSignal<ToolProgress[]>;
  toolCalls: WritableSignal<ToolCallWithResult[]>;
  branch: WritableSignal<string>;
  history: WritableSignal<ThreadState<any>[]>;
  isThreadLoading: WritableSignal<boolean>;
  subagents: WritableSignal<Map<string, SubagentStreamRef>>;
  activeSubagents: WritableSignal<SubagentStreamRef[]>;
  customEvents: WritableSignal<CustomStreamEvent[]>;
}

/**
 * Creates a mock AgentRef with writable signals for testing.
 * Control state by writing to the returned writable signals directly.
 */
export function createMockAgentRef(
  initial: {
    messages?: BaseMessage[];
    status?: ResourceStatusType;
    isLoading?: boolean;
    error?: unknown;
    hasValue?: boolean;
    isThreadLoading?: boolean;
  } = {}
): MockAgentRef {
  const messages$ = signal<BaseMessage[]>(initial.messages ?? []);
  const status$ = signal<ResourceStatusType>(initial.status ?? ResourceStatus.Idle);
  const isLoading$ = signal<boolean>(initial.isLoading ?? false);
  const error$ = signal<unknown>(initial.error ?? null);
  const hasValue$ = signal<boolean>(initial.hasValue ?? false);
  const value$ = signal<any>(null);
  const interrupt$ = signal<Interrupt<any> | undefined>(undefined);
  const interrupts$ = signal<Interrupt<any>[]>([]);
  const toolProgress$ = signal<ToolProgress[]>([]);
  const toolCalls$ = signal<ToolCallWithResult[]>([]);
  const branch$ = signal<string>('');
  const history$ = signal<ThreadState<any>[]>([]);
  const isThreadLoading$ = signal<boolean>(initial.isThreadLoading ?? false);
  const subagents$ = signal<Map<string, SubagentStreamRef>>(new Map());
  const activeSubagents$ = signal<SubagentStreamRef[]>([]);
  const customEvents$ = signal<CustomStreamEvent[]>([]);

  const ref: MockAgentRef = {
    value: value$,
    status: status$,
    isLoading: isLoading$,
    error: error$,
    hasValue: hasValue$,
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    reload: () => {},

    messages: messages$,
    interrupt: interrupt$,
    interrupts: interrupts$,
    toolProgress: toolProgress$,
    toolCalls: toolCalls$,

    branch: branch$,
    history: history$,
    isThreadLoading: isThreadLoading$,

    subagents: subagents$,
    activeSubagents: activeSubagents$,
    customEvents: customEvents$,

    submit: (_values: any, _opts?: SubmitOptions) => Promise.resolve(),
    stop: () => Promise.resolve(),
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    switchThread: (_threadId: string | null) => {},
    joinStream: (_runId: string, _lastEventId?: string) => Promise.resolve(),
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    setBranch: (_branch: string) => {},
    getMessagesMetadata: (_msg: BaseMessage, _idx?: number): MessageMetadata<Record<string, unknown>> | undefined => undefined,
    getToolCalls: (_msg: CoreAIMessage): ToolCallWithResult[] => [],
  };

  return ref as MockAgentRef;
}
