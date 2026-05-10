// SPDX-License-Identifier: MIT
import { Component, computed, input } from '@angular/core';
import type { Spec } from '@json-render/core';
import { RenderElementComponent } from '@ngaf/render';

type RowAlignment = 'start' | 'center' | 'end' | 'stretch';
type RowDistribution = 'start' | 'center' | 'end' | 'space-between' | 'space-around';

const ROW_ALIGN_MAP: Record<RowAlignment, string> = {
  start: 'flex-start', center: 'center', end: 'flex-end', stretch: 'stretch',
};

const ROW_JUSTIFY_MAP: Record<RowDistribution, string> = {
  start: 'flex-start', center: 'center', end: 'flex-end',
  'space-between': 'space-between', 'space-around': 'space-around',
};

@Component({
  selector: 'a2ui-row',
  standalone: true,
  imports: [RenderElementComponent],
  template: `
    <div
      class="a2ui-row"
      [style.align-items]="alignItems()"
      [style.justify-content]="justifyContent()"
      [style.gap.px]="gapPx()"
    >
      @for (key of childKeys(); track key) {
        <render-element [elementKey]="key" [spec]="spec()" />
      }
    </div>
  `,
  styles: [`
    .a2ui-row {
      display: flex;
      flex-direction: row;
      flex-wrap: wrap;
    }
  `],
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

  protected readonly alignItems = computed(() => ROW_ALIGN_MAP[this.alignment()] ?? 'flex-start');
  protected readonly justifyContent = computed(() => ROW_JUSTIFY_MAP[this.distribution()] ?? 'flex-start');
  /** Convert the gap unit (multiples of 4px) to pixels. */
  protected readonly gapPx = computed(() => this.gap() * 4);
}
