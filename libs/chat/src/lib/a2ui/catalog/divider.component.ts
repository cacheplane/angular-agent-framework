// SPDX-License-Identifier: MIT
import { Component, input } from '@angular/core';
import type { Spec } from '@json-render/core';

@Component({
  selector: 'a2ui-divider',
  standalone: true,
  template: `
    @if (direction() === 'vertical') {
      <div class="inline-block self-stretch border-l border-white/10 mx-2"></div>
    } @else {
      <hr class="border-white/10 my-2" />
    }
  `,
})
export class A2uiDividerComponent {
  readonly direction = input<'horizontal' | 'vertical'>('horizontal');
  // Framework inputs required by the render harness.
  readonly bindings = input<Record<string, string>>({});
  readonly emit = input<(event: string) => void>(() => { /* noop */ });
  readonly loading = input<boolean>(false);
  readonly childKeys = input<string[]>([]);
  readonly spec = input<Spec | undefined>(undefined);
}
