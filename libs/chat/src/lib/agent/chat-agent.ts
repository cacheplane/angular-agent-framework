// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { Signal } from '@angular/core';
import type { Observable } from 'rxjs';
import type { ChatMessage } from './chat-message';
import type { ChatToolCall } from './chat-tool-call';
import type { ChatStatus } from './chat-status';
import type { ChatInterrupt } from './chat-interrupt';
import type { ChatSubagent } from './chat-subagent';
import type { ChatCustomEvent } from './chat-custom-event';
import type { ChatSubmitInput, ChatSubmitOptions } from './chat-submit';

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
export interface ChatAgent {
  // Core state
  messages:  Signal<ChatMessage[]>;
  status:    Signal<ChatStatus>;
  isLoading: Signal<boolean>;
  error:     Signal<unknown>;
  toolCalls: Signal<ChatToolCall[]>;
  state:     Signal<Record<string, unknown>>;

  // Actions
  submit: (input: ChatSubmitInput, opts?: ChatSubmitOptions) => Promise<void>;
  stop:   () => Promise<void>;

  // Extended (optional; absent when runtime does not support)
  interrupt?:     Signal<ChatInterrupt | undefined>;
  subagents?:     Signal<Map<string, ChatSubagent>>;
  customEvents$?: Observable<ChatCustomEvent>;
}
