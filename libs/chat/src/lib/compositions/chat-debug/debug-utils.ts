// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { ChatCheckpoint } from '../../agent';
import type { DebugCheckpoint } from './debug-checkpoint-card.component';

export function toDebugCheckpoint(cp: ChatCheckpoint, index: number): DebugCheckpoint {
  return {
    node: cp.label ?? `Step ${index + 1}`,
    checkpointId: cp.id,
  };
}

export function extractStateValues(cp: ChatCheckpoint | undefined): Record<string, unknown> {
  return cp?.values ?? {};
}
