// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component, input } from '@angular/core';

@Component({
  selector: 'a2ui-text-field',
  standalone: true,
  template: `
    <div class="flex flex-col gap-1">
      @if (label()) { <label for="a2ui-tf" class="text-xs text-white/60">{{ label() }}</label> }
      <input
        id="a2ui-tf"
        type="text"
        [value]="value()"
        [placeholder]="placeholder()"
        class="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
        readonly
      />
    </div>
  `,
})
export class A2uiTextFieldComponent {
  readonly label = input<string>('');
  readonly value = input<string>('');
  readonly placeholder = input<string>('');
}
