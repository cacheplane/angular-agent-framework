// SPDX-License-Identifier: MIT
import { computed, signal, WritableSignal } from '@angular/core';
import { Subject } from 'rxjs';
import type {
  LangGraphAgent,
  SubagentStreamRef,
  AgentQueue,
  Interrupt,
  ThreadState,
  CustomStreamEvent,
  AgentBranchTree,
} from '../agent.types';
import type { ToolProgress, ToolCallWithResult } from '@langchain/langgraph-sdk';
import type { BaseMessage, AIMessage as CoreAIMessage } from '@langchain/core/messages';
import type { MessageMetadata } from '@langchain/langgraph-sdk/ui';
import type {
  AgentStatus,
  AgentInterrupt,
  AgentCheckpoint,
  Message,
  Subagent,
  ToolCall,
  AgentEvent,
} from '@ngaf/chat';

/**
 * A LangGraphAgent mock with writable signals for easy test control.
 *
 * Cast the result of `mockLangGraphAgent()` to this type to access
 * writable signals without unsafe casts in test files.
 */
export interface MockLangGraphAgent extends LangGraphAgent<any, any> {
  // Writable versions of signals for direct test mutation
  messages: WritableSignal<Message[]>;
  langGraphMessages: WritableSignal<BaseMessage[]>;
  status: WritableSignal<AgentStatus>;
  isLoading: WritableSignal<boolean>;
  error: WritableSignal<unknown>;
  hasValue: WritableSignal<boolean>;
  value: WritableSignal<any>;
  interrupt: WritableSignal<AgentInterrupt | undefined>;
  langGraphInterrupts: WritableSignal<Interrupt<any>[]>;
  toolCalls: WritableSignal<ToolCall[]>;
  langGraphToolCalls: WritableSignal<ToolCallWithResult[]>;
  toolProgress: WritableSignal<ToolProgress[]>;
  queue: WritableSignal<AgentQueue>;
  branch: WritableSignal<string>;
  history: WritableSignal<AgentCheckpoint[]>;
  langGraphHistory: WritableSignal<ThreadState<any>[]>;
  experimentalBranchTree: WritableSignal<AgentBranchTree<any>>;
  isThreadLoading: WritableSignal<boolean>;
  subagents: WritableSignal<Map<string, Subagent>>;
  activeSubagents: WritableSignal<SubagentStreamRef[]>;
  customEvents: WritableSignal<CustomStreamEvent[]>;
}

/**
 * Creates a mock LangGraphAgent with writable signals for testing.
 * Control state by writing to the returned writable signals directly.
 */
export function mockLangGraphAgent(
  initial: {
    messages?: Message[];
    langGraphMessages?: BaseMessage[];
    status?: AgentStatus;
    isLoading?: boolean;
    error?: unknown;
    hasValue?: boolean;
    isThreadLoading?: boolean;
  } = {}
): MockLangGraphAgent {
  const messages$ = signal<Message[]>(initial.messages ?? []);
  const langGraphMessages$ = signal<BaseMessage[]>(initial.langGraphMessages ?? []);
  const status$ = signal<AgentStatus>(initial.status ?? 'idle');
  const isLoading$ = signal<boolean>(initial.isLoading ?? false);
  const error$ = signal<unknown>(initial.error ?? null);
  const hasValue$ = signal<boolean>(initial.hasValue ?? false);
  const value$ = signal<any>(null);
  const interrupt$ = signal<AgentInterrupt | undefined>(undefined);
  const langGraphInterrupts$ = signal<Interrupt<any>[]>([]);
  const toolCalls$ = signal<ToolCall[]>([]);
  const langGraphToolCalls$ = signal<ToolCallWithResult[]>([]);
  const toolProgress$ = signal<ToolProgress[]>([]);
  const queue$ = signal<AgentQueue>({
    entries: [],
    size: 0,
    cancel: async () => false,
    clear: async () => undefined,
  });
  const branch$ = signal<string>('');
  const history$ = signal<AgentCheckpoint[]>([]);
  const langGraphHistory$ = signal<ThreadState<any>[]>([]);
  const experimentalBranchTree$ = signal<AgentBranchTree<any>>({ type: 'sequence', items: [] });
  const isThreadLoading$ = signal<boolean>(initial.isThreadLoading ?? false);
  const subagents$ = signal<Map<string, Subagent>>(new Map());
  const activeSubagents$ = signal<SubagentStreamRef[]>([]);
  const customEvents$ = signal<CustomStreamEvent[]>([]);

  const state$ = computed<Record<string, unknown>>(() => {
    const v = value$();
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
  });

  const eventsSubject = new Subject<AgentEvent>();

  const mock: MockLangGraphAgent = {
    // ── AgentWithHistory (runtime-neutral surface) ────────────────────────
    messages: messages$,
    status: status$,
    isLoading: isLoading$,
    error: error$,
    toolCalls: toolCalls$,
    state: state$,
    interrupt: interrupt$,
    subagents: subagents$,
    events$: eventsSubject.asObservable(),
    history: history$,
    submit: (_input: any, _opts?: any) => Promise.resolve(),
    stop: () => Promise.resolve(),

    // ── Raw LangGraph signals ─────────────────────────────────────────────
    langGraphMessages: langGraphMessages$,
    langGraphInterrupts: langGraphInterrupts$,
    langGraphToolCalls: langGraphToolCalls$,
    langGraphHistory: langGraphHistory$,
    experimentalBranchTree: experimentalBranchTree$,

    // ── Other AgentRef fields preserved ──────────────────────────────────
    value: value$,
    hasValue: hasValue$,
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    reload: () => {},
    toolProgress: toolProgress$,
    queue: queue$,
    activeSubagents: activeSubagents$,
    getSubagent: (toolCallId: string) =>
      activeSubagents$().find(subagent => subagent.toolCallId === toolCallId),
    getSubagentsByType: (type: string) =>
      activeSubagents$().filter(subagent => subagent.name === type),
    getSubagentsByMessage: (msg: CoreAIMessage) => {
      const toolCalls = (msg as unknown as Record<string, unknown>)['tool_calls'];
      if (!Array.isArray(toolCalls)) return [];
      const ids = toolCalls
        .map(toolCall => {
          if (toolCall == null || typeof toolCall !== 'object' || Array.isArray(toolCall)) return undefined;
          const id = (toolCall as Record<string, unknown>)['id'];
          return typeof id === 'string' ? id : undefined;
        })
        .filter((id): id is string => id != null);
      return activeSubagents$().filter(subagent => ids.includes(subagent.toolCallId));
    },
    customEvents: customEvents$,
    branch: branch$,
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    setBranch: (_branch: string) => {},
    isThreadLoading: isThreadLoading$,
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    switchThread: (_threadId: string | null) => {},
    joinStream: (_runId: string, _lastEventId?: string) => Promise.resolve(),
    getMessagesMetadata: (_msg: BaseMessage, _idx?: number): MessageMetadata<Record<string, unknown>> | undefined => undefined,
    getToolCalls: (_msg: CoreAIMessage): ToolCallWithResult[] => [],
  };

  return mock;
}
