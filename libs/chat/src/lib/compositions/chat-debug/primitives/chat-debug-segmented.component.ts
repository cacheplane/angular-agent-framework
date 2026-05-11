// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CHAT_HOST_TOKENS } from '../../../styles/chat-tokens';

export interface SegmentedOption {
  readonly value: string;
  readonly label: string;
}

@Component({
  selector: 'chat-debug-segmented',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    CHAT_HOST_TOKENS,
    `
    :host { display: block; }
    .segmented {
      display: inline-flex;
      gap: 0;
      padding: 3px;
      background: var(--ngaf-chat-surface-alt);
      border: 1px solid var(--ngaf-chat-separator);
      border-radius: var(--ngaf-chat-radius-button);
      width: 100%;
      box-sizing: border-box;
    }
    .segmented__btn {
      appearance: none;
      border: 0;
      background: transparent;
      padding: 6px var(--ngaf-chat-space-3);
      font: inherit;
      font-size: var(--ngaf-chat-font-size-sm);
      font-weight: 500;
      color: var(--ngaf-chat-text-muted);
      cursor: pointer;
      border-radius: calc(var(--ngaf-chat-radius-button) - 3px);
      flex: 1;
      transition: color 120ms ease, background 120ms ease;
    }
    .segmented__btn:hover:not(.is-active) { color: var(--ngaf-chat-text); }
    .segmented__btn.is-active {
      background: var(--ngaf-chat-bg);
      color: var(--ngaf-chat-text);
      box-shadow: var(--ngaf-chat-shadow-sm), 0 0 0 1px var(--ngaf-chat-separator);
    }
    `,
  ],
  template: `
    <div class="segmented" role="tablist">
      @for (opt of options(); track opt.value) {
        <button
          type="button"
          role="tab"
          class="segmented__btn"
          [class.is-active]="opt.value === value()"
          [attr.aria-selected]="opt.value === value()"
          (click)="valueChange.emit(opt.value)"
        >{{ opt.label }}</button>
      }
    </div>
  `,
})
export class ChatDebugSegmentedComponent {
  readonly options = input.required<readonly SegmentedOption[]>();
  readonly value = input.required<string>();
  readonly valueChange = output<string>();
}
