// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { ChatContentBlock } from './chat-content-block';

export interface ChatSubmitInput {
  /** New user message to append. May be combined with `resume` and/or `state` in the same submit call. */
  message?: string | ChatContentBlock[];
  /** Resume payload for an active interrupt. */
  resume?: unknown;
  /** State patch to merge before submitting (runtime-interpreted). */
  state?: Record<string, unknown>;
}

export interface ChatSubmitOptions {
  signal?: AbortSignal;
}
