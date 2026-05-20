// SPDX-License-Identifier: MIT
import { effect, type Signal } from '@angular/core';
import type { LangGraphAgent } from '../agent.types';

/**
 * Call `fn` whenever the agent's status transitions out of `'running'`
 * (i.e. when a run completes — success, error, or interrupt). Useful
 * for refreshing thread lists, telemetry, or any other state that
 * lags the agent.
 *
 * Must be called within an injection context (constructor or
 * `runInInjectionContext`) — uses Angular's `effect` under the hood.
 *
 * @example
 * ```ts
 * constructor() {
 *   refreshOnRunEnd(this.agent, () => this.threads.refresh());
 * }
 * ```
 */
export function refreshOnRunEnd(agent: LangGraphAgent, fn: () => void | Promise<void>): void {
  let lastStatus = agent.status();
  effect(() => {
    const status = agent.status();
    if (lastStatus === 'running' && status !== 'running') {
      void fn();
    }
    lastStatus = status;
  });
}

/**
 * Call `fn` whenever any of the watched signals transitions from a
 * truthy "active" value to a non-active value. Generic version of
 * {@link refreshOnRunEnd} for callers tracking custom state machines.
 *
 * Must be called within an injection context.
 */
export function refreshOnTransition<T>(
  watch: Signal<T>,
  isActive: (v: T) => boolean,
  fn: () => void | Promise<void>,
): void {
  let lastActive = isActive(watch());
  effect(() => {
    const active = isActive(watch());
    if (lastActive && !active) void fn();
    lastActive = active;
  });
}
