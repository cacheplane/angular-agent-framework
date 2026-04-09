// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component, input } from '@angular/core';

@Component({
  selector: 'a2ui-check-box',
  standalone: true,
  template: `
    <label class="flex items-center gap-2 text-sm cursor-pointer">
      <input type="checkbox" [checked]="checked()" (change)="onChange($event)" class="rounded" />
      {{ label() }}
    </label>
  `,
})
export class A2uiCheckBoxComponent {
  readonly label = input<string>('');
  readonly checked = input<boolean>(false);
  readonly _bindings = input<Record<string, string>>({});
  readonly emit = input<(event: string) => void>(() => {});

  onChange(event: Event): void {
    const val = (event.target as HTMLInputElement).checked;
    const path = this._bindings()?.['checked'];
    if (path) {
      this.emit()(`a2ui:datamodel:${path}:${val}`);
    }
  }
}
