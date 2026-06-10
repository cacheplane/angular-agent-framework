// SPDX-License-Identifier: MIT
import { Component, computed, input, ChangeDetectionStrategy } from '@angular/core';
import type { Spec } from '@json-render/core';
import { injectRenderHost } from '@threadplane/render';
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
    <div class="a2ui-tf">
      @if (label()) {
        <label [htmlFor]="_inputId" class="a2ui-tf__label">{{ label() }}</label>
      }
      @if (textFieldType() === 'longText') {
        <textarea
          [id]="_inputId"
          [value]="value()"
          [placeholder]="placeholder()"
          rows="4"
          class="a2ui-tf__input"
          (input)="onInput($event)"
        ></textarea>
      } @else {
        <input
          [id]="_inputId"
          [type]="htmlInputType()"
          [value]="value()"
          [placeholder]="placeholder()"
          [pattern]="validationRegexp() || ''"
          class="a2ui-tf__input"
          (input)="onInput($event)"
        />
      }
    </div>
  `,
  styles: [`
    .a2ui-tf { display: flex; flex-direction: column; gap: var(--a2ui-spacing-1); }
    .a2ui-tf__label {
      font-size: var(--a2ui-typography-label-size);
      font-weight: var(--a2ui-typography-label-weight);
      color: var(--a2ui-label);
    }
    .a2ui-tf__input {
      padding: var(--a2ui-spacing-2) var(--a2ui-spacing-3);
      font-size: var(--a2ui-typography-body-size);
      border-radius: var(--a2ui-shape-small);
      background: var(--a2ui-input-bg);
      color: var(--a2ui-on-surface);
      border: 1px solid var(--a2ui-outline);
      outline: none;
      transition: border-color var(--a2ui-motion-duration-short) var(--a2ui-motion-easing-standard);
      resize: vertical;
    }
    .a2ui-tf__input:focus {
      outline: var(--a2ui-focus-ring-width) solid var(--a2ui-focus-ring-color);
      outline-offset: 2px;
      border-color: var(--a2ui-primary);
    }
  `],
})
export class A2uiTextFieldComponent {
  private static _idCounter = 0;
  protected readonly _inputId = `a2ui-text-field-${++A2uiTextFieldComponent._idCounter}`;

  private readonly host = injectRenderHost();

  readonly label = input<string>('');
  /** v1 prop: text (resolved string value). */
  readonly text = input<string>('');
  /** Back-compat alias: value. surface-to-spec resolves DynamicString → plain string. */
  readonly value = computed(() => this.text() ?? '');
  readonly placeholder = input<string>('');
  readonly textFieldType = input<TextFieldType>('shortText');
  readonly validationRegexp = input<string>('');
  readonly _bindings = input<Record<string, string>>({});
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
      emitBinding(this.host, bound, 'text', val);
    } else {
      emitBinding(this.host, bound, 'value', val);
    }
  }
}
