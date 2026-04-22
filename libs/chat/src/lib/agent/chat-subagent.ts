// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { Signal } from '@angular/core';
import type { ChatMessage } from './chat-message';

export type ChatSubagentStatus = 'pending' | 'running' | 'complete' | 'error';

export interface ChatSubagent {
  /** Tool call ID that spawned this subagent. */
  toolCallId: string;
  /** Optional human-readable name. */
  name?: string;
  status: Signal<ChatSubagentStatus>;
  messages: Signal<ChatMessage[]>;
  state: Signal<Record<string, unknown>>;
}
