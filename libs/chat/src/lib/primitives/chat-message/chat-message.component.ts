// libs/chat/src/lib/primitives/chat-message/chat-message.component.ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input, output, computed, effect, inject } from '@angular/core';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';
import { CHAT_MESSAGE_STYLES } from '../../styles/chat-message.styles';
import { ChatCitationsComponent } from '../chat-citations/chat-citations.component';
import { ChatCheckpointMarkerComponent } from '../chat-checkpoint-marker/chat-checkpoint-marker.component';
import { CitationsResolverService } from '../../markdown/citations-resolver.service';
import type { Message } from '../../agent/message';

export type ChatMessageRole = 'user' | 'assistant' | 'system' | 'tool';

@Component({
  selector: 'chat-message',
  standalone: true,
  imports: [ChatCitationsComponent, ChatCheckpointMarkerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [CHAT_HOST_TOKENS, CHAT_MESSAGE_STYLES, `
    .chat-message__layout { display: flex; gap: 8px; align-items: flex-start; }
    .chat-message__gutter { flex: 0 0 14px; display: flex; align-items: flex-start; padding-top: 4px; }
    .chat-message__gutter:empty { flex-basis: 0; }
    .chat-message__main { flex: 1; min-width: 0; }
  `],
  providers: [CitationsResolverService],
  host: {
    '[attr.data-role]': 'role()',
    '[attr.data-current]': 'currentStr()',
    '[attr.data-streaming]': 'streamingStr()',
    '[attr.data-prev-role]': 'prevRole() ?? null',
  },
  template: `
    <div class="chat-message__layout">
      <div class="chat-message__gutter">
        @if (checkpointId(); as cpId) {
          <chat-checkpoint-marker
            [checkpointId]="cpId"
            [isActive]="checkpointActive()"
            (replayRequested)="replayRequested.emit($event)"
            (forkRequested)="forkRequested.emit($event)"
          />
        }
      </div>
      <div class="chat-message__main">
        <div [class]="bodyClass()">
          <ng-content />
          <span class="chat-message__caret" aria-hidden="true"></span>
        </div>
        @if (message()?.role === 'assistant' && message(); as msg) {
          <chat-citations [message]="msg" />
        }
        <div class="chat-message__controls">
          <ng-content select="[chatMessageControls]" />
        </div>
      </div>
    </div>
  `,
})
export class ChatMessageComponent {
  readonly role = input.required<ChatMessageRole>();
  readonly current = input(false);
  readonly streaming = input(false);
  readonly prevRole = input<ChatMessageRole | undefined>(undefined);
  readonly message = input<Message | undefined>(undefined);

  /** Optional checkpoint id to anchor a gutter marker. When set, a
   *  chat-checkpoint-marker is rendered in the left gutter and emits
   *  bubble through this component's replayRequested / forkRequested outputs. */
  readonly checkpointId = input<string | undefined>(undefined);
  readonly checkpointActive = input<boolean>(false);

  readonly replayRequested = output<string>();
  readonly forkRequested = output<string>();

  private readonly resolver = inject(CitationsResolverService);

  constructor() {
    effect(() => {
      this.resolver.message.set(this.message() ?? null);
    });
  }

  readonly currentStr = computed(() => String(this.current()));
  readonly streamingStr = computed(() => String(this.streaming()));

  readonly bodyClass = computed(() => {
    switch (this.role()) {
      case 'user': return 'chat-message__bubble';
      case 'assistant': return 'chat-message__assistant-body';
      default: return 'chat-message__plain';
    }
  });
}
