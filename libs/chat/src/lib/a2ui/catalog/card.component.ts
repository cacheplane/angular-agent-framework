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
      @if (title()) {
        <h3 class="text-sm font-semibold mb-2">{{ title() }}</h3>
      }
      @for (key of childKeys(); track key) {
        <render-element [elementKey]="key" [spec]="spec()" />
      }
    </div>
  `,
})
export class A2uiCardComponent {
  readonly title = input<string>('');
  readonly childKeys = input<string[]>([]);
  readonly spec = input.required<Spec>();
}
