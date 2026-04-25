// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { ContentBlock } from './content-block';

export interface AgentSubmitInput {
  /** New user message to append. May be combined with `resume` and/or `state` in the same submit call. */
  message?: string | ContentBlock[];
  /** Resume payload for an active interrupt. */
  resume?: unknown;
  /** State patch to merge before submitting (runtime-interpreted). */
  state?: Record<string, unknown>;
}

export interface AgentSubmitOptions {
  signal?: AbortSignal;
}
