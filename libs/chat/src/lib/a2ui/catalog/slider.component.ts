// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component, input } from '@angular/core';

@Component({
  selector: 'a2ui-slider',
  standalone: true,
  template: `
    <div class="flex flex-col gap-1">
      @if (label()) {
        <label class="text-xs text-white/60">{{ label() }}: {{ value() }}</label>
      }
      <input
        type="range"
        [min]="min()"
        [max]="max()"
        [step]="step()"
        [value]="value()"
        class="w-full"
        (input)="onInput($event)"
      />
    </div>
  `,
})
export class A2uiSliderComponent {
  readonly label = input<string>('');
  readonly value = input<number>(0);
  readonly min = input<number>(0);
  readonly max = input<number>(100);
  readonly step = input<number>(1);
  readonly _bindings = input<Record<string, string>>({});
  readonly emit = input<(event: string) => void>(() => { /* noop */ });

  onInput(event: Event): void {
    const val = Number((event.target as HTMLInputElement).value);
    const path = this._bindings()?.['value'];
    if (path) {
      this.emit()(`a2ui:datamodel:${path}:${val}`);
    }
  }
}
