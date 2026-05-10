// SPDX-License-Identifier: MIT
import { Component, computed, input, ChangeDetectionStrategy } from '@angular/core';
import { emitBinding } from './emit-binding';

@Component({
  selector: 'a2ui-date-time-input',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-1">
      @if (label()) {
        <label [htmlFor]="_inputId" class="text-xs" style="color: var(--a2ui-label, rgba(255,255,255,0.6));">{{ label() }}</label>
      }
      <input
        [id]="_inputId"
        [type]="htmlInputType()"
        [value]="value()"
        class="rounded-lg px-3 py-2 text-sm"
        [style.background]="'var(--a2ui-input-bg, rgba(255,255,255,0.05))'"
        [style.color]="'var(--a2ui-input-text, white)'"
        [style.border]="'1px solid var(--a2ui-border, rgba(255,255,255,0.1))'"
        (change)="onChange($event)"
      />
    </div>
  `,
})
export class A2uiDateTimeInputComponent {
  private static _idCounter = 0;
  protected readonly _inputId = `a2ui-date-time-input-${++A2uiDateTimeInputComponent._idCounter}`;

  readonly label = input<string>('');
  /** v1 prop: value (resolved DynamicString). */
  readonly value = input<string>('');
  /** v1 prop: enableDate — include date portion. */
  readonly enableDate = input<boolean>(true);
  /** v1 prop: enableTime — include time portion. */
  readonly enableTime = input<boolean>(false);
  readonly _bindings = input<Record<string, string>>({});
  readonly emit = input<(event: string) => void>(() => { /* noop */ });

  /** Derives HTML input type from enableDate + enableTime. */
  protected readonly htmlInputType = computed<string>(() => {
    const d = this.enableDate();
    const t = this.enableTime();
    if (d && t) return 'datetime-local';
    if (t) return 'time';
    return 'date';
  });

  onChange(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    emitBinding(this.emit(), this._bindings(), 'value', val);
  }
}
