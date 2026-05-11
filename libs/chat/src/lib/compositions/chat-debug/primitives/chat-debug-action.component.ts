// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CHAT_DEBUG_TOKENS } from '../chat-debug-tokens';

@Component({
  selector: 'chat-debug-action',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    CHAT_DEBUG_TOKENS,
    `
    :host { display: block; }
    button {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      background: var(--ngaf-chat-debug-bg);
      color: var(--ngaf-chat-debug-text);
      border: 1px solid var(--ngaf-chat-debug-border-strong);
      border-radius: var(--ngaf-chat-debug-radius-input);
      padding: 8px;
      font: inherit;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: background 120ms ease, transform 80ms ease;
    }
    button:hover { background: var(--ngaf-chat-debug-surface); }
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
