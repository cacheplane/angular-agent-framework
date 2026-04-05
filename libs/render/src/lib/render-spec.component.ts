// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import type { ComputedFunction, Spec, StateStore } from '@json-render/core';

import { RenderElementComponent } from './render-element.component';
import { RENDER_CONFIG } from './provide-render';
import { RENDER_CONTEXT } from './contexts/render-context';
import type { RenderContext } from './contexts/render-context';
import type { AngularRegistry } from './render.types';
import { signalStateStore } from './signal-state-store';

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
export class RenderSpecComponent {
  readonly spec = input<Spec | null>(null);
  readonly registry = input<AngularRegistry | undefined>(undefined);
  readonly store = input<StateStore | undefined>(undefined);
  readonly functions = input<Record<string, ComputedFunction> | undefined>(undefined);
  readonly handlers = input<Record<string, (params: Record<string, unknown>) => unknown | Promise<unknown>> | undefined>(undefined);
  readonly loading = input<boolean>(false);

  private readonly config = inject(RENDER_CONFIG, { optional: true });

  /** Internal store, created from spec.state when no external store is provided. */
  private readonly internalStore = computed<StateStore | undefined>(() => {
    const spec = this.spec();
    if (!spec?.state) return undefined;
    return signalStateStore(spec.state);
  });

  /** Resolved store: input > config > internal (from spec.state). */
  private readonly resolvedStore = computed<StateStore>(() => {
    const inputStore = this.store();
    if (inputStore) return inputStore;
    const configStore = this.config?.store;
    if (configStore) return configStore;
    const internal = this.internalStore();
    if (internal) return internal;
    // Fallback: empty store
    return signalStateStore({});
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

  /** The RenderContext provided to children via viewProviders. */
  readonly _context = computed<RenderContext>(() => ({
    registry: this.resolvedRegistry(),
    store: this.resolvedStore(),
    functions: this.functions() ?? this.config?.functions,
    handlers: this.handlers() ?? this.config?.handlers,
    loading: this.loading(),
  }));
}
