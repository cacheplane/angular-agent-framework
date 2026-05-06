// SPDX-License-Identifier: MIT
import { Signal } from '@angular/core';
import type { ResourceStatus as NgResourceStatus } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import type {
  BagTemplate,
  Checkpoint,
  Command,
  Config,
  InferBag,
  Interrupt,
  Metadata,
  ThreadState,
  ToolProgress,
  ToolCallWithResult,
  StreamMode,
} from '@langchain/langgraph-sdk';
import type {
  MessageMetadata,
  SubmitOptions,
} from '@langchain/langgraph-sdk/ui';
import type { BaseMessage, AIMessage as CoreAIMessage } from '@langchain/core/messages';
import type { AgentSubmitInput, AgentSubmitOptions, AgentWithHistory } from '@ngaf/chat';

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
    | `values|${string}`
    | 'messages'
    | `messages|${string}`
    | `messages/${string}`
    | `messages/${string}|${string}`
    | 'updates'
    | `updates|${string}`
    | 'tools'
    | `tools|${string}`
    | 'custom'
    | `custom|${string}`
    | 'error'
    | `error|${string}`
    | 'metadata'
    | 'checkpoints'
    | `checkpoints|${string}`
    | 'tasks'
    | `tasks|${string}`
    | 'debug'
    | `debug|${string}`
    | 'events'
    | `events|${string}`
    | 'interrupt'
    | 'interrupts';
  namespace?: string[];
  messages?: unknown[];
  messageMetadata?: Record<string, unknown>;
  [key: string]: unknown;
}

/** Strategy for handling concurrent LangGraph runs on the same thread. */
export type LangGraphMultitaskStrategy = 'reject' | 'interrupt' | 'rollback' | 'enqueue';

export type LangGraphDurability = 'exit' | 'async' | 'sync';
export type LangGraphOnCompletion = 'complete' | 'continue';
export type LangGraphOnDisconnect = 'cancel' | 'continue';

/** Options accepted by LangGraph-backed submit calls. */
export interface LangGraphSubmitOptions {
  signal?: AbortSignal;
  config?: Config;
  context?: unknown;
  checkpoint?: Omit<Checkpoint, 'thread_id'> | null;
  checkpointId?: string;
  command?: Command;
  metadata?: Metadata;
  checkpointDuring?: boolean;
  durability?: LangGraphDurability;
  interruptBefore?: '*' | string[];
  interruptAfter?: '*' | string[];
  onCompletion?: LangGraphOnCompletion;
  webhook?: string;
  onDisconnect?: LangGraphOnDisconnect;
  afterSeconds?: number;
  ifNotExists?: 'create' | 'reject';
  onRunCreated?: (params: { run_id: string; thread_id?: string }) => void;
  streamMode?: StreamMode[];
  streamSubgraphs?: boolean;
  streamResumable?: boolean;
  feedbackKeys?: string[];
  /** Convenience alias normalized to `command.resume` before invoking LangGraph. */
  resume?: unknown;
  /** Strategy for handling concurrent runs on the same thread. */
  multitaskStrategy?: LangGraphMultitaskStrategy;
}

/** A queued server-side LangGraph run. */
export interface AgentQueueEntry<T = unknown> {
  /** Server-side run ID. */
  id: string;
  /** Thread that owns the queued run. */
  threadId: string;
  /** Values submitted for the queued run. */
  values: T | null | undefined;
  /** Submit options used when the queued run was created. */
  options?: LangGraphSubmitOptions;
  /** Timestamp when the queued run was registered locally. */
  createdAt: Date;
}

/** Public queue surface for pending server-side LangGraph runs. */
export interface AgentQueue<T = unknown> {
  /** Read-only pending queue entries. */
  readonly entries: ReadonlyArray<AgentQueueEntry<T>>;
  /** Number of pending queue entries. */
  readonly size: number;
  /** Cancel a specific pending run by server run ID. */
  cancel: (id: string) => Promise<boolean>;
  /** Cancel all pending runs and clear the queue. */
  clear: () => Promise<void>;
}

/** A checkpoint entry in the experimental branch tree. */
export interface AgentBranchTreeNode<T = unknown> {
  type: 'node';
  value: ThreadState<T>;
  path: string[];
}

/** A branch fork where each item is an alternate checkpoint sequence. */
export interface AgentBranchTreeFork<T = unknown> {
  type: 'fork';
  items: AgentBranchTree<T>[];
}

/** Tree representation of LangGraph checkpoint history for time-travel UIs. */
export interface AgentBranchTree<T = unknown> {
  type: 'sequence';
  items: Array<AgentBranchTreeNode<T> | AgentBranchTreeFork<T>>;
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
    options?: LangGraphSubmitOptions,
  ): AsyncIterable<StreamEvent>;

  /** Optional: join an already-started run without creating a new one. */
  joinStream?(
    threadId: string,
    runId: string,
    lastEventId: string | undefined,
    signal: AbortSignal,
  ): AsyncIterable<StreamEvent>;

  /** Optional: create a server-side queued run without joining it immediately. */
  createQueuedRun?(
    assistantId: string,
    threadId: string,
    payload: unknown,
    signal: AbortSignal,
    options?: LangGraphSubmitOptions,
  ): Promise<AgentQueueEntry>;

  /** Optional: cancel a server-side run. */
  cancelRun?(
    threadId: string,
    runId: string,
    signal: AbortSignal,
  ): Promise<void>;

  /** Optional: load persisted checkpoint history for a thread. */
  getHistory?(
    threadId: string,
    signal: AbortSignal,
  ): Promise<ThreadState[]>;

  /**
   * Optional: update server-side thread state (e.g. to emit RemoveMessage
   * entries for regenerate rollback). Forwards to the LangGraph
   * `threads.updateState` API.
   */
  updateState?(
    threadId: string,
    values: Record<string, unknown>,
    signal: AbortSignal,
  ): Promise<void>;
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
  /** Optional human-readable subagent type/name. */
  name?: string;
  /** Current execution status of the subagent. */
  status: Signal<'pending' | 'running' | 'complete' | 'error'>;
  /** Current state values from the subagent. */
  values: Signal<Record<string, unknown>>;
  /** Messages from the subagent conversation. */
  messages: Signal<BaseMessage[]>;
}

// ── LangGraphAgent ────────────────────────────────────────────────────────────

/**
 * Unified LangGraph agent surface returned by `agent({...})`.
 *
 * Extends the runtime-neutral `AgentWithHistory` contract (chat-consumable)
 * with the full LangGraph-specific API. One object drives both `<chat>` and
 * any LangGraph-specific demo. Raw LangGraph signals are prefixed with
 * `langGraph` to avoid collision with the runtime-neutral names.
 */
export interface LangGraphAgent<T = unknown, ResolvedBag extends BagTemplate = BagTemplate>
  extends AgentWithHistory {
  // ── Raw LangGraph signals (preserve full AgentRef public surface) ─────────

  /** Raw LangChain BaseMessage list. Use `messages` for chat rendering. */
  langGraphMessages: Signal<BaseMessage[]>;

  /** All interrupts received during the current run (raw LangGraph shape). */
  langGraphInterrupts: Signal<Interrupt<ResolvedBag['InterruptType']>[]>;

  /** Raw LangGraph tool calls (with run-state). Use `toolCalls` for chat rendering. */
  langGraphToolCalls: Signal<ToolCallWithResult[]>;

  /** Raw LangGraph history (ThreadState[]). Use `history` for AgentCheckpoint[]. */
  langGraphHistory: Signal<ThreadState<T>[]>;

  /** Experimental branch tree derived from LangGraph checkpoint history. */
  experimentalBranchTree: Signal<AgentBranchTree<T>>;

  /** Submit input, resume commands, checkpoint forks, or other LangGraph run options. */
  submit: (
    input: AgentSubmitInput | null | undefined,
    opts?: AgentSubmitOptions & LangGraphSubmitOptions,
  ) => Promise<void>;

  // ── AgentRef fields preserved on the unified surface ─────────────────────

  /** Current agent state values (raw, typed per the type parameter T). */
  value: Signal<T>;

  /** True once at least one value or message has been received. */
  hasValue: Signal<boolean>;

  /** Re-submit the last input to restart the stream. */
  reload: () => void;

  /** Progress updates for currently executing tools. */
  toolProgress: Signal<ToolProgress[]>;

  /** Pending server-side runs created via `multitaskStrategy: 'enqueue'`. */
  queue: Signal<AgentQueue>;

  /** Filtered list of subagents with status 'running'. */
  activeSubagents: Signal<SubagentStreamRef[]>;

  /** Get a subagent stream by the tool call ID that spawned it. */
  getSubagent: (toolCallId: string) => SubagentStreamRef | undefined;

  /** Get subagent streams by their configured subagent type/name. */
  getSubagentsByType: (type: string) => SubagentStreamRef[];

  /** Get subagent streams spawned by the tool calls on a specific AI message. */
  getSubagentsByMessage: (msg: CoreAIMessage) => SubagentStreamRef[];

  /** Raw custom events stream (signal of array). The runtime-neutral
   *  `events$` Observable is derived from this. */
  customEvents: Signal<CustomStreamEvent[]>;

  /** Current branch identifier for time-travel navigation. */
  branch: Signal<string>;

  /** Set the active branch for time-travel navigation. */
  setBranch: (branch: string) => void;

  /** True while a thread switch is loading state from the server. */
  isThreadLoading: Signal<boolean>;

  /** Switch to a different thread, resetting derived state. */
  switchThread: (threadId: string | null) => void;

  /** Join an already-running stream by run ID. */
  joinStream: (runId: string, lastEventId?: string) => Promise<void>;

  /** Get metadata for a specific message by index. */
  getMessagesMetadata: (msg: BaseMessage, idx?: number) => MessageMetadata<Record<string, unknown>> | undefined;

  /** Get tool call results associated with an AI message (LangGraph types). */
  getToolCalls: (msg: CoreAIMessage) => ToolCallWithResult[];
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
  messageMetadata$: BehaviorSubject<Map<string, MessageMetadata<Record<string, unknown>>>>;
  subagents$:       BehaviorSubject<Map<string, SubagentStreamRef>>;
  queue$:           BehaviorSubject<AgentQueue>;
  custom$:          BehaviorSubject<CustomStreamEvent[]>;
}
