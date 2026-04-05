// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  Component,
  computed,
  input,
  ChangeDetectionStrategy,
} from '@angular/core';
import type { StreamResourceRef } from '@cacheplane/stream-resource';
import { ChatMessagesComponent } from '../../primitives/chat-messages/chat-messages.component';
import { MessageTemplateDirective } from '../../primitives/chat-messages/message-template.directive';
import { ChatInputComponent } from '../../primitives/chat-input/chat-input.component';
import { ChatTypingIndicatorComponent } from '../../primitives/chat-typing-indicator/chat-typing-indicator.component';
import { ChatErrorComponent } from '../../primitives/chat-error/chat-error.component';
import { ChatInterruptComponent } from '../../primitives/chat-interrupt/chat-interrupt.component';
import type { BaseMessage } from '@langchain/core/messages';

@Component({
  selector: 'chat',
  standalone: true,
  imports: [
    ChatMessagesComponent,
    MessageTemplateDirective,
    ChatInputComponent,
    ChatTypingIndicatorComponent,
    ChatErrorComponent,
    ChatInterruptComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col h-full">
      <!-- Messages area (scrollable) -->
      <div class="flex-1 overflow-y-auto p-4 space-y-3">
        <chat-messages [ref]="ref()">
          <ng-template messageTemplate="human" let-message>
            <div class="flex justify-end">
              <div class="max-w-[75%] rounded-2xl px-4 py-2 bg-blue-600 text-white">
                {{ messageContent(message) }}
              </div>
            </div>
          </ng-template>

          <ng-template messageTemplate="ai" let-message>
            <div class="flex justify-start">
              <div class="max-w-[75%] rounded-2xl px-4 py-2 bg-gray-100 text-gray-900">
                {{ messageContent(message) }}
              </div>
            </div>
          </ng-template>

          <ng-template messageTemplate="tool" let-message>
            <div class="flex justify-start">
              <div class="max-w-[75%] rounded-lg px-3 py-2 bg-gray-50 text-gray-600 text-sm font-mono border border-gray-200">
                {{ messageContent(message) }}
              </div>
            </div>
          </ng-template>

          <ng-template messageTemplate="system" let-message>
            <div class="flex justify-center">
              <div class="text-xs text-gray-400 italic">
                {{ messageContent(message) }}
              </div>
            </div>
          </ng-template>
        </chat-messages>

        <!-- Typing indicator -->
        <chat-typing-indicator [ref]="ref()">
          <div class="flex justify-start">
            <div class="rounded-2xl px-4 py-2 bg-gray-100 text-gray-500 text-sm">
              <span class="animate-pulse">Thinking...</span>
            </div>
          </div>
        </chat-typing-indicator>
      </div>

      <!-- Interrupt banner -->
      <chat-interrupt [ref]="ref()">
        <ng-template let-interrupt>
          <div class="px-4 py-3 bg-amber-50 border-t border-amber-200">
            <p class="text-sm text-amber-800">Agent paused: {{ interrupt.value }}</p>
          </div>
        </ng-template>
      </chat-interrupt>

      <!-- Error banner -->
      <chat-error [ref]="ref()">
        <div class="px-4 py-3 bg-red-50 border-t border-red-200 text-sm text-red-700">
          An error occurred. Please try again.
        </div>
      </chat-error>

      <!-- Input area -->
      <div class="border-t border-gray-200 p-4">
        <chat-input
          [ref]="ref()"
          [submitOnEnter]="true"
          placeholder="Type a message..."
        />
      </div>
    </div>
  `,
})
export class ChatComponent {
  readonly ref = input.required<StreamResourceRef<any, any>>();

  messageContent(message: BaseMessage): string {
    const content = message.content;
    if (typeof content === 'string') return content;
    return JSON.stringify(content);
  }
}
