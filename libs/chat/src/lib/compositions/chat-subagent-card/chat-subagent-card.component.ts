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
    <div style="border: 1px solid var(--chat-border); background: var(--chat-bg-alt); border-radius: var(--chat-radius-card); overflow: hidden;">
      <!-- Card header -->
      <button
        style="width: 100%; display: flex; align-items: center; justify-content: space-between; padding: 8px 16px; background: none; border: none; cursor: pointer; text-align: left; transition: background 0.15s;"
        (click)="expanded.set(!expanded())"
        [attr.aria-expanded]="expanded()"
      >
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="color: var(--chat-text-muted); font-size: 14px;">🤖</span>
          <span style="font-size: 14px; font-weight: 500; color: var(--chat-text);">
            Subagent
            <span style="font-family: monospace; font-size: 12px; color: var(--chat-text-muted); margin-left: 4px;">{{ subagent().toolCallId }}</span>
          </span>
          <!-- Status badge -->
          <span style="padding: 2px 8px; border-radius: 999px; font-size: 12px; font-weight: 500;" [style]="statusColor()">
            {{ subagent().status() }}
          </span>
        </div>
        <span style="color: var(--chat-text-muted); font-size: 12px;">{{ expanded() ? '▲' : '▼' }}</span>
      </button>

      <!-- Expanded content -->
      @if (expanded()) {
        <div style="border-top: 1px solid var(--chat-border); padding: 12px 16px; display: flex; flex-direction: column; gap: 12px;">
          <!-- Messages count -->
          <div style="font-size: 12px; color: var(--chat-text-muted);">
            {{ subagent().messages().length }} message(s)
          </div>

          <!-- Latest values -->
          @if (subagent().messages().length > 0) {
            <div>
              <p style="font-size: 11px; font-weight: 600; color: var(--chat-text-muted); text-transform: uppercase; letter-spacing: 0.08em; margin: 0 0 4px;">Latest Message</p>
              <div style="font-size: 12px; color: var(--chat-text); background: var(--chat-bg); border-radius: var(--chat-radius-card); padding: 8px; font-family: monospace;">
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
