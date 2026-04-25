// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { Signal } from '@angular/core';
import type { Observable } from 'rxjs';
import type { Message } from './message';
import type { ToolCall } from './tool-call';
import type { AgentStatus } from './agent-status';
import type { AgentInterrupt } from './agent-interrupt';
import type { Subagent } from './subagent';
import type { AgentCustomEvent } from './agent-custom-event';
import type { AgentSubmitInput, AgentSubmitOptions } from './agent-submit';

/**
 * Runtime-neutral contract chat primitives consume.
 *
 * Implementations are produced by runtime adapters (e.g. a LangGraph or
 * AG-UI adapter) or by user code for custom backends.
 *
 * `interrupt`, `subagents`, and `customEvents$` are optional: runtimes that
 * do not support these concepts should leave them undefined, and primitives
 * that need them check presence and render a neutral fallback when absent.
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

  // Extended (optional; absent when runtime does not support)
  interrupt?:     Signal<AgentInterrupt | undefined>;
  subagents?:     Signal<Map<string, Subagent>>;
  customEvents$?: Observable<AgentCustomEvent>;
}
