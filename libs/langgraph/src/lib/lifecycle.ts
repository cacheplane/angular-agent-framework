// SPDX-License-Identifier: MIT
import { InjectionToken, Signal } from '@angular/core';

export interface AgentLifecycle {
  /** Epoch ms of the first stream chunk arrival. Resets on switchThread(). */
  readonly streamStartedAt: Signal<number | null>;
  /** Epoch ms + classification of the most recent stream error. Resets on switchThread(). */
  readonly streamErrorAt: Signal<{ at: number; classification: string } | null>;
  /** Epoch ms of the first interrupt$ non-null in this stream. Resets on switchThread(). */
  readonly interruptReceivedAt: Signal<number | null>;
  /** Epoch ms of the most recent submit({ resume }) call. Resets on switchThread(). */
  readonly interruptResolvedAt: Signal<number | null>;
  /** Epoch ms when the agent's "create new thread" branch fired. Resets on switchThread(). */
  readonly threadCreatedAt: Signal<number | null>;
  /** Epoch ms when an existing thread was restored from server (proves persistence). Resets on switchThread(). */
  readonly threadPersistedAt: Signal<number | null>;
  /** Epoch ms of the first tool call append. Resets on switchThread(). */
  readonly toolCallStartedAt: Signal<number | null>;
  /** Epoch ms of the first tool call result transition. Resets on switchThread(). */
  readonly toolCallCompletedAt: Signal<number | null>;
}

export const AGENT_LIFECYCLE = new InjectionToken<AgentLifecycle>('AGENT_LIFECYCLE');
