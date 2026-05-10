// SPDX-License-Identifier: MIT
import { Component, computed, input, ChangeDetectionStrategy } from '@angular/core';
import type { Spec } from '@json-render/core';
import { emitBinding } from './emit-binding';

@Component({
  selector: 'a2ui-date-time-input',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="a2ui-dti">
      @if (label()) {
        <label [htmlFor]="_inputId" class="a2ui-dti__label">{{ label() }}</label>
      }
      <input
        [id]="_inputId"
        [type]="htmlInputType()"
        [value]="value()"
        class="a2ui-dti__input"
        (change)="onChange($event)"
      />
    </div>
  `,
  styles: [`
    .a2ui-dti { display: flex; flex-direction: column; gap: var(--a2ui-spacing-1); }
    .a2ui-dti__label {
      font-size: var(--a2ui-typography-label-size);
      font-weight: var(--a2ui-typography-label-weight);
      color: var(--a2ui-label);
    }
    .a2ui-dti__input {
      padding: var(--a2ui-spacing-2) var(--a2ui-spacing-3);
      font-size: var(--a2ui-typography-body-size);
      border-radius: var(--a2ui-shape-small);
      background: var(--a2ui-input-bg);
      color: var(--a2ui-on-surface);
      border: 1px solid var(--a2ui-outline);
      outline: none;
      transition: border-color var(--a2ui-motion-duration-short) var(--a2ui-motion-easing-standard);
    }
    .a2ui-dti__input:focus {
      outline: var(--a2ui-focus-ring-width) solid var(--a2ui-focus-ring-color);
      outline-offset: 2px;
      border-color: var(--a2ui-primary);
    }
  `],
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
  // Framework inputs required by the render harness.
  readonly bindings = input<Record<string, string>>({});
  readonly loading = input<boolean>(false);
  readonly childKeys = input<string[]>([]);
  readonly spec = input<Spec | undefined>(undefined);

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
