// SPDX-License-Identifier: MIT
import type { Signal } from '@angular/core';
import type { Observable } from 'rxjs';
import type { Message } from './message';
import type { ToolCall } from './tool-call';
import type { AgentStatus } from './agent-status';
import type { AgentInterrupt } from './agent-interrupt';
import type { Subagent } from './subagent';
import type { AgentEvent } from './agent-event';
import type { AgentSubmitInput, AgentSubmitOptions } from './agent-submit';

/**
 * Runtime-neutral contract chat primitives consume.
 *
 * Implementations are produced by runtime adapters (e.g. a LangGraph or
 * AG-UI adapter) or by user code for custom backends.
 *
 * `interrupt` and `subagents` are optional: runtimes that do not support these
 * concepts should leave them undefined, and primitives that need them check
 * presence and render a neutral fallback when absent.
 *
 * Invariant: state lives on signals; `events$` carries only things that are
 * not derivable from signals.
 */
export interface Agent {
  // Core state
  messages:  Signal<Message[]>;
  status:    Signal<AgentStatus>;
  isLoading: Signal<boolean>;
  error:     Signal<unknown>;
  toolCalls: Signal<ToolCall[]>;
  state:     Signal<Record<string, unknown>>;

  // Actions
  submit: (input: AgentSubmitInput, opts?: AgentSubmitOptions) => Promise<void>;
  stop:   () => Promise<void>;

  /**
   * Discards the assistant message at the given index AND all messages after
   * it, then re-runs the agent against the trimmed conversation tail. The
   * preceding user message (at index - 1) is preserved and re-submitted as
   * the agent's input. No new user message is added to the history.
   *
   * Throws if the message at `index` is not 'assistant' role, or if the
   * agent is currently loading another response.
   */
  regenerate: (assistantMessageIndex: number) => Promise<void>;

  // Extended (optional; absent when runtime does not support)
  interrupt?: Signal<AgentInterrupt | undefined>;
  subagents?: Signal<Map<string, Subagent>>;

  // Events stream (required; emit EMPTY if runtime produces no events)
  events$: Observable<AgentEvent>;
}
