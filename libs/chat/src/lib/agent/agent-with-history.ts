// SPDX-License-Identifier: MIT
import type { Signal } from '@angular/core';
import type { Agent } from './agent';
import type { AgentCheckpoint } from './agent-checkpoint';

/**
 * Extension of Agent that exposes checkpoint history for time-travel UIs.
 *
 * Concrete adapters that record per-node checkpoints (e.g. LangGraph) should
 * implement this. Pure request/response runtimes that don't have checkpoints
 * should implement plain Agent.
 */
export interface AgentWithHistory<S = unknown> extends Agent {
  history: Signal<AgentCheckpoint[]>;
  /**
   * Optional reactive map of `messageId → checkpointId`, computed by
   * walking history once: for each checkpoint, find the most recent
   * assistant message present in its `values.messages` and pair them.
   * UIs use this to anchor inline checkpoint markers on each assistant
   * turn. Missing on adapters that don't compute it.
   */
  messageCheckpoints?: Signal<ReadonlyMap<string, string>>;
}
