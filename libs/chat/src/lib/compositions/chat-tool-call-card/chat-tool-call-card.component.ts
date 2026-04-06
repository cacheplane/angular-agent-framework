// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  Component,
  input,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { ICON_TOOL, ICON_CHECK, ICON_CHEVRON_UP, ICON_CHEVRON_DOWN } from '../../styles/chat-icons';

export interface ToolCallInfo {
  id: string;
  name: string;
  args: unknown;
  result?: unknown;
}

@Component({
  selector: 'chat-tool-call-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="border overflow-hidden" style="background: var(--chat-bg-alt); border-color: var(--chat-border); border-radius: var(--chat-radius-card);">
      <!-- Card header (always visible, click to toggle) -->
      <button
        class="w-full flex items-center justify-between px-4 py-2 text-sm font-medium bg-transparent border-0 cursor-pointer text-left transition-colors duration-150"
        [style.color]="'var(--chat-text)'"
        (click)="expanded.set(!expanded())"
        [attr.aria-expanded]="expanded()"
        aria-label="Toggle tool call details"
      >
        <div class="flex items-center gap-2">
          <span style="color: var(--chat-text-muted);" [innerHTML]="toolIcon"></span>
          <span class="font-mono" [style.color]="'var(--chat-text)'">{{ toolCall().name }}</span>
          @if (toolCall().result !== undefined) {
            <span class="flex items-center gap-1 text-xs" style="color: var(--chat-success);"><span [innerHTML]="checkIcon"></span> done</span>
          }
        </div>
        <span class="text-xs" style="color: var(--chat-text-muted);"><span [innerHTML]="expanded() ? chevronUp : chevronDown"></span></span>
      </button>

      <!-- Expanded content: inputs and outputs -->
      @if (expanded()) {
        <div style="border-top: 1px solid var(--chat-border);">
          <div class="px-4 py-3">
            <p class="text-[11px] font-semibold uppercase tracking-widest m-0 mb-1" style="color: var(--chat-text-muted);">Inputs</p>
            <pre class="text-xs overflow-x-auto whitespace-pre-wrap m-0" [style.color]="'var(--chat-text)'">{{ formatJson(toolCall().args) }}</pre>
          </div>
          @if (toolCall().result !== undefined) {
            <div class="px-4 py-3" style="border-top: 1px solid var(--chat-border);">
              <p class="text-[11px] font-semibold uppercase tracking-widest m-0 mb-1" style="color: var(--chat-text-muted);">Output</p>
              <pre class="text-xs overflow-x-auto whitespace-pre-wrap m-0" [style.color]="'var(--chat-text)'">{{ formatJson(toolCall().result) }}</pre>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class ChatToolCallCardComponent {
  readonly toolCall = input.required<ToolCallInfo>();

  readonly expanded = signal(false);

  readonly toolIcon = ICON_TOOL;
  readonly checkIcon = ICON_CHECK;
  readonly chevronUp = ICON_CHEVRON_UP;
  readonly chevronDown = ICON_CHEVRON_DOWN;

  formatJson(value: unknown): string {
    if (typeof value === 'string') return value;
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
}
