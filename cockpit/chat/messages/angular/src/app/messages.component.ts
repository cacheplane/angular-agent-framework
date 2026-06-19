// SPDX-License-Identifier: MIT
import { Component } from '@angular/core';
import {
  ChatMessageListComponent,
  ChatInputComponent,
  ChatTypingIndicatorComponent,
  ChatMessageComponent,
  ChatStreamingMdComponent,
  MessageTemplateDirective,
  messageContent,
} from '@threadplane/chat';
import { ExampleChatLayoutComponent } from '@threadplane/example-layouts';
import { injectAgent } from '@threadplane/langgraph';
import { MESSAGES_AGENT, type MessagesState } from './agent-ref';

/**
 * MessagesComponent demonstrates the chat message primitives from @threadplane/chat.
 *
 * Uses ChatMessageListComponent, ChatInputComponent, and ChatTypingIndicatorComponent
 * individually rather than the composed ChatComponent, giving full control
 * over layout and message rendering.
 *
 * ChatMessageListComponent renders nothing on its own — it discovers
 * projected `<ng-template chatMessageTemplate="...">` blocks via
 * contentChildren and uses them per message type. The composed `<chat>`
 * component provides default templates internally; primitive consumers
 * must project them explicitly.
 */
@Component({
  selector: 'app-messages',
  standalone: true,
  imports: [
    ChatMessageListComponent,
    ChatInputComponent,
    ChatTypingIndicatorComponent,
    ChatMessageComponent,
    ChatStreamingMdComponent,
    MessageTemplateDirective,
    ExampleChatLayoutComponent,
  ],
  template: `
    <example-chat-layout sidebarWidth="w-72">
      <div main class="flex-1 flex flex-col min-w-0">
        <header class="px-4 py-3 border-b" style="border-color: var(--ngaf-chat-separator); background: var(--ngaf-chat-bg);">
          <h1 class="text-sm font-semibold" style="color: var(--ngaf-chat-text);">Chat Messages Primitives</h1>
        </header>
        <div class="flex-1 overflow-y-auto">
          <chat-message-list [agent]="agent">
            <ng-template chatMessageTemplate="human" let-message>
              <chat-message [role]="'user'">{{ messageContent(message) }}</chat-message>
            </ng-template>
            <ng-template chatMessageTemplate="ai" let-message let-i="index">
              <chat-message
                [role]="'assistant'"
                [streaming]="agent.isLoading() && i === agent.messages().length - 1"
                [current]="i === agent.messages().length - 1"
              >
                <chat-streaming-md
                  [content]="messageContent(message)"
                  [streaming]="agent.isLoading() && i === agent.messages().length - 1"
                />
              </chat-message>
            </ng-template>
            <ng-template chatMessageTemplate="tool" let-message><!-- hidden --></ng-template>
            <ng-template chatMessageTemplate="system" let-message>
              <chat-message [role]="'system'">{{ messageContent(message) }}</chat-message>
            </ng-template>
          </chat-message-list>
        </div>
        <div class="px-4 py-2" style="background: var(--ngaf-chat-bg);">
          <chat-typing-indicator [agent]="agent" />
          <chat-input [agent]="agent" (submitted)="submitMessage($event)" />
        </div>
      </div>
      <div sidebar class="p-4 space-y-4" style="background: var(--ngaf-chat-bg); color: var(--ngaf-chat-text);">
        <h3 class="text-xs font-semibold uppercase tracking-wide"
            style="color: var(--ngaf-chat-text-muted);">Primitives Used</h3>
        <ul class="text-xs space-y-2" style="color: var(--ngaf-chat-text-muted);">
          <li>ChatMessageListComponent</li>
          <li>ChatInputComponent</li>
          <li>ChatTypingIndicatorComponent</li>
        </ul>
      </div>
    </example-chat-layout>
  `,
})
export class MessagesComponent {
  protected readonly agent = injectAgent(MESSAGES_AGENT);
  // Typed read: prove MessagesState flows through DI.
  protected readonly _typedState: MessagesState = this.agent.value();

  protected readonly messageContent = messageContent;

  submitMessage(content: string) {
    this.agent.submit({ message: content });
  }
}
