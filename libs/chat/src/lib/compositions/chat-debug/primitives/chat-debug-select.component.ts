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
    .select-wrap {
      position: relative;
      flex: 1;
      max-width: 60%;
    }
    select {
      appearance: none;
      -webkit-appearance: none;
      width: 100%;
      background: var(--ngaf-chat-bg);
      color: var(--ngaf-chat-text);
      border: 1px solid var(--ngaf-chat-separator);
      border-radius: var(--ngaf-chat-radius-button);
      padding: 5px 26px 5px 10px;
      font: inherit;
      font-size: var(--ngaf-chat-font-size-sm);
      cursor: pointer;
      transition: border-color 120ms ease, background 120ms ease;
    }
    select:hover  { border-color: var(--ngaf-chat-text-muted); }
    select:focus  { outline: none; border-color: var(--ngaf-chat-primary); }
    .chevron {
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      pointer-events: none;
      color: var(--ngaf-chat-text-muted);
      display: flex;
    }
    `,
  ],
  template: `
    <label>
      <span>{{ label() }}</span>
      <span class="select-wrap">
        <select
          [value]="value()"
          (change)="onChange($event)"
          [attr.aria-label]="label()"
        >
          @for (opt of options(); track opt.value) {
            <option [value]="opt.value" [selected]="opt.value === value()">{{ opt.label }}</option>
          }
        </select>
        <span class="chevron" aria-hidden="true">
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4.5L6 7.5L9 4.5"/></svg>
        </span>
      </span>
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
