// SPDX-License-Identifier: MIT
import { Component, input } from '@angular/core';

@Component({
  selector: 'a2ui-icon',
  standalone: true,
  template: `<span class="text-lg">{{ name() }}</span>`,
})
export class A2uiIconComponent {
  readonly name = input<string>('');
}
