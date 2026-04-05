// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  Injector,
  input,
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
          *ngComponentOutlet="componentClass(); inputs: resolvedInputs(); injector: parentInjector"
        />
      }
    } @else {
      @for (repeatInjector of repeatInjectors(); track $index) {
        <ng-container
          *ngComponentOutlet="componentClass(); inputs: repeatInputs()[$index]; injector: repeatInjector"
        />
      }
    }
  `,
})
export class RenderElementComponent {
  readonly elementKey = input.required<string>();
  readonly spec = input.required<Spec>();

  private readonly ctx = inject(RENDER_CONTEXT);
  private readonly repeatScope = inject(REPEAT_SCOPE, { optional: true });
  readonly parentInjector = inject(Injector);

  /** The UIElement definition from the spec. */
  readonly element: Signal<UIElement | undefined> = computed(() => {
    const spec = this.spec();
    const key = this.elementKey();
    return spec?.elements?.[key];
  });

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

  /** Whether the element is visible (non-repeat path). */
  readonly visible = computed(() => {
    const el = this.element();
    if (!el) return false;
    if (this.componentClass() === null) return false;
    return evaluateVisibility(el.visible, this.propCtx());
  });

  /** Emit function that delegates to context handlers. */
  private readonly emitFn = (event: string) => {
    const el = this.element();
    if (!el?.on) return;
    const binding = el.on[event];
    if (!binding) return;
    const bindings = Array.isArray(binding) ? binding : [binding];
    for (const b of bindings) {
      const handler = this.ctx.handlers?.[b.action];
      if (handler) {
        handler(b.params as Record<string, unknown> ?? {});
      }
    }
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

  // --- Repeat support ---

  /** Items from the state array for repeat elements. */
  private readonly repeatItems = computed<unknown[]>(() => {
    const el = this.element();
    if (!el?.repeat) return [];
    const items = this.ctx.store.get(el.repeat.statePath);
    return Array.isArray(items) ? items : [];
  });

  /** One child Injector per repeat item, providing RepeatScope. */
  readonly repeatInjectors = computed(() => {
    const el = this.element();
    if (!el?.repeat) return [];
    const items = this.repeatItems();
    return items.map((item, index) => {
      const scope: RepeatScope = {
        item,
        index,
        basePath: `${el.repeat!.statePath}/${index}`,
      };
      return Injector.create({
        providers: [{ provide: REPEAT_SCOPE, useValue: scope }],
        parent: this.parentInjector,
      });
    });
  });

  /** Resolved inputs for each repeat item. */
  readonly repeatInputs = computed(() => {
    const el = this.element();
    if (!el?.repeat) return [];
    const items = this.repeatItems();
    return items.map((item, index) => {
      const scope: RepeatScope = {
        item,
        index,
        basePath: `${el.repeat!.statePath}/${index}`,
      };
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
