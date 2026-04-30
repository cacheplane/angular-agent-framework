// SPDX-License-Identifier: MIT
import type { AgentCheckpoint } from '../../agent';
import type { DebugCheckpoint } from './debug-checkpoint-card.component';

export function toDebugCheckpoint(cp: AgentCheckpoint, index: number): DebugCheckpoint {
  return {
    node: cp.label ?? `Step ${index + 1}`,
    checkpointId: cp.id,
  };
}

export function extractStateValues(cp: AgentCheckpoint | undefined): Record<string, unknown> {
  return cp?.values ?? {};
}
