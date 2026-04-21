// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

/**
 * Runtime-neutral custom event shape flowing through `ChatAgent.customEvents$`.
 *
 * The only required field is `type` — a string discriminator consumers switch
 * on. All other fields pass through verbatim from the source runtime, which
 * lets AG-UI, LangGraph, a2ui, and json-render emit their own event shapes
 * without the core contract owning their union.
 *
 * Adapters are responsible for normalising their native shape to include a
 * `type` field (e.g., `toChatAgent` aliases LangGraph's `name` to `type`).
 */
export interface ChatCustomEvent {
  readonly type: string;
  readonly [key: string]: unknown;
}
