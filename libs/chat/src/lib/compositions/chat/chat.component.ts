// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  Component,
  input,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';
import type { StreamResourceRef } from '@cacheplane/stream-resource';
import { ChatMessagesComponent } from '../../primitives/chat-messages/chat-messages.component';
import { MessageTemplateDirective } from '../../primitives/chat-messages/message-template.directive';
import { ChatInputComponent } from '../../primitives/chat-input/chat-input.component';
import { ChatTypingIndicatorComponent } from '../../primitives/chat-typing-indicator/chat-typing-indicator.component';
import { ChatErrorComponent } from '../../primitives/chat-error/chat-error.component';
import { ChatInterruptComponent } from '../../primitives/chat-interrupt/chat-interrupt.component';
import { ChatThreadListComponent, Thread } from '../../primitives/chat-thread-list/chat-thread-list.component';
import { messageContent } from '../shared/message-utils';

@Component({
  selector: 'chat-ui',
  standalone: true,
  imports: [
    ChatMessagesComponent,
    MessageTemplateDirective,
    ChatInputComponent,
    ChatTypingIndicatorComponent,
    ChatErrorComponent,
    ChatInterruptComponent,
    ChatThreadListComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex h-full">
      <!-- Thread sidebar (optional) -->
      @if (threads().length > 0) {
        <div class="w-64 border-r border-gray-200 bg-gray-50 overflow-y-auto shrink-0">
          <div class="px-3 py-2 border-b border-gray-200">
            <h2 class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Threads</h2>
          </div>
          <chat-thread-list
            [threads]="threads()"
            [activeThreadId]="activeThreadId()"
            (threadSelected)="threadSelected.emit($event)"
          >
            <ng-template let-thread let-isActive="isActive">
              <button
                class="w-full text-left px-3 py-2 text-sm transition-colors {{ isActive ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-100' }}"
                (click)="threadSelected.emit(thread.id)"
              >
                {{ thread.id }}
              </button>
            </ng-template>
          </chat-thread-list>
        </div>
      }

      <!-- Chat area -->
      <div class="flex flex-col flex-1 min-w-0">
        <!-- Messages area (scrollable) -->
        <div class="flex-1 overflow-y-auto p-4 space-y-3">
          <chat-messages [ref]="ref()">
            <ng-template chatMessageTemplate="human" let-message>
              <div class="flex justify-end">
                <div class="max-w-[75%] rounded-2xl px-4 py-2 bg-blue-600 text-white">
                  {{ messageContent(message) }}
                </div>
              </div>
            </ng-template>

            <ng-template chatMessageTemplate="ai" let-message>
              <div class="flex justify-start">
                <div class="max-w-[75%] rounded-2xl px-4 py-2 bg-gray-100 text-gray-900">
                  {{ messageContent(message) }}
                </div>
              </div>
            </ng-template>

            <ng-template chatMessageTemplate="tool" let-message>
              <div class="flex justify-start">
                <div class="max-w-[75%] rounded-lg px-3 py-2 bg-gray-50 text-gray-600 text-sm font-mono border border-gray-200">
                  {{ messageContent(message) }}
                </div>
              </div>
            </ng-template>

            <ng-template chatMessageTemplate="system" let-message>
              <div class="flex justify-center">
                <div class="text-xs text-gray-400 italic">
                  {{ messageContent(message) }}
                </div>
              </div>
            </ng-template>
          </chat-messages>

          <!-- Typing indicator -->
          <chat-typing-indicator [ref]="ref()" />
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
        <chat-error [ref]="ref()" />

        <!-- Input area -->
        <div class="border-t border-gray-200 p-4">
          <chat-input
            [ref]="ref()"
            [submitOnEnter]="true"
            placeholder="Type a message..."
          />
        </div>
      </div>
    </div>
  `,
})
export class ChatComponent {
  readonly ref = input.required<StreamResourceRef<any, any>>();

  /** Optional list of threads to show in the sidebar. When empty, no sidebar is rendered. */
  readonly threads = input<Thread[]>([]);
  /** The ID of the currently active thread (highlighted in the sidebar). */
  readonly activeThreadId = input<string>('');

  /** Emitted when the user selects a thread from the sidebar. */
  readonly threadSelected = output<string>();

  // Message templates are intentionally co-located (shadcn copy-paste model)
  readonly messageContent = messageContent;
}
