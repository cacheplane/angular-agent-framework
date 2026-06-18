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
  reflectComponentType,
  runInInjectionContext,
  signal,
  type Signal,
  type Type,
} from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import {
  evaluateVisibility,
  resolveBindings,
  resolveElementProps,
} from '@json-render/core';
import type { Spec, UIElement } from '@json-render/core';

import { RENDER_CONTEXT } from './contexts/render-context';
import { RENDER_HOST, type RenderHost } from './contexts/render-host';
import { REPEAT_SCOPE } from './contexts/repeat-scope';
import type { RepeatScope } from './contexts/repeat-scope';
import { buildPropResolutionContext } from './internals/prop-signal';
import { isElementReady } from './internals/element-readiness';
import type { AngularComponentRenderer, NormalizedEntry } from './render.types';

/** Cache of declared input names per component class. NgComponentOutlet
 * passes every key in its `inputs` prop to the target; Angular dev mode
 * raises NG0303 for any input the component doesn't declare. We strip
 * undeclared keys before mounting so simple view components (`StatCard`,
 * `Container`, etc.) don't get spammed with framework-only inputs
 * (`bindings`, `emit`, `loading`, `childKeys`, `spec`) they ignore. */
/** `null` means reflection failed (likely uncompiled / non-component) — in
 * that case we pass inputs through unmodified rather than swallow them.
 * An empty Set means the component genuinely declares zero inputs (e.g. a
 * pure presentational fallback) and ALL keys should be dropped. */
const declaredInputsCache = new WeakMap<Type<unknown>, Set<string> | null>();
function getDeclaredInputs(cls: Type<unknown>): Set<string> | null {
  if (declaredInputsCache.has(cls)) return declaredInputsCache.get(cls)!;
  const meta = reflectComponentType(cls);
  const result = meta ? new Set<string>(meta.inputs.map(i => i.templateName)) : null;
  declaredInputsCache.set(cls, result);
  return result;
}
function filterInputsForClass(
  cls: Type<unknown> | null,
  inputs: Record<string, unknown>,
): Record<string, unknown> {
  if (!cls) return inputs;
  const declared = getDeclaredInputs(cls);
  if (declared === null) return inputs;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(inputs)) {
    if (declared.has(k)) out[k] = v;
  }
  return out;
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
  providers: [
    { provide: RENDER_HOST, useFactory: (el: RenderElementComponent) => el.host, deps: [RenderElementComponent] },
  ],
  template: `
    @if (!element()?.repeat) {
      @if (visible()) {
        <ng-container
          *ngComponentOutlet="mountClass(); inputs: filteredResolvedInputs(); injector: parentInjector"
        />
      }
    } @else {
      @for (repeatInjector of repeatInjectors(); track $index) {
        <ng-container
          *ngComponentOutlet="mountClass(); inputs: filteredRepeatInputs()[$index]; injector: repeatInjector"
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

  private destroyed = false;

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
      this.destroyed = true;
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
      if (!this.notReady() && this.entry()?.component) {
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

  /** The full normalized registry entry for this element type. */
  readonly entry = computed<NormalizedEntry | undefined>(() => {
    const el = this.element();
    return el ? this.ctx.registry.getEntry(el.type) : undefined;
  });

  /** The Angular component class for this element type. */
  readonly componentClass = computed<AngularComponentRenderer | null>(() => {
    const el = this.element();
    if (!el) return null;
    return this.entry()?.component ?? null;
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

  /** True when the element is not yet ready to mount the real component.
   *  Delegates to `isElementReady` which checks:
   *  1. Any undefined-valued resolved prop (state binding still loading).
   *  2. A sync Standard-Schema gate if the registry entry declares a schema.
   *  Framework-injected keys (bindings, emit, loading, childKeys, spec) are
   *  excluded — only consumer-resolved props matter for readiness. */
  readonly notReady = computed<boolean>(() => {
    if (this.mountedReal()) return false;
    const el = this.element();
    if (!el || !el.props) return false;
    const resolved = resolveElementProps(el.props, this.propCtx());
    return !isElementReady(this.entry(), resolved);
  });

  /** Picks fallback or real based on notReady. The mountedReal latch is
   *  driven by a constructor effect (not this computed) — Angular forbids
   *  signal writes inside computed. */
  readonly mountClass = computed<AngularComponentRenderer | null>(() => {
    const el = this.element();
    if (!el) return null;
    const real = this.entry()?.component ?? null;
    if (this.notReady()) {
      return this.entry()?.fallback ?? null;
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

  /** Invokes the element's `on[event]` handler bindings. */
  private invokeHandlers(event: string, payload?: Record<string, unknown>): void {
    const el = this.element();
    if (!el?.on) return;
    const binding = el.on[event];
    if (!binding) return;
    const bindings = Array.isArray(binding) ? binding : [binding];
    for (const b of bindings) {
      const handler = this.ctx.handlers?.[b.action];
      if (handler) {
        const params = { ...(b.params as Record<string, unknown> ?? {}), ...(payload ?? {}) };
        runInInjectionContext(this.parentInjector, () => handler(params));
      }
    }
  }

  /** Element-scoped host injected by mounted view components via
   * injectRenderHost(). `set` writes the store; `emit` routes element
   * handlers; `result` surfaces a RenderResultEvent for this element. */
  readonly host: RenderHost = {
    set: (path: string, value: unknown) => { if (this.destroyed) return; this.ctx.store?.set(path, value); },
    emit: (event: string, payload?: Record<string, unknown>) => { if (this.destroyed) return; this.invokeHandlers(event, payload); },
    result: (value: unknown) => { if (this.destroyed) return; this.ctx.emitEvent?.({ type: 'result', value, elementKey: this.elementKey() }); },
  };

  /** Emit function passed to mounted view components as the `emit` framework
   * input. Delegates to the element's `on[event]` handler bindings. */
  private readonly emitFn = (event: string) => {
    this.invokeHandlers(event);
  };

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

  /** `resolvedInputs` filtered down to keys the target component actually
   * declares — silences NG0303 dev-mode warnings from framework-only
   * inputs (bindings/emit/loading/childKeys/spec) passed to simple view
   * components that don't declare them. */
  readonly filteredResolvedInputs = computed(() =>
    filterInputsForClass(this.mountClass() as Type<unknown> | null, this.resolvedInputs()),
  );

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

  /** `repeatInputs` filtered per-item to declared component inputs. */
  readonly filteredRepeatInputs = computed(() => {
    const cls = this.mountClass() as Type<unknown> | null;
    return this.repeatInputs().map(inputs => filterInputsForClass(cls, inputs));
  });
}
