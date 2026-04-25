// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

/**
 * Render-state-store sync event. Adapters emit this when the runtime
 * publishes a state-snapshot intended for the chat library's render store
 * (used by generative UI and a2ui surfaces).
 */
export interface AgentStateUpdateEvent {
  readonly type: 'state_update';
  readonly data: Record<string, unknown>;
}

/**
 * Escape hatch for runtime-specific or user-defined events that do not
 * (yet) have a well-known structured variant. `name` carries the runtime
 * event name; `data` carries the payload verbatim.
 */
export interface AgentCustomEvent {
  readonly type: 'custom';
  readonly name: string;
  readonly data: unknown;
}

/**
 * Discriminated union of events flowing on `Agent.events$`.
 *
 * Invariant: state lives on signals (`messages`, `status`, `toolCalls`,
 * `state`, `interrupt`, `subagents`, `history`); events on `events$`
 * carry only things that are not derivable from signals. New variants
 * are added purely additively when patterns prove necessary.
 */
export type AgentEvent = AgentStateUpdateEvent | AgentCustomEvent;
