// SPDX-License-Identifier: MIT
import { Component, input } from '@angular/core';
import type { Spec } from '@json-render/core';
import { RenderElementComponent } from '@ngaf/render';

@Component({
  selector: 'app-dashboard-grid',
  standalone: true,
  imports: [RenderElementComponent],
  template: `
    <div class="flex flex-col gap-6 p-4">
      @for (key of childKeys(); track key) {
        <render-element [elementKey]="key" [spec]="spec()" />
      }
    </div>
  `,
})
export class DashboardGridComponent {
  readonly childKeys = input<string[]>([]);
  readonly spec = input.required<Spec>();
}
