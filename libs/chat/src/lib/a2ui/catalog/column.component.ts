// SPDX-License-Identifier: MIT
import { Component, input } from '@angular/core';
import type { Spec } from '@json-render/core';
import { RenderElementComponent } from '@ngaf/render';

@Component({
  selector: 'a2ui-column',
  standalone: true,
  imports: [RenderElementComponent],
  template: `
    <div class="flex flex-col gap-3">
      @for (key of childKeys(); track key) {
        <render-element [elementKey]="key" [spec]="spec()" />
      }
    </div>
  `,
})
export class A2uiColumnComponent {
  readonly childKeys = input<string[]>([]);
  readonly spec = input.required<Spec>();
}
