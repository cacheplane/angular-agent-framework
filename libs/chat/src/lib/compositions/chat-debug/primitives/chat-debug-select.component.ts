// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CHAT_HOST_TOKENS } from '../../../styles/chat-tokens';

export interface SelectOption {
  readonly value: string;
  readonly label: string;
}

@Component({
  selector: 'chat-debug-select',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    CHAT_HOST_TOKENS,
    `
    :host { display: block; }
    label {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--ngaf-chat-space-3);
      font-size: var(--ngaf-chat-font-size-sm);
      color: var(--ngaf-chat-text);
    }
    select {
      appearance: none;
      background: var(--ngaf-chat-bg);
      color: var(--ngaf-chat-text);
      border: 1px solid var(--ngaf-chat-separator);
      border-radius: var(--ngaf-chat-radius-button);
      padding: 4px 8px;
      font: inherit;
      font-size: var(--ngaf-chat-font-size-sm);
    }
    `,
  ],
  template: `
    <label>
      <span>{{ label() }}</span>
      <select
        [value]="value()"
        (change)="onChange($event)"
        [attr.aria-label]="label()"
      >
        @for (opt of options(); track opt.value) {
          <option [value]="opt.value" [selected]="opt.value === value()">{{ opt.label }}</option>
        }
      </select>
    </label>
  `,
})
export class ChatDebugSelectComponent {
  readonly label = input.required<string>();
  readonly options = input.required<readonly SelectOption[]>();
  readonly value = input.required<string>();
  readonly valueChange = output<string>();

  protected onChange(event: Event): void {
    this.valueChange.emit((event.target as HTMLSelectElement).value);
  }
}
