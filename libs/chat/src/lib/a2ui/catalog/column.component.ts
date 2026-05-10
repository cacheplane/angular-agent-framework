// SPDX-License-Identifier: MIT
import { Component, computed, input } from '@angular/core';
import type { Spec } from '@json-render/core';
import { RenderElementComponent } from '@ngaf/render';

type ColumnAlignment = 'start' | 'center' | 'end' | 'stretch';

@Component({
  selector: 'a2ui-column',
  standalone: true,
  imports: [RenderElementComponent],
  template: `
    <div [class]="colClass()">
      @for (key of childKeys(); track key) {
        <render-element [elementKey]="key" [spec]="spec()" />
      }
    </div>
  `,
})
export class A2uiColumnComponent {
  readonly childKeys = input<string[]>([]);
  readonly spec = input.required<Spec>();
  readonly gap = input<number>(3);
  readonly alignment = input<ColumnAlignment>('start');
  readonly distribution = input<'start' | 'center' | 'end' | 'spaceBetween' | 'spaceAround' | 'spaceEvenly'>('start');
  // Framework inputs required by the render harness.
  readonly bindings = input<Record<string, string>>({});
  readonly emit = input<(event: string) => void>(() => { /* noop */ });
  readonly loading = input<boolean>(false);

  protected readonly colClass = computed(() => {
    const alignMap: Record<ColumnAlignment, string> = {
      start: 'items-start', center: 'items-center', end: 'items-end', stretch: 'items-stretch',
    };
    return `flex flex-col gap-${this.gap()} ${alignMap[this.alignment()]}`;
  });
}
