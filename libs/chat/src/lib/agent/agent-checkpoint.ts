// SPDX-License-Identifier: MIT

/**
 * Runtime-neutral snapshot of a point in an agent's execution history.
 *
 * Consumed by time-travel / debug UIs. `id` is adapter-opaque — UIs emit
 * it back to the parent app on replay/fork, and the parent app dispatches
 * to the underlying runtime.
 */
export interface AgentCheckpoint {
  /** Adapter-opaque checkpoint identifier (e.g. LangGraph checkpoint_id). */
  id?: string;
  /** Human-friendly label for the checkpoint (e.g. next node name). */
  label?: string;
  /** State snapshot at this checkpoint. */
  values: Record<string, unknown>;
}
