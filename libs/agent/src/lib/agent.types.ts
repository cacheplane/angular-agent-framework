// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Signal } from '@angular/core';
import type { ResourceStatus as NgResourceStatus } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import type {
  BagTemplate,
  InferBag,
  Interrupt,
  ThreadState,
  ToolProgress,
  ToolCallWithResult,
} from '@langchain/langgraph-sdk';
import type {
  MessageMetadata,
  SubmitOptions,
} from '@langchain/langgraph-sdk/ui';
import type { BaseMessage, AIMessage as CoreAIMessage } from '@langchain/core/messages';

// Re-export SDK types so consumers don't need to import from langgraph-sdk directly
export type { BagTemplate, InferBag, Interrupt, ThreadState, SubmitOptions };

/**
 * Runtime constant mirroring Angular's ResourceStatus string-union type.
 * Angular 21 ships ResourceStatus as a pure string-union type (no runtime value),
 * so we provide a const-object shim for code that needs runtime comparisons.
 */
export const ResourceStatus = {
  Idle:       'idle',
  Loading:    'loading',
  Reloading:  'reloading',
  Resolved:   'resolved',
  Error:      'error',
  Local:      'local',
} as const satisfies Record<string, NgResourceStatus>;

export type ResourceStatus = NgResourceStatus;

// ── Transport interface ──────────────────────────────────────────────────────

/** An event emitted by a LangGraph stream. */
export interface StreamEvent {
  /** Event type identifier (e.g., 'values', 'messages', 'error', 'interrupt'). */
  type:
    | 'values'
    | 'messages'
    | `messages/${string}`
    | 'updates'
    | 'tools'
    | 'custom'
    | 'error'
    | 'metadata'
    | 'checkpoints'
    | 'tasks'
    | 'debug'
    | 'events'
    | 'interrupt'
    | 'interrupts';
  [key: string]: unknown;
}

/** A custom event emitted by the LangGraph backend via adispatch_custom_event(). */
export interface CustomStreamEvent {
  /** Event name set by the backend (e.g., 'state_update'). */
  name: string;
  /** Arbitrary payload from the backend. */
  data: unknown;
}

/** Transport interface for connecting to a LangGraph agent. */
export interface AgentTransport {
  /** Open a streaming connection to an agent and yield events. */
  stream(
    assistantId: string,
    threadId: string | null,
    payload: unknown,
    signal: AbortSignal,
  ): AsyncIterable<StreamEvent>;

  /** Optional: join an already-started run without creating a new one. */
  joinStream?(
    threadId: string,
    runId: string,
    lastEventId: string | undefined,
    signal: AbortSignal,
  ): AsyncIterable<StreamEvent>;
}

// ── Options ──────────────────────────────────────────────────────────────────

/** Options for creating a streaming resource via {@link agent}. */
export interface AgentOptions<T, ResolvedBag extends BagTemplate> {
  /** Base URL of the LangGraph Platform API. */
  apiUrl: string;
  /** Agent or graph identifier on the LangGraph platform. */
  assistantId: string;
  /** Thread ID to connect to. Pass a Signal for reactive thread switching. */
  threadId?: Signal<string | null> | string | null;
  /** Called when a new thread is auto-created by the transport. */
  onThreadId?: (id: string) => void;
  /** Initial state values before the first stream response arrives. */
  initialValues?: Partial<T>;
  /** Key in the state object that contains the messages array. Defaults to `'messages'`. */
  messagesKey?: string;
  /** Throttle signal updates in milliseconds. `false` to disable. */
  throttle?: number | false;
  /** Custom message deserializer for non-standard message formats. */
  toMessage?: (msg: unknown) => BaseMessage;
  /** Custom transport. Defaults to FetchStreamTransport. */
  transport?: AgentTransport;
  /** When true, subagent messages are filtered from the main messages signal. */
  filterSubagentMessages?: boolean;
  /** Tool names that indicate a subagent invocation. */
  subagentToolNames?: string[];
}

// ── SubagentStreamRef ────────────────────────────────────────────────────────

/** Reference to a subagent's streaming state. */
export interface SubagentStreamRef {
  /** The tool call ID that spawned this subagent. */
  toolCallId: string;
  /** Current execution status of the subagent. */
  status: Signal<'pending' | 'running' | 'complete' | 'error'>;
  /** Current state values from the subagent. */
  values: Signal<Record<string, unknown>>;
  /** Messages from the subagent conversation. */
  messages: Signal<BaseMessage[]>;
}

// ── AgentRef ────────────────────────────────────────────────────────

/** Reactive reference returned by {@link agent}. All properties are Angular Signals. */
export interface AgentRef<T, ResolvedBag extends BagTemplate> {
  // ResourceRef<T> compatible members (duck-typed, not inherited)
  /** Current agent state values. */
  value:    Signal<T>;
  /** Current resource status: idle, loading, resolved, or error. */
  status:   Signal<ResourceStatus>;
  /** True when the resource is actively streaming. */
  isLoading: Signal<boolean>;
  /** Last error, if any. */
  error:    Signal<unknown>;
  /** True once at least one value or message has been received. */
  hasValue: Signal<boolean>;
  /** Re-submits the last input to restart the stream. */
  reload:   () => void;

  // Streaming state
  /** Current list of messages from the agent conversation. */
  messages:        Signal<BaseMessage[]>;
  /** Current interrupt data, if the agent is paused for input. */
  interrupt:       Signal<Interrupt<ResolvedBag['InterruptType']> | undefined>;
  /** All interrupts received during the current run. */
  interrupts:      Signal<Interrupt<ResolvedBag['InterruptType']>[]>;
  /** Progress updates for currently executing tools. */
  toolProgress:    Signal<ToolProgress[]>;
  /** Completed tool calls with their results. */
  toolCalls:       Signal<ToolCallWithResult[]>;

  // Thread & history
  /** Current branch identifier for time-travel navigation. */
  branch:          Signal<string>;
  /** Full execution history of the current thread. */
  history:         Signal<ThreadState<T>[]>;
  /** True while a thread switch is loading state from the server. */
  isThreadLoading: Signal<boolean>;

  // Subagents
  /** Map of active subagent streams keyed by tool call ID. */
  subagents:       Signal<Map<string, SubagentStreamRef>>;
  /** Filtered list of subagents with status 'running'. */
  activeSubagents: Signal<SubagentStreamRef[]>;

  /** Custom events emitted by the LangGraph backend during the current run. */
  customEvents:    Signal<CustomStreamEvent[]>;

  // Actions
  /** Send a message or resume from an interrupt. Returns immediately. */
  submit:              (values: ResolvedBag['UpdateType'] | null, opts?: SubmitOptions) => Promise<void>;
  /** Abort the current stream. */
  stop:                () => Promise<void>;
  /** Switch to a different thread, resetting derived state. */
  switchThread:        (threadId: string | null) => void;
  /** Join an already-running stream by run ID. */
  joinStream:          (runId: string, lastEventId?: string) => Promise<void>;
  /** Set the active branch for time-travel navigation. */
  setBranch:           (branch: string) => void;
  /** Get metadata for a specific message by index. */
  getMessagesMetadata: (msg: BaseMessage, idx?: number) => MessageMetadata<Record<string, unknown>> | undefined;
  /** Get tool call results associated with an AI message. */
  getToolCalls:        (msg: CoreAIMessage) => ToolCallWithResult[];
}

// ── Internal: StreamSubjects ─────────────────────────────────────────────────
// Not exported from public-api.ts

export interface StreamSubjects<T, ResolvedBag extends BagTemplate = BagTemplate> {
  status$:          BehaviorSubject<ResourceStatus>;
  values$:          BehaviorSubject<T>;
  messages$:        BehaviorSubject<BaseMessage[]>;
  error$:           BehaviorSubject<unknown>;
  interrupt$:       BehaviorSubject<Interrupt<ResolvedBag['InterruptType']> | undefined>;
  interrupts$:      BehaviorSubject<Interrupt<ResolvedBag['InterruptType']>[]>;
  branch$:          BehaviorSubject<string>;
  history$:         BehaviorSubject<ThreadState<T>[]>;
  isThreadLoading$: BehaviorSubject<boolean>;
  toolProgress$:    BehaviorSubject<ToolProgress[]>;
  toolCalls$:       BehaviorSubject<ToolCallWithResult[]>;
  subagents$:       BehaviorSubject<Map<string, SubagentStreamRef>>;
  custom$:          BehaviorSubject<CustomStreamEvent[]>;
}
