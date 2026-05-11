// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CHAT_DEBUG_TOKENS } from '../chat-debug-tokens';

@Component({
  selector: 'chat-debug-switch',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    CHAT_DEBUG_TOKENS,
    `
    :host { display: block; }
    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--ngaf-chat-space-3, 12px);
      font-size: 13px;
      color: var(--ngaf-chat-debug-text);
    }
    .switch {
      position: relative;
      width: 36px;
      height: 20px;
      background: var(--ngaf-chat-debug-border);
      border: 0;
      border-radius: 999px;
      cursor: pointer;
      padding: 0;
      transition: background 150ms ease;
      flex-shrink: 0;
    }
    .switch.is-on { background: var(--ngaf-chat-debug-accent); }
    .switch__thumb {
      position: absolute;
      top: 2px;
      left: 2px;
      width: 16px;
      height: 16px;
      background: var(--ngaf-chat-debug-text);
      border-radius: 50%;
      transition: transform 150ms ease;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
    }
    .switch.is-on .switch__thumb { transform: translateX(16px); }
    `,
  ],
  template: `
    <div class="row">
      <span>{{ label() }}</span>
      <button
        type="button"
        role="switch"
        class="switch"
        [class.is-on]="value()"
        [attr.aria-checked]="value()"
        [attr.aria-label]="label()"
        (click)="valueChange.emit(!value())"
      >
        <span class="switch__thumb"></span>
      </button>
    </div>
  `,
})
export class ChatDebugSwitchComponent {
  readonly label = input.required<string>();
  readonly value = input.required<boolean>();
  readonly valueChange = output<boolean>();
}
