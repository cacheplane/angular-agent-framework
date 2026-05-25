// SPDX-License-Identifier: MIT
import { Injectable, signal, type Signal } from '@angular/core';
import type { AgentLifecycle } from './lifecycle';

/**
 * Optional registry that collects per-instance agent lifecycles within
 * an Angular injection context. External instrumentation packages
 * (e.g. cockpit-telemetry) provide this token and read from it.
 *
 * `@threadplane/langgraph` does NOT provide this itself — `agent()` writes to
 * the registry only when an external consumer has provided it.
 */
@Injectable()
export class AgentLifecycleRegistry {
  private readonly _lifecycles = signal<readonly AgentLifecycle[]>([]);

  /** Reactive list of registered lifecycles. */
  readonly lifecycles: Signal<readonly AgentLifecycle[]> = this._lifecycles.asReadonly();

  register(lifecycle: AgentLifecycle): void {
    this._lifecycles.update((curr) => [...curr, lifecycle]);
  }
}
