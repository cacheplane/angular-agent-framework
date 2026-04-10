// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component, input } from '@angular/core';

@Component({
  selector: 'a2ui-date-time-input',
  standalone: true,
  template: `
    <div class="flex flex-col gap-1">
      @if (label()) {
        <label class="text-xs text-white/60">{{ label() }}</label>
      }
      <input
        [type]="inputType()"
        [value]="value()"
        [min]="min()"
        [max]="max()"
        class="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
        (change)="onChange($event)"
      />
    </div>
  `,
})
export class A2uiDateTimeInputComponent {
  readonly label = input<string>('');
  readonly value = input<string>('');
  readonly inputType = input<'date' | 'time' | 'datetime-local'>('date');
  readonly min = input<string>('');
  readonly max = input<string>('');
  readonly _bindings = input<Record<string, string>>({});
  readonly emit = input<(event: string) => void>(() => { /* noop */ });

  onChange(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    const path = this._bindings()?.['value'];
    if (path) {
      this.emit()(`a2ui:datamodel:${path}:${val}`);
    }
  }
}
