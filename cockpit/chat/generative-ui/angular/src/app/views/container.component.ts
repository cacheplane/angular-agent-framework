// SPDX-License-Identifier: MIT
import { Component, computed, input } from '@angular/core';
import type { Spec } from '@json-render/core';
import { RenderElementComponent } from '@cacheplane/render';

@Component({
  selector: 'app-container',
  standalone: true,
  imports: [RenderElementComponent],
  template: `
    <div [class]="layoutClass()">
      @for (key of childKeys(); track key) {
        <render-element [elementKey]="key" [spec]="spec()" />
      }
    </div>
  `,
})
export class ContainerComponent {
  readonly childKeys = input<string[]>([]);
  readonly spec = input.required<Spec>();
  readonly direction = input<'row' | 'column'>('column');

  readonly layoutClass = computed(() =>
    this.direction() === 'row'
      ? 'flex flex-row flex-wrap gap-3'
      : 'flex flex-col gap-3'
  );
}
