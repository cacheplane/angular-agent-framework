// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  Component,
  computed,
  input,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import type { SubagentStreamRef } from '@cacheplane/stream-resource';

type SubagentStatus = 'pending' | 'running' | 'complete' | 'error';

function statusColor(status: SubagentStatus): string {
  switch (status) {
    case 'pending':  return 'bg-gray-100 text-gray-600';
    case 'running':  return 'bg-blue-100 text-blue-700';
    case 'complete': return 'bg-green-100 text-green-700';
    case 'error':    return 'bg-red-100 text-red-700';
  }
}

export { statusColor };

@Component({
  selector: 'chat-subagent-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <!-- Card header -->
      <button
        class="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50 transition-colors text-left"
        (click)="expanded.set(!expanded())"
        [attr.aria-expanded]="expanded()"
      >
        <div class="flex items-center gap-2">
          <span class="text-gray-400 text-sm">🤖</span>
          <span class="text-sm font-medium text-gray-700">
            Subagent
            <span class="font-mono text-xs text-gray-400 ml-1">{{ subagent().toolCallId }}</span>
          </span>
          <!-- Status badge -->
          <span class="px-2 py-0.5 rounded-full text-xs font-medium {{ statusColor() }}">
            {{ subagent().status() }}
          </span>
        </div>
        <span class="text-gray-400 text-xs">{{ expanded() ? '▲' : '▼' }}</span>
      </button>

      <!-- Expanded content -->
      @if (expanded()) {
        <div class="border-t border-gray-200 px-4 py-3 space-y-3">
          <!-- Messages count -->
          <div class="text-xs text-gray-500">
            {{ subagent().messages().length }} message(s)
          </div>

          <!-- Latest values -->
          @if (subagent().messages().length > 0) {
            <div>
              <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Latest Message</p>
              <div class="text-xs text-gray-700 bg-gray-50 rounded p-2 font-mono">
                {{ latestMessageContent() }}
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class ChatSubagentCardComponent {
  readonly subagent = input.required<SubagentStreamRef>();

  readonly expanded = signal(false);

  readonly statusColor = computed(() => statusColor(this.subagent().status()));

  readonly latestMessageContent = computed(() => {
    const messages = this.subagent().messages();
    if (messages.length === 0) return '';
    const last = messages[messages.length - 1];
    const content = last.content;
    if (typeof content === 'string') return content;
    return JSON.stringify(content);
  });
}
