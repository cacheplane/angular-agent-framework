// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { Signal } from '@angular/core';
import type { ChatAgent } from './chat-agent';
import type { ChatCheckpoint } from './chat-checkpoint';

/**
 * Extends ChatAgent with a required `history` signal.
 *
 * Compositions that need time-travel / checkpoint data (chat-timeline,
 * chat-debug) take this richer contract. Adapters that cannot supply
 * history should return plain ChatAgent instead of stubbing an empty array.
 */
export interface ChatAgentWithHistory extends ChatAgent {
  history: Signal<ChatCheckpoint[]>;
}
