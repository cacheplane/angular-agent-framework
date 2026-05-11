// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CHAT_HOST_TOKENS } from '../../../styles/chat-tokens';

@Component({
  selector: 'chat-debug-toggle',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    CHAT_HOST_TOKENS,
    `
    :host { display: block; }
    button {
      display: inline-flex;
      align-items: center;
      gap: var(--ngaf-chat-space-2);
      appearance: none;
      background: transparent;
      border: 1px solid var(--ngaf-chat-separator);
      border-radius: var(--ngaf-chat-radius-button);
      padding: 4px 10px;
      font: inherit;
      font-size: var(--ngaf-chat-font-size-sm);
      color: var(--ngaf-chat-text);
      cursor: pointer;
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--ngaf-chat-muted);
    }
    button.is-on .dot { background: var(--ngaf-chat-success); }
    `,
  ],
  template: `
    <button
      type="button"
      [class.is-on]="value()"
      [attr.aria-pressed]="value()"
      (click)="valueChange.emit(!value())"
    >
      <span class="dot"></span>
      <span>{{ label() }}</span>
    </button>
  `,
})
export class ChatDebugToggleComponent {
  readonly label = input.required<string>();
  readonly value = input.required<boolean>();
  readonly valueChange = output<boolean>();
}
