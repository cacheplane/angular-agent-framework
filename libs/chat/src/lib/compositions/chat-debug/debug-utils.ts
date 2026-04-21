// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { ThreadState } from '@cacheplane/langgraph';
import type { DebugCheckpoint } from './debug-checkpoint-card.component';

/**
 * Derives a DebugCheckpoint from a ThreadState entry.
 */
export function toDebugCheckpoint(state: ThreadState<any>, index: number): DebugCheckpoint {
  const node = state.next?.[0] ?? `Step ${index + 1}`;
  const checkpointId = state.checkpoint?.checkpoint_id ?? undefined;
  return { node, checkpointId };
}

/**
 * Extracts state values from a ThreadState, returning an empty object if unavailable.
 */
export function extractStateValues(state: ThreadState<any> | undefined): Record<string, unknown> {
  if (!state) return {};
  const vals = state.values;
  if (typeof vals === 'object' && vals !== null && !Array.isArray(vals)) {
    return vals as Record<string, unknown>;
  }
  return {};
}
