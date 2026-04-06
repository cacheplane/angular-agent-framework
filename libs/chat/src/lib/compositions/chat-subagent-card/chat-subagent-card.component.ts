// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  Component,
  computed,
  input,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import type { SubagentStreamRef } from '@cacheplane/stream-resource';
import { ICON_AGENT, ICON_CHEVRON_UP, ICON_CHEVRON_DOWN } from '../../styles/chat-icons';

type SubagentStatus = 'pending' | 'running' | 'complete' | 'error';

function statusColor(status: SubagentStatus): string {
  switch (status) {
    case 'pending':  return 'background: var(--chat-bg-alt); color: var(--chat-text-muted);';
    case 'running':  return 'background: var(--chat-warning-bg); color: var(--chat-warning-text);';
    case 'complete': return 'color: var(--chat-success);';
    case 'error':    return 'background: var(--chat-error-bg); color: var(--chat-error-text);';
  }
}

export { statusColor };

@Component({
  selector: 'chat-subagent-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="border overflow-hidden" style="background: var(--chat-bg-alt); border-color: var(--chat-border); border-radius: var(--chat-radius-card);">
      <!-- Card header -->
      <button
        class="w-full flex items-center justify-between px-4 py-2 bg-transparent border-0 cursor-pointer text-left transition-colors duration-150"
        (click)="expanded.set(!expanded())"
        [attr.aria-expanded]="expanded()"
        aria-label="Toggle subagent details"
      >
        <div class="flex items-center gap-2">
          <span style="color: var(--chat-text-muted);" [innerHTML]="agentIcon"></span>
          <span class="text-sm font-medium" [style.color]="'var(--chat-text)'">
            Subagent
            <span class="font-mono text-xs ml-1" style="color: var(--chat-text-muted);">{{ subagent().toolCallId }}</span>
          </span>
          <!-- Status badge -->
          <span class="px-2 py-0.5 rounded-full text-xs font-medium" [style]="statusColor()">
            {{ subagent().status() }}
          </span>
        </div>
        <span class="text-xs" style="color: var(--chat-text-muted);"><span [innerHTML]="expanded() ? chevronUp : chevronDown"></span></span>
      </button>

      <!-- Expanded content -->
      @if (expanded()) {
        <div class="flex flex-col gap-3 px-4 py-3" style="border-top: 1px solid var(--chat-border);">
          <!-- Messages count -->
          <div class="text-xs" style="color: var(--chat-text-muted);">
            {{ subagent().messages().length }} message(s)
          </div>

          <!-- Latest values -->
          @if (subagent().messages().length > 0) {
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-widest m-0 mb-1" style="color: var(--chat-text-muted);">Latest Message</p>
              <div class="text-xs font-mono p-2" style="color: var(--chat-text); background: var(--chat-bg); border-radius: var(--chat-radius-card);">
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

  readonly agentIcon = ICON_AGENT;
  readonly chevronUp = ICON_CHEVRON_UP;
  readonly chevronDown = ICON_CHEVRON_DOWN;

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
