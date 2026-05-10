// SPDX-License-Identifier: MIT
import { Component, computed, effect, input, signal } from '@angular/core';
import type { Spec } from '@json-render/core';
import { RenderElementComponent } from '@ngaf/render';

@Component({
  selector: 'a2ui-tabs',
  standalone: true,
  imports: [RenderElementComponent],
  template: `
    <div class="a2ui-tabs">
      <div class="a2ui-tabs__tablist" role="tablist">
        @for (title of tabTitles(); track $index) {
          <button
            role="tab"
            [class]="$index === activeIndex() ? 'a2ui-tabs__tab a2ui-tabs__tab--active' : 'a2ui-tabs__tab'"
            [attr.aria-selected]="$index === activeIndex()"
            (click)="selectTab($index)"
          >{{ title }}</button>
        }
      </div>
      <div class="a2ui-tabs__panel" role="tabpanel">
        @if (activeChildKey(); as key) {
          <render-element [elementKey]="key" [spec]="spec()" />
        }
      </div>
    </div>
  `,
  styles: [`
    .a2ui-tabs { display: flex; flex-direction: column; }
    .a2ui-tabs__tablist {
      display: flex;
      border-bottom: 1px solid var(--a2ui-border, rgba(255,255,255,0.1));
    }
    .a2ui-tabs__tab {
      padding: 8px 16px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      background: transparent;
      border: none;
      border-bottom: 2px solid transparent;
      color: var(--a2ui-label, rgba(255,255,255,0.5));
      transition: color 120ms, border-color 120ms;
      margin-bottom: -1px;
    }
    .a2ui-tabs__tab:hover { color: var(--a2ui-input-text, rgba(255,255,255,0.8)); }
    .a2ui-tabs__tab--active {
      border-bottom-color: var(--a2ui-primary, #3b82f6);
      color: var(--a2ui-input-text, white);
    }
    .a2ui-tabs__panel { padding-top: 12px; }
  `],
})
export class A2uiTabsComponent {
  /** Resolved tab titles from tabItems[*].title — produced by surface-to-spec. */
  readonly tabTitles = input<string[]>([]);
  /** v1: each child key corresponds to a tab's contentChild (childKeys[i] ↔ tabTitles[i]). */
  readonly childKeys = input<string[]>([]);
  readonly spec = input.required<Spec>();
  // Framework inputs required by the render harness.
  readonly bindings = input<Record<string, string>>({});
  readonly emit = input<(event: string) => void>(() => { /* noop */ });
  readonly loading = input<boolean>(false);

  protected readonly activeIndex = signal(0);

  constructor() {
    // Reset active tab when the surface changes entirely.
    effect(() => {
      const len = this.childKeys().length;
      if (this.activeIndex() >= len && len > 0) this.activeIndex.set(0);
    });
  }

  protected readonly activeChildKey = computed(() => {
    const idx = this.activeIndex();
    const keys = this.childKeys();
    return idx >= 0 && idx < keys.length ? keys[idx] : null;
  });

  selectTab(index: number): void {
    this.activeIndex.set(index);
  }
}
