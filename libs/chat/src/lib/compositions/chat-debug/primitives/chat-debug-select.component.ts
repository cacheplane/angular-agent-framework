// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input, output, computed } from '@angular/core';
import { CHAT_DEBUG_TOKENS } from '../chat-debug-tokens';

export interface SelectOption {
  readonly value: string;
  readonly label: string;
}

@Component({
  selector: 'chat-debug-select',
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
      gap: 12px;
      font-size: 13px;
      color: var(--ngaf-chat-debug-text);
    }
    .select {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      min-width: 140px;
      background: var(--ngaf-chat-debug-bg-deep);
      border: 1px solid var(--ngaf-chat-debug-border);
      border-radius: 6px;
      padding: 6px 10px;
      font-size: 12px;
      color: var(--ngaf-chat-debug-text);
      cursor: pointer;
    }
    .select:hover { background: #0f0f12; }
    .select:focus-within {
      border-color: var(--ngaf-chat-debug-accent);
      outline: 2px solid color-mix(in srgb, var(--ngaf-chat-debug-accent) 30%, transparent);
      outline-offset: 1px;
    }
    .select__value {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .select__caret {
      color: var(--ngaf-chat-debug-text-subtle);
      font-size: 10px;
      line-height: 1;
    }
    .select select {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      opacity: 0;
      cursor: pointer;
      border: 0;
      background: transparent;
      font: inherit;
      color: inherit;
    }
    `,
  ],
  template: `
    <label class="row">
      <span>{{ label() }}</span>
      <span class="select">
        <span class="select__value">{{ currentLabel() }}</span>
        <span class="select__caret" aria-hidden="true">▾</span>
        <select
          [value]="value()"
          (change)="onChange($event)"
          [attr.aria-label]="label()"
        >
          @for (opt of options(); track opt.value) {
            <option [value]="opt.value" [selected]="opt.value === value()">{{ opt.label }}</option>
          }
        </select>
      </span>
    </label>
  `,
})
export class ChatDebugSelectComponent {
  readonly label = input.required<string>();
  readonly options = input.required<readonly SelectOption[]>();
  readonly value = input.required<string>();
  readonly valueChange = output<string>();

  protected readonly currentLabel = computed((): string => {
    const v = this.value();
    return this.options().find((o) => o.value === v)?.label ?? v;
  });

  protected onChange(event: Event): void {
    this.valueChange.emit((event.target as HTMLSelectElement).value);
  }
}
