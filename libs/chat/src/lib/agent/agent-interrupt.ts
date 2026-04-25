// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

export interface AgentInterrupt {
  /** Stable identifier for this interrupt instance. */
  id: string;
  /** Opaque payload the app renders. Runtime-specific shape. */
  value: unknown;
  /** True when the runtime supports resuming via `submit({ resume })`. */
  resumable: boolean;
}
