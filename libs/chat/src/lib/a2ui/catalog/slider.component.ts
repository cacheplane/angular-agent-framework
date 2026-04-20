// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import type { A2uiValidationResult } from '@cacheplane/a2ui';
import { A2uiValidationErrorsComponent } from './validation-errors.component';
import { emitBinding } from './emit-binding';

@Component({
  selector: 'a2ui-slider',
  standalone: true,
  imports: [A2uiValidationErrorsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-1">
      @if (label()) {
        <label [htmlFor]="_inputId" class="text-xs" style="color: var(--a2ui-label, rgba(255,255,255,0.6));">{{ label() }}: {{ value() }}</label>
      }
      <input
        [id]="_inputId"
        type="range"
        [min]="min()"
        [max]="max()"
        [step]="step()"
        [value]="value()"
        class="w-full"
        (input)="onInput($event)"
      />
      <a2ui-validation-errors [result]="validationResult()" />
    </div>
  `,
})
export class A2uiSliderComponent {
  private static _idCounter = 0;
  protected readonly _inputId = `a2ui-slider-${++A2uiSliderComponent._idCounter}`;

  readonly label = input<string>('');
  readonly value = input<number>(0);
  readonly min = input<number>(0);
  readonly max = input<number>(100);
  readonly step = input<number>(1);
  readonly validationResult = input<A2uiValidationResult>({ valid: true, errors: [] });
  readonly _bindings = input<Record<string, string>>({});
  readonly emit = input<(event: string) => void>(() => { /* noop */ });

  onInput(event: Event): void {
    const val = Number((event.target as HTMLInputElement).value);
    emitBinding(this.emit(), this._bindings(), 'value', val);
  }
}
