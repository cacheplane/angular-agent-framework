// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { Signal } from '@angular/core';
import type { Message } from './message';

export type SubagentStatus = 'pending' | 'running' | 'complete' | 'error';

export interface Subagent {
  /** Tool call ID that spawned this subagent. */
  toolCallId: string;
  /** Optional human-readable name. */
  name?: string;
  status: Signal<SubagentStatus>;
  messages: Signal<Message[]>;
  state: Signal<Record<string, unknown>>;
}
