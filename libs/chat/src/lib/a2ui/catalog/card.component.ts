// SPDX-License-Identifier: MIT
import { Component, input } from '@angular/core';
import type { Spec } from '@json-render/core';
import { RenderElementComponent } from '@ngaf/render';

@Component({
  selector: 'a2ui-card',
  standalone: true,
  imports: [RenderElementComponent],
  template: `
    <div class="a2ui-card">
      @for (key of childKeys(); track key) {
        <render-element [elementKey]="key" [spec]="spec()" />
      }
    </div>
  `,
  styles: [`
    .a2ui-card {
      display: flex;
      flex-direction: column;
      gap: 8px;
      border-radius: 12px;
      border: 1px solid var(--a2ui-border, rgba(255,255,255,0.1));
      background: var(--a2ui-card-bg, rgba(255,255,255,0.05));
      padding: 16px;
    }
  `],
})
export class A2uiCardComponent {
  /** v1: a single child key, delivered via childKeys[0] from the render framework. */
  readonly childKeys = input<string[]>([]);
  readonly spec = input.required<Spec>();
  // Framework inputs required by the render harness.
  readonly bindings = input<Record<string, string>>({});
  readonly emit = input<(event: string) => void>(() => { /* noop */ });
  readonly loading = input<boolean>(false);
}
