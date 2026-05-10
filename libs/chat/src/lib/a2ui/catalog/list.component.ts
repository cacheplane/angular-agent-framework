// SPDX-License-Identifier: MIT
import { Component, computed, input } from '@angular/core';
import type { Spec } from '@json-render/core';
import { RenderElementComponent } from '@ngaf/render';

@Component({
  selector: 'a2ui-list',
  standalone: true,
  imports: [RenderElementComponent],
  template: `
    <div [class]="listClass()">
      @for (key of childKeys(); track key) {
        <render-element [elementKey]="key" [spec]="spec()" />
      }
    </div>
  `,
})
export class A2uiListComponent {
  readonly childKeys = input<string[]>([]);
  readonly spec = input.required<Spec>();
  readonly direction = input<'vertical' | 'horizontal'>('vertical');
  // Framework inputs required by the render harness.
  readonly bindings = input<Record<string, string>>({});
  readonly emit = input<(event: string) => void>(() => { /* noop */ });
  readonly loading = input<boolean>(false);

  protected readonly listClass = computed(() => {
    return this.direction() === 'horizontal'
      ? 'flex flex-row gap-1 overflow-x-auto'
      : 'flex flex-col gap-1 overflow-y-auto max-h-96';
  });
}
