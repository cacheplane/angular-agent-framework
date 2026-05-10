// SPDX-License-Identifier: MIT
import { Component, computed, input, ChangeDetectionStrategy } from '@angular/core';
import type { Spec } from '@json-render/core';
import { emitBinding } from './emit-binding';

/** v1 textFieldType values from A2uiTextField. */
type TextFieldType = 'date' | 'longText' | 'number' | 'shortText' | 'obscured';

/** Maps v1 textFieldType to HTML input[type] or textarea. */
const TYPE_MAP: Record<TextFieldType, string> = {
  shortText: 'text',
  longText: 'text',    // handled by textarea below
  number: 'number',
  obscured: 'password',
  date: 'date',
};

@Component({
  selector: 'a2ui-text-field',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-1">
      @if (label()) {
        <label [htmlFor]="_inputId" class="text-xs" style="color: var(--a2ui-label, rgba(255,255,255,0.6));">{{ label() }}</label>
      }
      @if (textFieldType() === 'longText') {
        <textarea
          [id]="_inputId"
          [value]="value()"
          [placeholder]="placeholder()"
          rows="4"
          class="rounded-lg px-3 py-2 text-sm resize-y"
          [style.background]="'var(--a2ui-input-bg, rgba(255,255,255,0.05))'"
          [style.color]="'var(--a2ui-input-text, white)'"
          [style.border]="'1px solid var(--a2ui-border, rgba(255,255,255,0.1))'"
          (input)="onInput($event)"
        ></textarea>
      } @else {
        <input
          [id]="_inputId"
          [type]="htmlInputType()"
          [value]="value()"
          [placeholder]="placeholder()"
          [pattern]="validationRegexp() || ''"
          class="rounded-lg px-3 py-2 text-sm"
          [style.background]="'var(--a2ui-input-bg, rgba(255,255,255,0.05))'"
          [style.color]="'var(--a2ui-input-text, white)'"
          [style.border]="'1px solid var(--a2ui-border, rgba(255,255,255,0.1))'"
          (input)="onInput($event)"
        />
      }
    </div>
  `,
})
export class A2uiTextFieldComponent {
  private static _idCounter = 0;
  protected readonly _inputId = `a2ui-text-field-${++A2uiTextFieldComponent._idCounter}`;

  readonly label = input<string>('');
  /** v1 prop: text (resolved string value). */
  readonly text = input<string>('');
  /** Back-compat alias: value. surface-to-spec resolves DynamicString → plain string. */
  readonly value = computed(() => this.text());
  readonly placeholder = input<string>('');
  readonly textFieldType = input<TextFieldType>('shortText');
  readonly validationRegexp = input<string>('');
  readonly _bindings = input<Record<string, string>>({});
  readonly emit = input<(event: string) => void>(() => { /* noop */ });
  // Framework inputs required by the render harness.
  readonly bindings = input<Record<string, string>>({});
  readonly loading = input<boolean>(false);
  readonly childKeys = input<string[]>([]);
  readonly spec = input<Spec | undefined>(undefined);

  protected readonly htmlInputType = computed(() =>
    TYPE_MAP[this.textFieldType()] ?? 'text',
  );

  onInput(event: Event): void {
    const val = (event.target as HTMLInputElement | HTMLTextAreaElement).value;
    // Emit on 'text' binding (v1 prop name); also try 'value' for compat.
    const bound = this._bindings();
    if (bound['text']) {
      emitBinding(this.emit(), bound, 'text', val);
    } else {
      emitBinding(this.emit(), bound, 'value', val);
    }
  }
}
