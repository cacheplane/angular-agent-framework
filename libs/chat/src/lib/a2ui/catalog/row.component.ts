// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component, input } from '@angular/core';
import type { Spec } from '@json-render/core';
import { RenderElementComponent } from '@cacheplane/render';

@Component({
  selector: 'a2ui-row',
  standalone: true,
  imports: [RenderElementComponent],
  template: `
    <div class="flex flex-row gap-3 items-start">
      @for (key of childKeys(); track key) {
        <render-element [elementKey]="key" [spec]="spec()" />
      }
    </div>
  `,
})
export class A2uiRowComponent {
  readonly childKeys = input<string[]>([]);
  readonly spec = input.required<Spec>();
}
