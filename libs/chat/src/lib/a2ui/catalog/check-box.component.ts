// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component, input } from '@angular/core';

@Component({
  selector: 'a2ui-check-box',
  standalone: true,
  template: `
    <label class="flex items-center gap-2 text-sm">
      <input type="checkbox" [checked]="checked()" disabled class="rounded" />
      {{ label() }}
    </label>
  `,
})
export class A2uiCheckBoxComponent {
  readonly label = input<string>('');
  readonly checked = input<boolean>(false);
}
