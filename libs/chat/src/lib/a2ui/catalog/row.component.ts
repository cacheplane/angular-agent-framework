// SPDX-License-Identifier: MIT
import { Component, computed, input } from '@angular/core';
import type { Spec } from '@json-render/core';
import { RenderElementComponent } from '@ngaf/render';

type RowAlignment = 'start' | 'center' | 'end' | 'stretch';
type RowDistribution = 'start' | 'center' | 'end' | 'space-between' | 'space-around';

@Component({
  selector: 'a2ui-row',
  standalone: true,
  imports: [RenderElementComponent],
  template: `
    <div [class]="rowClass()">
      @for (key of childKeys(); track key) {
        <render-element [elementKey]="key" [spec]="spec()" />
      }
    </div>
  `,
})
export class A2uiRowComponent {
  readonly childKeys = input<string[]>([]);
  readonly spec = input.required<Spec>();
  readonly gap = input<number>(3);
  readonly alignment = input<RowAlignment>('start');
  readonly distribution = input<RowDistribution>('start');
  // Framework inputs required by the render harness.
  readonly bindings = input<Record<string, string>>({});
  readonly emit = input<(event: string) => void>(() => { /* noop */ });
  readonly loading = input<boolean>(false);

  protected readonly rowClass = computed(() => {
    const alignMap: Record<RowAlignment, string> = {
      start: 'items-start', center: 'items-center', end: 'items-end', stretch: 'items-stretch',
    };
    const justifyMap: Record<RowDistribution, string> = {
      start: 'justify-start', center: 'justify-center', end: 'justify-end',
      'space-between': 'justify-between', 'space-around': 'justify-around',
    };
    return `flex flex-row gap-${this.gap()} ${alignMap[this.alignment()]} ${justifyMap[this.distribution()]}`;
  });
}
