// SPDX-License-Identifier: MIT
import { Component, computed, effect, input, signal } from '@angular/core';
import type { Spec } from '@json-render/core';
import { RenderElementComponent } from '@ngaf/render';

@Component({
  selector: 'a2ui-tabs',
  standalone: true,
  imports: [RenderElementComponent],
  template: `
    <div class="flex flex-col gap-0">
      <div class="flex border-b border-white/10" role="tablist">
        @for (title of tabTitles(); track $index) {
          <button
            role="tab"
            class="px-4 py-2 text-sm font-medium transition-colors border-b-2"
            [class]="$index === activeIndex() ? 'border-blue-500 text-white' : 'border-transparent text-white/50 hover:text-white/80'"
            [attr.aria-selected]="$index === activeIndex()"
            (click)="selectTab($index)"
          >{{ title }}</button>
        }
      </div>
      <div class="pt-3" role="tabpanel">
        @if (activeChildKey(); as key) {
          <render-element [elementKey]="key" [spec]="spec()" />
        }
      </div>
    </div>
  `,
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
