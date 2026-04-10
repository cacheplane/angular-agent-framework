// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  OnInit,
  output,
} from '@angular/core';
import type { ComputedFunction, Spec, StateStore } from '@json-render/core';

import { RenderElementComponent } from './render-element.component';
import { RENDER_CONFIG } from './provide-render';
import { RENDER_CONTEXT } from './contexts/render-context';
import type { RenderContext } from './contexts/render-context';
import type { AngularRegistry } from './render.types';
import { signalStateStore } from './signal-state-store';
import type { RenderEvent } from './render-event';

/**
 * Top-level entry point for rendering a json-render spec.
 *
 * Accepts the spec, registry, store, functions, handlers, and loading
 * as inputs. Provides `RENDER_CONTEXT` to child `RenderElementComponent`
 * instances via `viewProviders`.
 *
 * Falls back to `RENDER_CONFIG` (from `provideRender()`) for registry
 * and store defaults when inputs are not provided.
 *
 * @example
 * ```html
 * <render-spec [spec]="spec()" [registry]="registry" [store]="store" />
 * ```
 */
@Component({
  selector: 'render-spec',
  standalone: true,
  imports: [RenderElementComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  viewProviders: [
    {
      provide: RENDER_CONTEXT,
      useFactory: () => inject(RenderSpecComponent)._context(),
    },
  ],
  template: `
    @if (spec()?.root; as rootKey) {
      <render-element [elementKey]="rootKey" [spec]="spec()!" />
    }
  `,
})
export class RenderSpecComponent implements OnInit {
  readonly spec = input<Spec | null>(null);
  readonly registry = input<AngularRegistry | undefined>(undefined);
  readonly store = input<StateStore | undefined>(undefined);
  readonly functions = input<Record<string, ComputedFunction> | undefined>(undefined);
  readonly handlers = input<Record<string, (params: Record<string, unknown>) => unknown | Promise<unknown>> | undefined>(undefined);
  readonly loading = input<boolean>(false);
  readonly events = output<RenderEvent>();

  private readonly config = inject(RENDER_CONFIG, { optional: true });
  private readonly destroyRef = inject(DestroyRef);

  /** Internal store, lazily created once and reused across spec changes. */
  private _internalStore: StateStore | undefined;

  private getOrCreateInternalStore(): StateStore {
    if (!this._internalStore) {
      this._internalStore = signalStateStore(this.spec()?.state ?? {});
    }
    return this._internalStore;
  }

  /** Resolved store: input > config > internal (from spec.state). */
  private readonly resolvedStore = computed<StateStore>(() => {
    const inputStore = this.store();
    if (inputStore) return inputStore;
    const configStore = this.config?.store;
    if (configStore) return configStore;
    return this.getOrCreateInternalStore();
  });

  /** Resolved registry: input > config. */
  private readonly resolvedRegistry = computed<AngularRegistry>(() => {
    const inputRegistry = this.registry();
    if (inputRegistry) return inputRegistry;
    const configRegistry = this.config?.registry;
    if (configRegistry) return configRegistry;
    // Fallback: empty registry
    return { get: () => undefined, names: () => [] };
  });

  /** Wraps input handlers to emit RenderHandlerEvent after execution. */
  private readonly wrappedHandlers = computed(() => {
    const inputHandlers = this.handlers() ?? this.config?.handlers;
    if (!inputHandlers) return undefined;
    const wrapped: Record<string, (params: Record<string, unknown>) => unknown | Promise<unknown>> = {};
    for (const [name, handler] of Object.entries(inputHandlers)) {
      wrapped[name] = (params: Record<string, unknown>) => {
        const result = handler(params);
        if (result instanceof Promise) {
          result.then(
            (r) => {
              this.events.emit({ type: 'handler', action: name, params, result: r });
            },
            () => {
              this.events.emit({ type: 'handler', action: name, params, result: undefined });
            },
          );
        } else {
          this.events.emit({ type: 'handler', action: name, params, result });
        }
        return result;
      };
    }
    return wrapped;
  });

  /** Emits a RenderEvent through the events output. */
  private readonly emitEvent = (event: RenderEvent) => {
    this.events.emit(event);
  };

  /** The RenderContext provided to children via viewProviders. */
  readonly _context = computed<RenderContext>(() => ({
    registry: this.resolvedRegistry(),
    store: this.resolvedStore(),
    functions: this.functions() ?? this.config?.functions,
    handlers: this.wrappedHandlers(),
    emitEvent: this.emitEvent,
    loading: this.loading(),
  }));

  constructor() {
    // Subscribe to store changes and emit state change events
    effect(() => {
      const store = this.resolvedStore();
      const unsub = store.subscribe(() => {
        const snapshot = store.getSnapshot() as Record<string, unknown>;
        this.events.emit({
          type: 'stateChange',
          path: '/',
          value: snapshot,
          snapshot,
        });
      });
      this.destroyRef.onDestroy(unsub);
    });

    this.destroyRef.onDestroy(() => {
      this.events.emit({ type: 'lifecycle', event: 'destroyed', scope: 'spec' });
    });
  }

  ngOnInit(): void {
    this.events.emit({ type: 'lifecycle', event: 'mounted', scope: 'spec' });
  }
}
