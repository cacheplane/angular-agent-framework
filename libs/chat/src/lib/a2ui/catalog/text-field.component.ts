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
        (input)="onInput($event)"
      />
    </div>
  `,
})
export class A2uiTextFieldComponent {
  readonly label = input<string>('');
  readonly value = input<string>('');
  readonly placeholder = input<string>('');
  readonly _bindings = input<Record<string, string>>({});
  readonly emit = input<(event: string) => void>(() => {});

  onInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    const path = this._bindings()?.['value'];
    if (path) {
      this.emit()(`a2ui:datamodel:${path}:${val}`);
    }
  }
}
