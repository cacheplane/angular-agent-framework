// SPDX-License-Identifier: MIT
import { Component, input } from '@angular/core';
import type { Spec } from '@json-render/core';
import { RenderElementComponent } from '@ngaf/render';

@Component({
  selector: 'a2ui-card',
  standalone: true,
  imports: [RenderElementComponent],
  template: `
    <div class="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
      @for (key of childKeys(); track key) {
        <render-element [elementKey]="key" [spec]="spec()" />
      }
    </div>
  `,
})
export class A2uiCardComponent {
  /** v1: a single child key, delivered via childKeys[0] from the render framework. */
  readonly childKeys = input<string[]>([]);
  readonly spec = input.required<Spec>();
}
