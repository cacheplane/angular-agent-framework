// SPDX-License-Identifier: MIT
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  Injector,
  input,
  OnInit,
  runInInjectionContext,
  signal,
  type Signal,
} from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import {
  evaluateVisibility,
  resolveBindings,
  resolveElementProps,
} from '@json-render/core';
import type { Spec, UIElement } from '@json-render/core';

import { RENDER_CONTEXT } from './contexts/render-context';
import { REPEAT_SCOPE } from './contexts/repeat-scope';
import type { RepeatScope } from './contexts/repeat-scope';
import { buildPropResolutionContext } from './internals/prop-signal';
import type { AngularComponentRenderer } from './render.types';

/** Magic prefix on `emit()` strings that catalog components use to
 * write back to the data model (binding `path` and the new value). The
 * render-element's emitFn intercepts this and writes via the state
 * store, sidestepping the normal `el.on[event]` handler binding which
 * the catalog components have no way to declare for arbitrary paths. */
const A2UI_DATAMODEL_PREFIX = 'a2ui:datamodel:';

/** Best-effort string→typed coercion for datamodel writes. Catalog
 * components emit raw string values; the underlying state may have
 * been declared as number/boolean/array, and consumers reading the
 * resolved props expect the correct type. */
function coerceValue(raw: string): unknown {
  if (raw === '') return '';
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  // JSON-array passthrough (MultipleChoice emits stringified arrays)
  if (raw.startsWith('[') && raw.endsWith(']')) {
    try { return JSON.parse(raw); } catch { /* fall through */ }
  }
  // Numeric — only if the entire string parses cleanly as a number
  if (/^-?\d+(?:\.\d+)?$/.test(raw)) {
    const n = Number(raw);
    if (!Number.isNaN(n)) return n;
  }
  return raw;
}

/**
 * Recursive element renderer.
 *
 * For each element key it:
 * 1. Looks up the UIElement from spec.elements
 * 2. Resolves the component class from the registry
 * 3. Evaluates visibility
 * 4. Resolves prop expressions and bindings
 * 5. Renders via NgComponentOutlet with resolved inputs
 *
 * For elements with `repeat`, it iterates over the state array,
 * creating a child Injector with RepeatScope for each item.
 */
@Component({
  selector: 'render-element',
  standalone: true,
  imports: [NgComponentOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!element()?.repeat) {
      @if (visible()) {
        <ng-container
          *ngComponentOutlet="mountClass(); inputs: resolvedInputs(); injector: parentInjector"
        />
      }
    } @else {
      @for (repeatInjector of repeatInjectors(); track $index) {
        <ng-container
          *ngComponentOutlet="mountClass(); inputs: repeatInputs()[$index]; injector: repeatInjector"
        />
      }
    }
  `,
})
export class RenderElementComponent implements OnInit {
  readonly elementKey = input.required<string>();
  readonly spec = input.required<Spec>();

  private readonly ctx = inject(RENDER_CONTEXT);
  private readonly repeatScope = inject(REPEAT_SCOPE, { optional: true });
  readonly parentInjector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    this.destroyRef.onDestroy(() => {
      const el = this.element();
      if (el && (el as any)['lifecycle'] && this.ctx.emitEvent) {
        this.ctx.emitEvent({
          type: 'lifecycle',
          event: 'destroyed',
          scope: 'element',
          elementKey: this.elementKey(),
          elementType: el.type,
        });
      }
    });

    // Latch mountedReal=true once the real component is selected. Lives in
    // an effect (not the computed) because Angular forbids signal writes
    // inside computed — they're for derivation only. Effects are the
    // idiomatic place for "signal change → signal write" side effects.
    effect(() => {
      if (this.mountedReal()) return;
      const el = this.element();
      if (!el) return;
      // Only latch when notReady is false AND a real component is registered.
      if (!this.notReady() && this.ctx.registry.get(el.type)) {
        this.mountedReal.set(true);
      }
    });
  }

  ngOnInit(): void {
    const el = this.element();
    if (el && (el as any)['lifecycle'] && this.ctx.emitEvent) {
      this.ctx.emitEvent({
        type: 'lifecycle',
        event: 'mounted',
        scope: 'element',
        elementKey: this.elementKey(),
        elementType: el.type,
      });
    }
  }

  /** The UIElement definition from the spec. Only propagates when reference changes. */
  readonly element: Signal<UIElement | undefined> = computed(
    () => this.spec()?.elements?.[this.elementKey()],
    { equal: Object.is },
  );

  /** The Angular component class for this element type. */
  readonly componentClass = computed<AngularComponentRenderer | null>(() => {
    const el = this.element();
    if (!el) return null;
    return this.ctx.registry.get(el.type) ?? null;
  });

  /** Prop resolution context built from store + repeat scope. */
  private readonly propCtx = computed(() =>
    buildPropResolutionContext(
      this.ctx.store,
      this.repeatScope ?? undefined,
      this.ctx.functions,
    ),
  );

  /** Once real mounts, never revert to fallback even if a state-bound
   *  prop later becomes undefined. Per-instance monotonic gate. */
  private readonly mountedReal = signal<boolean>(false);

  /** True when ANY resolved prop value is undefined (i.e. a state
   *  binding points at a path the store hasn't populated). Framework-
   *  injected keys (bindings, emit, loading, childKeys, spec) are
   *  excluded — only consumer-resolved props matter for readiness. */
  readonly notReady = computed<boolean>(() => {
    if (this.mountedReal()) return false;
    const el = this.element();
    if (!el || !el.props) return false;
    const resolved = resolveElementProps(el.props, this.propCtx());
    for (const v of Object.values(resolved)) {
      if (v === undefined) return true;
    }
    return false;
  });

  /** Picks fallback or real based on notReady. The mountedReal latch is
   *  driven by a constructor effect (not this computed) — Angular forbids
   *  signal writes inside computed. */
  readonly mountClass = computed<AngularComponentRenderer | null>(() => {
    const el = this.element();
    if (!el) return null;
    const real = this.ctx.registry.get(el.type) ?? null;
    if (this.notReady()) {
      return this.ctx.registry.getFallback(el.type) ?? null;
    }
    return real;
  });

  /** Whether the element is visible (non-repeat path). */
  readonly visible = computed(() => {
    const el = this.element();
    if (!el) return false;
    if (this.mountClass() === null) return false;
    return evaluateVisibility(el.visible, this.propCtx());
  });

  /** Emit function that delegates to context handlers AND handles the
   * canonical `a2ui:datamodel:<path>:<value>` write-back protocol that
   * input components (TextField, MultipleChoice, CheckBox, Slider,
   * DateTimeInput) emit when the user changes their value. The render
   * lib's state store is the single source of truth for in-surface UI
   * state; writing through it triggers re-render with the new value
   * and re-evaluates any path-bound props (validation, computed
   * visibility, etc.).
   *
   * The string format is `a2ui:datamodel:<path>:<value>` where:
   *   - `<path>` is a JSON-Pointer-style path (e.g. `/name`, `/form/email`)
   *   - `<value>` is the raw value rendered as a string. We attempt to
   *     coerce numeric and boolean literals back to their typed form
   *     so downstream consumers see correct types; arrays come through
   *     as JSON-stringified payloads (catalog components emit them via
   *     `JSON.stringify`).
   */
  private readonly emitFn = (event: string) => {
    if (event.startsWith(A2UI_DATAMODEL_PREFIX)) {
      this.applyDatamodelWrite(event);
      return;
    }
    const el = this.element();
    if (!el?.on) return;
    const binding = el.on[event];
    if (!binding) return;
    const bindings = Array.isArray(binding) ? binding : [binding];
    for (const b of bindings) {
      const handler = this.ctx.handlers?.[b.action];
      if (handler) {
        runInInjectionContext(this.parentInjector, () =>
          handler(b.params as Record<string, unknown> ?? {}),
        );
      }
    }
  };

  private applyDatamodelWrite(event: string): void {
    // Strip the prefix, then split path and value at the last `:` —
    // path may itself contain `:` characters (rare but legal in
    // JSON-Pointer per RFC 6901), and values can certainly contain
    // them (URLs, time strings). Catalog components emit
    // `a2ui:datamodel:<path>:<value>` where path is the binding's
    // path-ref (usually starts with `/`); split the LAST `:` because
    // the value is the only field guaranteed to come last.
    const rest = event.slice(A2UI_DATAMODEL_PREFIX.length);
    const lastColon = rest.lastIndexOf(':');
    if (lastColon === -1) return;
    const path = rest.slice(0, lastColon);
    const rawValue = rest.slice(lastColon + 1);
    if (!path) return;
    const store = this.ctx.store;
    if (!store) return;
    store.set(path, coerceValue(rawValue));
  }

  /** Resolved inputs for non-repeat elements. */
  readonly resolvedInputs = computed(() => {
    const el = this.element();
    if (!el) return {};
    const ctx = this.propCtx();
    const resolved = resolveElementProps(el.props ?? {}, ctx);
    const bindings = resolveBindings(el.props ?? {}, ctx);
    return {
      ...resolved,
      bindings,
      emit: this.emitFn,
      loading: this.ctx.loading ?? false,
      childKeys: el.children ?? [],
      spec: this.spec(),
    };
  });

  // --- Repeat support ---

  /** Items from the state array for repeat elements. */
  private readonly repeatItems = computed<unknown[]>(() => {
    const el = this.element();
    if (!el?.repeat) return [];
    const items = this.ctx.store.get(el.repeat.statePath);
    return Array.isArray(items) ? items : [];
  });

  /** One RepeatScope per repeat item, shared between injectors and inputs. */
  private readonly repeatScopes = computed(() => {
    const el = this.element();
    if (!el?.repeat) return [];
    return this.repeatItems().map((item, index) => ({
      item,
      index,
      basePath: `${el.repeat!.statePath}/${index}`,
    } satisfies RepeatScope));
  });

  /** One child Injector per repeat item, providing RepeatScope. */
  readonly repeatInjectors = computed(() => {
    return this.repeatScopes().map(scope =>
      Injector.create({
        providers: [{ provide: REPEAT_SCOPE, useValue: scope }],
        parent: this.parentInjector,
      }),
    );
  });

  /** Resolved inputs for each repeat item. */
  readonly repeatInputs = computed(() => {
    const el = this.element();
    if (!el?.repeat) return [];
    return this.repeatScopes().map(scope => {
      const ctx = buildPropResolutionContext(
        this.ctx.store,
        scope,
        this.ctx.functions,
      );
      const resolved = resolveElementProps(el.props ?? {}, ctx);
      const bindings = resolveBindings(el.props ?? {}, ctx);
      return {
        ...resolved,
        bindings,
        emit: this.emitFn,
        loading: this.ctx.loading ?? false,
        childKeys: el.children ?? [],
        spec: this.spec(),
      };
    });
  });
}
