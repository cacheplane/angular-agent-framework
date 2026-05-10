// SPDX-License-Identifier: MIT
import { Component, input } from '@angular/core';

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
}
