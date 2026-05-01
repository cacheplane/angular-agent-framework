// SPDX-License-Identifier: MIT
import { Component, computed, effect, input, signal } from '@angular/core';
import type { Spec } from '@json-render/core';
import { RenderElementComponent } from '@ngaf/render';
import { emitBinding } from './emit-binding';

@Component({
  selector: 'a2ui-tabs',
  standalone: true,
  imports: [RenderElementComponent],
  template: `
    <div class="flex flex-col gap-0">
      <div class="flex border-b border-white/10" role="tablist">
        @for (tab of tabs(); track $index) {
          <button
            role="tab"
            class="px-4 py-2 text-sm font-medium transition-colors border-b-2"
            [class]="$index === activeIndex() ? 'border-blue-500 text-white' : 'border-transparent text-white/50 hover:text-white/80'"
            [attr.aria-selected]="$index === activeIndex()"
            (click)="selectTab($index)"
          >{{ tab.label }}</button>
        }
      </div>
      <div class="pt-3" role="tabpanel">
        @for (key of activeChildKeys(); track key) {
          <render-element [elementKey]="key" [spec]="spec()" />
        }
      </div>
    </div>
  `,
})
export class A2uiTabsComponent {
  readonly tabs = input<{ label: string; childKeys: string[] }[]>([]);
  readonly selected = input<number>(0);
  readonly childKeys = input<string[]>([]);
  readonly spec = input.required<Spec>();
  readonly _bindings = input<Record<string, string>>({});
  readonly emit = input<(event: string) => void>(() => { /* noop */ });

  protected readonly activeIndex = signal(0);

  constructor() {
    effect(() => {
      this.activeIndex.set(this.selected());
    });
  }

  readonly activeChildKeys = computed(() => {
    const idx = this.activeIndex();
    const allTabs = this.tabs();
    if (idx >= 0 && idx < allTabs.length) {
      return allTabs[idx].childKeys;
    }
    return [];
  });

  selectTab(index: number): void {
    this.activeIndex.set(index);
    emitBinding(this.emit(), this._bindings(), 'selected', index);
  }
}
