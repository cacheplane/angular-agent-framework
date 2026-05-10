// SPDX-License-Identifier: MIT
import { Component, computed, input } from '@angular/core';
import type { Spec } from '@json-render/core';
import { RenderElementComponent } from '@ngaf/render';

type ColumnAlignment = 'start' | 'center' | 'end' | 'stretch';

const ALIGN_MAP: Record<ColumnAlignment, string> = {
  start: 'flex-start', center: 'center', end: 'flex-end', stretch: 'stretch',
};

@Component({
  selector: 'a2ui-column',
  standalone: true,
  imports: [RenderElementComponent],
  template: `
    <div class="a2ui-col" [style.align-items]="alignItems()" [style.gap.px]="gapPx()">
      @for (key of childKeys(); track key) {
        <render-element [elementKey]="key" [spec]="spec()" />
      }
    </div>
  `,
  styles: [`
    .a2ui-col {
      display: flex;
      flex-direction: column;
    }
  `],
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

  protected readonly alignItems = computed(() => ALIGN_MAP[this.alignment()] ?? 'flex-start');
  /** Convert the Tailwind gap unit (multiples of 4px) to pixels. */
  protected readonly gapPx = computed(() => this.gap() * 4);
}
