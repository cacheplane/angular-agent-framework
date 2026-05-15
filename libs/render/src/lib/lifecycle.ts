// SPDX-License-Identifier: MIT
import { InjectionToken, Signal } from '@angular/core';

export interface RenderLifecycle {
  /** First mount event in this render context. Sticky — does not reset. */
  readonly firstMountAt: Signal<{ kind: 'spec' | 'element'; elementType?: string; at: number } | null>;
  /** Total mount count since render context started. */
  readonly mountCount: Signal<number>;
  /** Epoch ms of the most recent mount event. */
  readonly lastMountAt: Signal<number | null>;
  /** Epoch ms of the most recent state-change event. */
  readonly lastStateChangeAt: Signal<number | null>;
  /** Most recent handler invocation. */
  readonly lastHandlerInvokedAt: Signal<{ action: string; at: number } | null>;
}

export const RENDER_LIFECYCLE = new InjectionToken<RenderLifecycle>('RENDER_LIFECYCLE');
