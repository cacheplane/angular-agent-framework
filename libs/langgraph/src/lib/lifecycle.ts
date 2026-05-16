// SPDX-License-Identifier: MIT
import { InjectionToken, Signal } from '@angular/core';

export interface AgentLifecycle {
  /** Epoch ms of the first stream chunk arrival. Resets on clearThread. */
  readonly streamStartedAt: Signal<number | null>;
  /** Epoch ms + classification of the most recent stream error. Resets on clearThread. */
  readonly streamErrorAt: Signal<{ at: number; classification: string } | null>;
  /** Epoch ms of the first interrupt$ non-null in this stream. Resets on clearThread. */
  readonly interruptReceivedAt: Signal<number | null>;
  /** Epoch ms of the most recent submit({ interrupt }) call. Resets on clearThread. */
  readonly interruptResolvedAt: Signal<number | null>;
  /** Epoch ms when the agent's "create new thread" branch fired. Resets on clearThread. */
  readonly threadCreatedAt: Signal<number | null>;
  /** Epoch ms when an existing thread was restored from server (proves persistence). Resets on clearThread. */
  readonly threadPersistedAt: Signal<number | null>;
  /** Epoch ms of the first tool call append. Resets on clearThread. */
  readonly toolCallStartedAt: Signal<number | null>;
  /** Epoch ms of the first tool call result transition. Resets on clearThread. */
  readonly toolCallCompletedAt: Signal<number | null>;
}

export const AGENT_LIFECYCLE = new InjectionToken<AgentLifecycle>('AGENT_LIFECYCLE');
