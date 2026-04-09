// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component, input } from '@angular/core';

@Component({
  selector: 'a2ui-choice-picker',
  standalone: true,
  template: `
    <div class="flex flex-col gap-1">
      @if (label()) { <label for="a2ui-cp" class="text-xs text-white/60">{{ label() }}</label> }
      <select id="a2ui-cp" class="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white" (change)="onChange($event)">
        @for (opt of options(); track opt) {
          <option [selected]="opt === selected()">{{ opt }}</option>
        }
      </select>
    </div>
  `,
})
export class A2uiChoicePickerComponent {
  readonly label = input<string>('');
  readonly options = input<string[]>([]);
  readonly selected = input<string>('');
  readonly _bindings = input<Record<string, string>>({});
  readonly emit = input<(event: string) => void>(() => {});

  onChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    const path = this._bindings()?.['selected'];
    if (path) {
      this.emit()(`a2ui:datamodel:${path}:${val}`);
    }
  }
}
