// SPDX-License-Identifier: MIT
import { Component, input } from '@angular/core';

@Component({
  selector: 'a2ui-icon',
  standalone: true,
  template: `
    <span
      class="inline-flex items-center justify-center select-none"
      [style.font-size]="size() ? size() + 'px' : '1.125rem'"
    >{{ icon() }}</span>
  `,
})
export class A2uiIconComponent {
  /** v1 prop name: icon (resolved string, e.g. a Unicode symbol or ligature name). */
  readonly icon = input<string>('');
  readonly size = input<number | null>(null);
}
