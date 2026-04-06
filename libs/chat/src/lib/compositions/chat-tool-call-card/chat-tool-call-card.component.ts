// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  Component,
  input,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';

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
          <span style="color: var(--chat-text-muted);"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg></span>
          <span class="font-mono" [style.color]="'var(--chat-text)'">{{ toolCall().name }}</span>
          @if (toolCall().result !== undefined) {
            <span class="flex items-center gap-1 text-xs" style="color: var(--chat-success);"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 6L5 8.5L9.5 3.5"/></svg> done</span>
          }
        </div>
        <span class="text-xs" style="color: var(--chat-text-muted);">@if (expanded()) {<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7.5L6 4.5L9 7.5"/></svg>} @else {<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4.5L6 7.5L9 4.5"/></svg>}</span>
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


  formatJson(value: unknown): string {
    if (typeof value === 'string') return value;
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
}
