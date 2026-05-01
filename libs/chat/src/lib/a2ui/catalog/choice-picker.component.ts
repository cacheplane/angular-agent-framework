// SPDX-License-Identifier: MIT
import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import type { A2uiValidationResult } from '@ngaf/a2ui';
import { A2uiValidationErrorsComponent } from './validation-errors.component';
import { emitBinding } from './emit-binding';

@Component({
  selector: 'a2ui-choice-picker',
  standalone: true,
  imports: [A2uiValidationErrorsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-1">
      @if (label()) { <label [htmlFor]="_inputId" class="text-xs" style="color: var(--a2ui-label, rgba(255,255,255,0.6));">{{ label() }}</label> }
      <select
        [id]="_inputId"
        class="rounded-lg px-3 py-2 text-sm"
        [style.background]="'var(--a2ui-input-bg, rgba(255,255,255,0.05))'"
        [style.color]="'var(--a2ui-input-text, white)'"
        [style.border]="validationResult().valid ? '1px solid var(--a2ui-border, rgba(255,255,255,0.1))' : '1px solid var(--a2ui-error, #ef4444)'"
        (change)="onChange($event)"
      >
        @for (opt of options(); track opt) {
          <option [selected]="opt === selected()">{{ opt }}</option>
        }
      </select>
      <a2ui-validation-errors [result]="validationResult()" />
    </div>
  `,
})
export class A2uiChoicePickerComponent {
  private static _idCounter = 0;
  protected readonly _inputId = `a2ui-choice-picker-${++A2uiChoicePickerComponent._idCounter}`;

  readonly label = input<string>('');
  readonly options = input<string[]>([]);
  readonly selected = input<string>('');
  readonly validationResult = input<A2uiValidationResult>({ valid: true, errors: [] });
  readonly _bindings = input<Record<string, string>>({});
  readonly emit = input<(event: string) => void>(() => { /* noop */ });

  onChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    emitBinding(this.emit(), this._bindings(), 'selected', val);
  }
}
