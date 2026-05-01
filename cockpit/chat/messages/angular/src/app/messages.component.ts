// SPDX-License-Identifier: MIT
import { Component } from '@angular/core';
import {
  ChatMessageListComponent,
  ChatInputComponent,
  ChatTypingIndicatorComponent,
} from '@ngaf/chat';
import { ExampleChatLayoutComponent } from '@ngaf/example-layouts';
import { agent } from '@ngaf/langgraph';
import { environment } from '../environments/environment';

/**
 * MessagesComponent demonstrates the chat message primitives from @ngaf/chat.
 *
 * Uses ChatMessagesComponent, ChatInputComponent, and ChatTypingIndicatorComponent
 * individually rather than the composed ChatComponent, giving full control
 * over layout and message rendering.
 */
@Component({
  selector: 'app-messages',
  standalone: true,
  imports: [ChatMessageListComponent, ChatInputComponent, ChatTypingIndicatorComponent, ExampleChatLayoutComponent],
  template: `
    <example-chat-layout sidebarWidth="w-72">
      <div main class="flex-1 flex flex-col min-w-0">
        <header class="px-4 py-3 border-b" style="border-color: var(--ngaf-chat-separator, #333); background: var(--ngaf-chat-bg, #171717);">
          <h1 class="text-sm font-semibold" style="color: var(--ngaf-chat-text, #e0e0e0);">Chat Messages Primitives</h1>
        </header>
        <div class="flex-1 overflow-y-auto">
          <chat-message-list [agent]="agent" />
        </div>
        <div class="px-4 py-2" style="background: var(--ngaf-chat-bg, #171717);">
          <chat-typing-indicator [agent]="agent" />
          <chat-input [agent]="agent" (send)="submitMessage($event)" />
        </div>
      </div>
      <div sidebar class="p-4 space-y-4" style="background: var(--ngaf-chat-bg, #171717); color: var(--ngaf-chat-text, #e0e0e0);">
        <h3 class="text-xs font-semibold uppercase tracking-wide"
            style="color: var(--ngaf-chat-text-muted, #777);">Primitives Used</h3>
        <ul class="text-xs space-y-2" style="color: var(--ngaf-chat-text-muted, #777);">
          <li>ChatMessageListComponent</li>
          <li>ChatInputComponent</li>
          <li>ChatTypingIndicatorComponent</li>
        </ul>
      </div>
    </example-chat-layout>
  `,
})
export class MessagesComponent {
  protected readonly agent = agent({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
  });

  submitMessage(content: string) {
    this.agent.submit({ message: content });
  }
}
