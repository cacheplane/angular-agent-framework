// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CHAT_DEBUG_TOKENS } from '../chat-debug-tokens';

export interface SegmentedOption {
  readonly value: string;
  readonly label: string;
}

@Component({
  selector: 'chat-debug-segmented',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    CHAT_DEBUG_TOKENS,
    `
    :host { display: block; }
    .segmented {
      display: flex;
      width: 100%;
      box-sizing: border-box;
      background: var(--ngaf-chat-debug-bg-deep);
      border: 1px solid var(--ngaf-chat-debug-border);
      border-radius: var(--ngaf-chat-debug-radius-input);
      padding: 3px;
      gap: 0;
    }
    .segmented__btn {
      flex: 1;
      appearance: none;
      background: transparent;
      border: 0;
      color: var(--ngaf-chat-debug-text-muted);
      padding: 6px 8px;
      border-radius: 5px;
      font: inherit;
      font-size: 12px;
      cursor: pointer;
      transition: background 120ms ease, color 120ms ease;
    }
    .segmented__btn:hover:not(.is-active) {
      background: var(--ngaf-chat-debug-bg);
      color: var(--ngaf-chat-debug-text);
    }
    .segmented__btn.is-active {
      background: var(--ngaf-chat-debug-border);
      color: var(--ngaf-chat-debug-text);
      font-weight: 500;
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
