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
    <div class="rounded-lg border border-gray-200 bg-gray-50 overflow-hidden">
      <!-- Card header (always visible, click to toggle) -->
      <button
        class="w-full flex items-center justify-between px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors text-left"
        (click)="expanded.set(!expanded())"
        [attr.aria-expanded]="expanded()"
      >
        <div class="flex items-center gap-2">
          <span class="text-gray-400">⚙</span>
          <span class="font-mono">{{ toolCall().name }}</span>
          @if (toolCall().result !== undefined) {
            <span class="text-xs text-green-600 font-normal">✓ done</span>
          }
        </div>
        <span class="text-gray-400 text-xs">{{ expanded() ? '▲' : '▼' }}</span>
      </button>

      <!-- Expanded content: inputs and outputs -->
      @if (expanded()) {
        <div class="border-t border-gray-200 divide-y divide-gray-100">
          <div class="px-4 py-3">
            <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Inputs</p>
            <pre class="text-xs text-gray-700 overflow-x-auto whitespace-pre-wrap">{{ formatJson(toolCall().args) }}</pre>
          </div>
          @if (toolCall().result !== undefined) {
            <div class="px-4 py-3">
              <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Output</p>
              <pre class="text-xs text-gray-700 overflow-x-auto whitespace-pre-wrap">{{ formatJson(toolCall().result) }}</pre>
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
