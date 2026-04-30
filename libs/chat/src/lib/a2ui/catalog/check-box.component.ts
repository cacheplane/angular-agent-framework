// SPDX-License-Identifier: MIT
import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import type { A2uiValidationResult } from '@cacheplane/a2ui';
import { A2uiValidationErrorsComponent } from './validation-errors.component';
import { emitBinding } from './emit-binding';

@Component({
  selector: 'a2ui-check-box',
  standalone: true,
  imports: [A2uiValidationErrorsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div>
      <label class="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" [checked]="checked()" (change)="onChange($event)" class="rounded" />
        {{ label() }}
      </label>
      <a2ui-validation-errors [result]="validationResult()" />
    </div>
  `,
})
export class A2uiCheckBoxComponent {
  readonly label = input<string>('');
  readonly checked = input<boolean>(false);
  readonly validationResult = input<A2uiValidationResult>({ valid: true, errors: [] });
  readonly _bindings = input<Record<string, string>>({});
  readonly emit = input<(event: string) => void>(() => { /* noop */ });

  onChange(event: Event): void {
    const val = (event.target as HTMLInputElement).checked;
    emitBinding(this.emit(), this._bindings(), 'checked', val);
  }
}
