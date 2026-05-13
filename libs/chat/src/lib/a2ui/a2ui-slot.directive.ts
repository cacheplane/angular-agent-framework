// SPDX-License-Identifier: MIT
import {
  Directive, Input, ViewContainerRef, ComponentRef, Type,
} from '@angular/core';
import type { A2uiComponentView } from './component-view';
import type { A2uiViews } from './views';
import { normalizeViewEntry } from './views';
import { A2uiDefaultFallbackComponent } from './a2ui-default-fallback.component';

/** Internal recursive structural directive that mounts the right
 * component for an `A2uiComponentView` instance. Monotonic: once the
 * real component mounts, subsequent ticks only push new input values
 * via `ComponentRef.setInput()` — no remount, no re-check of `ready`. */
@Directive({
  selector: '[a2uiSlot]',
  standalone: true,
})
export class A2uiSlotDirective {
  private view: A2uiComponentView | null = null;
  private views: A2uiViews = {};
  private mountedReal = false;
  private ref: ComponentRef<unknown> | null = null;

  constructor(private readonly vcr: ViewContainerRef) {}

  @Input({ required: true }) set a2uiSlot(view: A2uiComponentView) {
    this.view = view;
    this.render();
  }

  @Input({ required: true }) set a2uiSlotViews(views: A2uiViews) {
    this.views = views;
    this.render();
  }

  private render(): void {
    const view = this.view;
    if (!view) return;
    const entry = this.views[view.type];
    const normalized = entry != null ? normalizeViewEntry(entry) : undefined;

    // Monotonic gate: once real mounted, only push inputs.
    if (this.mountedReal && this.ref) {
      this.pushProps(this.ref, view.props);
      return;
    }

    if (view.ready && normalized) {
      this.vcr.clear();
      const created = this.vcr.createComponent(normalized.component);
      this.pushProps(created, view.props);
      this.ref = created;
      this.mountedReal = true;
      return;
    }

    // Not ready (or no entry yet) → mount fallback.
    const fallback: Type<unknown> =
      normalized?.fallback ?? A2uiDefaultFallbackComponent;
    // Avoid thrashing: only remount if the current ref isn't the fallback.
    if (this.ref && this.ref.componentType === fallback) return;
    this.vcr.clear();
    this.ref = this.vcr.createComponent(fallback);
  }

  private pushProps(ref: ComponentRef<unknown>, props: Record<string, unknown>): void {
    for (const [k, v] of Object.entries(props)) {
      try {
        ref.setInput(k, v);
      } catch {
        // Component doesn't declare this input — silently skip. The
        // wire format may include keys the Angular component doesn't
        // accept (e.g. children references handled separately).
      }
    }
  }
}
