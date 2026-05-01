// libs/chat/src/lib/primitives/chat-message/chat-message.component.ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';
import { CHAT_MESSAGE_STYLES } from '../../styles/chat-message.styles';

export type ChatMessageRole = 'user' | 'assistant' | 'system' | 'tool';

@Component({
  selector: 'chat-message',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [CHAT_HOST_TOKENS, CHAT_MESSAGE_STYLES],
  host: {
    '[attr.data-role]': 'role()',
    '[attr.data-current]': 'currentStr()',
    '[attr.data-prev-role]': 'prevRole() ?? null',
  },
  template: `
    @switch (role()) {
      @case ('user') {
        <div class="chat-message__bubble"><ng-content /></div>
      }
      @case ('assistant') {
        <div class="chat-message__assistant-body">
          <ng-content />
          @if (streaming() && current()) {
            <span class="chat-message__caret" aria-hidden="true">▍</span>
          }
        </div>
        <div class="chat-message__controls">
          <ng-content select="[chatMessageControls]" />
        </div>
      }
      @default {
        <div><ng-content /></div>
      }
    }
  `,
})
export class ChatMessageComponent {
  readonly role = input.required<ChatMessageRole>();
  readonly current = input(false);
  readonly streaming = input(false);
  readonly prevRole = input<ChatMessageRole | undefined>(undefined);

  readonly currentStr = computed(() => String(this.current()));
}
