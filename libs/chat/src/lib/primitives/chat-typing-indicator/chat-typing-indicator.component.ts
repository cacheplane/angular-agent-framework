// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  Component,
  computed,
  input,
  ChangeDetectionStrategy,
} from '@angular/core';
import type { ChatAgent } from '../../agent';

export function isTyping(agent: ChatAgent): boolean {
  if (!agent.isLoading()) return false;
  const msgs = agent.messages();
  if (msgs.length === 0) return true;
  const last = msgs[msgs.length - 1];
  if (last.role === 'user') return true;
  if (last.role === 'assistant') {
    // Empty assistant message: string is empty or content block array is empty
    return typeof last.content === 'string'
      ? !last.content
      : last.content.length === 0;
  }
  return false;
}

@Component({
  selector: 'chat-typing-indicator',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    .chat-dot {
      display: inline-block;
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: var(--chat-text-muted);
      animation: chat-dot-pulse 1.4s ease-in-out infinite;
    }
    .chat-dot:nth-child(2) { animation-delay: 0.2s; }
    .chat-dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes chat-dot-pulse {
      0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
      40% { opacity: 1; transform: scale(1); }
    }
  `],
  template: `
    @if (visible()) {
      <div role="status" aria-label="Agent is typing" class="flex items-center gap-3">
        <div
          class="w-7 h-7 flex items-center justify-center text-xs font-semibold shrink-0"
          style="background: var(--chat-avatar-bg); color: var(--chat-avatar-text); border-radius: var(--chat-radius-avatar);"
        >A</div>
        <div class="flex items-center gap-1">
          <span class="chat-dot"></span>
          <span class="chat-dot"></span>
          <span class="chat-dot"></span>
        </div>
      </div>
    }
  `,
})
export class ChatTypingIndicatorComponent {
  readonly agent = input.required<ChatAgent>();
  readonly visible = computed(() => isTyping(this.agent()));
}
