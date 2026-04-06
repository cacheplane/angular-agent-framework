// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  Component,
  computed,
  input,
  ChangeDetectionStrategy,
} from '@angular/core';
import type { StreamResourceRef } from '@cacheplane/stream-resource';

export function isTyping(ref: StreamResourceRef<any, any>): boolean {
  return ref.isLoading();
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
      <div role="status" aria-label="Agent is typing" class="flex flex-col gap-1.5">
        <div class="flex items-center gap-2">
          <div
            class="w-6 h-6 flex items-center justify-center text-[11px] font-semibold shrink-0"
            style="background: var(--chat-avatar-bg); color: var(--chat-avatar-text); border-radius: var(--chat-radius-avatar);"
          >A</div>
          <span class="text-xs font-medium" style="color: var(--chat-text-muted);">Assistant</span>
          <div class="flex items-center gap-1 pl-1">
            <span class="chat-dot"></span>
            <span class="chat-dot"></span>
            <span class="chat-dot"></span>
          </div>
        </div>
      </div>
    }
  `,
})
export class ChatTypingIndicatorComponent {
  readonly ref = input.required<StreamResourceRef<any, any>>();
  readonly visible = computed(() => this.ref().isLoading());
}
