// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  Component,
  computed,
  input,
  ChangeDetectionStrategy,
} from '@angular/core';
import type { StreamResourceRef } from '@cacheplane/stream-resource';

/**
 * Returns whether the typing indicator should be visible.
 * Exported for unit testing without DOM rendering.
 */
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
      background: var(--chat-text-muted, #777);
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
      <div role="status" aria-label="Agent is typing" style="display: flex; flex-direction: column; gap: 6px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="
            width: 24px;
            height: 24px;
            background: var(--chat-avatar-bg, #333333);
            color: var(--chat-avatar-text, #aaaaaa);
            border-radius: var(--chat-radius-avatar, 8px);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 11px;
            font-weight: 600;
            flex-shrink: 0;
          ">A</div>
          <span style="font-size: 12px; color: var(--chat-text-muted, #777777); font-weight: 500;">Assistant</span>
          <div style="display: flex; align-items: center; gap: 4px; padding-left: 4px;">
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
