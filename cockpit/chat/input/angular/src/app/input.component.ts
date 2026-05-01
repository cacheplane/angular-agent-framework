// SPDX-License-Identifier: MIT
import { Component, computed } from '@angular/core';
import { ChatInputComponent as ChatInputPrimitive } from '@ngaf/chat';
import { ChatMessagesComponent } from '@ngaf/chat';
import { ExampleChatLayoutComponent } from '@ngaf/example-layouts';
import { agent } from '@ngaf/langgraph';
import { environment } from '../environments/environment';

/**
 * InputComponent showcases ChatInputComponent features including
 * keyboard handling, disabled state, and custom placeholder.
 * A sidebar displays the current input state.
 */
@Component({
  selector: 'app-input',
  standalone: true,
  imports: [ChatInputPrimitive, ChatMessagesComponent, ExampleChatLayoutComponent],
  template: `
    <example-chat-layout sidebarWidth="w-72">
      <div main class="flex-1 flex flex-col min-w-0">
        <header class="px-4 py-3 border-b" style="border-color: var(--chat-border, #333); background: var(--chat-bg, #171717);">
          <h1 class="text-sm font-semibold" style="color: var(--chat-text, #e0e0e0);">Chat Input Demo</h1>
        </header>
        <div class="flex-1 overflow-y-auto">
          <chat-messages [agent]="agent" />
        </div>
        <div class="px-4 py-2" style="background: var(--chat-bg, #171717);">
          <chat-input [agent]="agent" placeholder="Try typing here..." (send)="submitMessage($event)" />
        </div>
      </div>
      <div sidebar class="p-4 space-y-4" style="background: var(--chat-bg, #171717); color: var(--chat-text, #e0e0e0);">
        <h3 class="text-xs font-semibold uppercase tracking-wide"
            style="color: var(--chat-text-muted, #777);">Input State</h3>
        <dl class="text-xs space-y-2" style="color: var(--chat-text-muted, #777);">
          <dt class="font-semibold">Stream Status</dt>
          <dd class="font-mono">{{ streamStatus() }}</dd>
          <dt class="font-semibold">Is Loading</dt>
          <dd class="font-mono">{{ isLoading() }}</dd>
        </dl>
        <div class="mt-4">
          <h4 class="text-xs font-semibold uppercase tracking-wide mb-2"
              style="color: var(--chat-text-muted, #777);">Features</h4>
          <ul class="text-xs space-y-1 list-disc list-inside" style="color: var(--chat-text-muted, #777);">
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
  protected readonly agent = agent({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
  });

  protected readonly streamStatus = computed(() => this.agent.status());
  protected readonly isLoading = computed(() => this.agent.isLoading());

  submitMessage(content: string) {
    this.agent.submit({ message: content });
  }
}
