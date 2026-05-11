// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CHAT_HOST_TOKENS } from '../../../styles/chat-tokens';

@Component({
  selector: 'chat-debug-action',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    CHAT_HOST_TOKENS,
    `
    :host { display: block; }
    button {
      appearance: none;
      background: var(--ngaf-chat-bg);
      color: var(--ngaf-chat-text);
      border: 1px solid var(--ngaf-chat-separator);
      border-radius: var(--ngaf-chat-radius-button);
      padding: 8px var(--ngaf-chat-space-3);
      font: inherit;
      font-size: var(--ngaf-chat-font-size-sm);
      font-weight: 500;
      cursor: pointer;
      width: 100%;
      text-align: center;
      transition: background 120ms ease, border-color 120ms ease, transform 80ms ease;
    }
    button:hover {
      background: var(--ngaf-chat-surface-alt);
      border-color: var(--ngaf-chat-text-muted);
    }
    button:active { transform: translateY(1px); }
    `,
  ],
  template: `
    <button type="button" (click)="clicked.emit()">{{ label() }}</button>
  `,
})
export class ChatDebugActionComponent {
  readonly label = input.required<string>();
  readonly clicked = output<void>();
}
