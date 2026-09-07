import { Injectable, signal, type Signal } from '@angular/core';
import type { AgentLifecycle } from './lifecycle';

/**
 * Application-wide registry of every live agent's {@link AgentLifecycle}.
 *
 * It is `providedIn: 'root'`, so it always exists and every agent registers
 * into the same instance regardless of which injector built it — an agent
 * created in a route or component injector is still visible from the root.
 * External instrumentation packages read `lifecycles()` to observe every agent
 * in the application without owning the provider graph.
 *
 * Registration is scoped to the agent's lifetime: an agent unregisters when the
 * injector that created it is destroyed, so `lifecycles()` never accumulates
 * lifecycles for agents that are gone.
 */
@Injectable({ providedIn: 'root' })
export class AgentLifecycleRegistry {
  private readonly _lifecycles = signal<readonly AgentLifecycle[]>([]);

  /** Reactive list of the lifecycles of every currently live agent. */
  readonly lifecycles: Signal<readonly AgentLifecycle[]> = this._lifecycles.asReadonly();

  register(lifecycle: AgentLifecycle): void {
    this._lifecycles.update((curr) => [...curr, lifecycle]);
  }

  /** Drop a lifecycle when its agent's injector is destroyed. */
  unregister(lifecycle: AgentLifecycle): void {
    this._lifecycles.update((curr) => curr.filter((l) => l !== lifecycle));
  }
}
