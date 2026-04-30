// SPDX-License-Identifier: MIT
import type { Signal } from '@angular/core';
import type { Agent } from './agent';
import type { AgentCheckpoint } from './agent-checkpoint';

/**
 * Extends Agent with a required `history` signal.
 *
 * Compositions that need time-travel / checkpoint data (chat-timeline,
 * chat-debug) take this richer contract. Adapters that cannot supply
 * history should return plain Agent instead of stubbing an empty array.
 */
export interface AgentWithHistory extends Agent {
  history: Signal<AgentCheckpoint[]>;
}
