// SPDX-License-Identifier: MIT
import { Component, input } from '@angular/core';
import type { Spec } from '@json-render/core';
import { RenderElementComponent } from '@cacheplane/render';

@Component({
  selector: 'a2ui-list',
  standalone: true,
  imports: [RenderElementComponent],
  template: `
    <div class="flex flex-col gap-1 overflow-y-auto max-h-96">
      @for (key of childKeys(); track key) {
        <render-element [elementKey]="key" [spec]="spec()" />
      }
    </div>
  `,
})
export class A2uiListComponent {
  readonly childKeys = input<string[]>([]);
  readonly spec = input.required<Spec>();
}
