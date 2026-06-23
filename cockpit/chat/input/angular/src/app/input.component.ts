// SPDX-License-Identifier: MIT
import { Component, computed } from '@angular/core';
import {
  ChatInputComponent as ChatInputPrimitive,
  ChatMessageListComponent,
  ChatMessageComponent,
  ChatStreamingMdComponent,
  MessageTemplateDirective,
  messageContent,
} from '@threadplane/chat';
import { ExampleChatLayoutComponent } from '@threadplane/example-layouts';
import { injectAgent } from '@threadplane/langgraph';

/**
 * InputComponent showcases ChatInputComponent features including
 * keyboard handling, disabled state, and custom placeholder.
 * A sidebar displays the current input state.
 *
 * ChatMessageListComponent renders nothing on its own — it discovers
 * projected `<ng-template chatMessageTemplate="...">` blocks via
 * contentChildren. Templates are projected here so the conversation
 * surface actually displays user + assistant turns.
 */
@Component({
  selector: 'app-input',
  standalone: true,
  imports: [
    ChatInputPrimitive,
    ChatMessageListComponent,
    ChatMessageComponent,
    ChatStreamingMdComponent,
    MessageTemplateDirective,
    ExampleChatLayoutComponent,
  ],
  template: `
    <example-chat-layout sidebarWidth="w-72">
      <div main class="flex-1 flex flex-col min-w-0">
        <header class="px-4 py-3 border-b" style="border-color: var(--ngaf-chat-separator); background: var(--ngaf-chat-bg);">
          <h1 class="text-sm font-semibold" style="color: var(--ngaf-chat-text);">Chat Input Demo</h1>
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
          <!-- chat-input submits to [agent] itself; (submitted) is a
               notification only — re-submitting it here would double the
               user message. -->
          <chat-input [agent]="agent" placeholder="Try typing here..." />
        </div>
      </div>
      <div sidebar class="p-4 space-y-4" style="background: var(--ngaf-chat-bg); color: var(--ngaf-chat-text);">
        <h3 class="text-xs font-semibold uppercase tracking-wide"
            style="color: var(--ngaf-chat-text-muted);">Input State</h3>
        <dl class="text-xs space-y-2" style="color: var(--ngaf-chat-text-muted);">
          <dt class="font-semibold">Stream Status</dt>
          <dd class="font-mono">{{ streamStatus() }}</dd>
          <dt class="font-semibold">Is Loading</dt>
          <dd class="font-mono">{{ isLoading() }}</dd>
        </dl>
        <div class="mt-4">
          <h4 class="text-xs font-semibold uppercase tracking-wide mb-2"
              style="color: var(--ngaf-chat-text-muted);">Features</h4>
          <ul class="text-xs space-y-1 list-disc list-inside" style="color: var(--ngaf-chat-text-muted);">
            <li>Custom placeholder text</li>
            <li>Enter to send</li>
            <li>Shift+Enter for newline</li>
            <li>Auto-disable while streaming</li>
          </ul>
        </div>
      </div>
    </example-chat-layout>
  `,
})
export class InputComponent {
  protected readonly agent = injectAgent();

  protected readonly streamStatus = computed(() => this.agent.status());
  protected readonly isLoading = computed(() => this.agent.isLoading());
  protected readonly messageContent = messageContent;
}
