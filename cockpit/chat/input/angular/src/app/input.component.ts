// SPDX-License-Identifier: MIT
import { Component, computed } from '@angular/core';
import {
  ChatInputComponent as ChatInputPrimitive,
  ChatMessageListComponent,
  ChatMessageComponent,
  ChatStreamingMdComponent,
  MessageTemplateDirective,
  markdownDocument,
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
    <example-chat-layout sidebarWidth="18rem">
      <section main class="chat-demo">
        <header class="demo-header">
          <h1 class="demo-title">Chat Input Demo</h1>
        </header>
        <div class="message-scroll">
          <chat-message-list [agent]="agent">
            <ng-template chatMessageTemplate="human" let-message>
              <chat-message [role]="'user'">{{ messageContent(message) }}</chat-message>
            </ng-template>
            <ng-template chatMessageTemplate="ai" let-message let-i="index">
              <chat-message
                [role]="'assistant'"
                [streaming]="message.delivery.phase === 'streaming'"
                [current]="i === agent.messages().length - 1"
              >
                <chat-streaming-md
                  [document]="markdownDocument(messageContent(message), message.delivery)"
                />
              </chat-message>
            </ng-template>
            <ng-template chatMessageTemplate="tool" let-message><!-- hidden --></ng-template>
            <ng-template chatMessageTemplate="system" let-message>
              <chat-message [role]="'system'">{{ messageContent(message) }}</chat-message>
            </ng-template>
          </chat-message-list>
        </div>
        <div class="input-strip">
          <!-- chat-input submits to [agent] itself; (submitted) is a
               notification only — re-submitting it here would double the
               user message. -->
          <chat-input [agent]="agent" placeholder="Try typing here..." />
        </div>
      </section>
      <div sidebar class="panel">
        <h3 class="cap">Input State</h3>
        <dl class="metric-list">
          <dt class="metric-label">Stream Status</dt>
          <dd class="metric-value">{{ streamStatus() }}</dd>
          <dt class="metric-label">Is Loading</dt>
          <dd class="metric-value">{{ isLoading() }}</dd>
        </dl>
        <div>
          <h4 class="cap">Features</h4>
          <ul class="info-list">
            <li>Custom placeholder text</li>
            <li>Enter to send</li>
            <li>Shift+Enter for newline</li>
            <li>Auto-disable while streaming</li>
          </ul>
        </div>
      </div>
    </example-chat-layout>
  `,
  styles: [`
    .chat-demo {
      display: flex;
      flex: 1 1 auto;
      min-width: 0;
      flex-direction: column;
      background: var(--tplane-chat-bg);
      color: var(--tplane-chat-text);
    }

    .demo-header {
      padding: 0.75rem 1rem;
      border-bottom: 1px solid var(--tplane-chat-separator);
      background: var(--tplane-chat-surface);
    }

    .demo-title {
      margin: 0;
      color: var(--tplane-chat-text);
      font-size: var(--tplane-chat-font-size-sm);
      font-weight: 700;
      line-height: var(--tplane-chat-line-height-tight);
    }

    .message-scroll {
      flex: 1 1 auto;
      min-height: 0;
      overflow-y: auto;
      background: var(--tplane-chat-bg);
    }

    .input-strip {
      padding: 0.5rem 1rem;
      border-top: 1px solid var(--tplane-chat-separator);
      background: var(--tplane-chat-surface);
    }

    .panel {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      padding: 1rem;
      background: var(--tplane-chat-bg);
      color: var(--tplane-chat-text);
    }

    .cap {
      margin: 0;
      color: var(--tplane-chat-text-muted);
      font-size: var(--tplane-chat-font-size-xs);
      font-weight: 700;
      letter-spacing: 0.12em;
      line-height: var(--tplane-chat-line-height-tight);
      text-transform: uppercase;
    }

    .info-list,
    .metric-list {
      margin: 0;
      padding: 0;
      color: var(--tplane-chat-text-muted);
      font-size: var(--tplane-chat-font-size-xs);
      line-height: var(--tplane-chat-line-height);
      list-style: none;
    }

    .info-list {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      margin-top: 0.5rem;
    }

    .metric-list {
      display: grid;
      gap: 0.25rem;
    }

    .metric-label {
      color: var(--tplane-chat-text-muted);
      font-weight: 700;
    }

    .metric-value {
      margin: 0 0 0.5rem;
      color: var(--tplane-chat-text);
      font-family: var(--tplane-chat-font-mono);
    }
  `],
})
export class InputComponent {
  protected readonly agent = injectAgent();

  protected readonly streamStatus = computed(() => this.agent.status());
  protected readonly isLoading = computed(() => this.agent.isLoading());
  protected readonly messageContent = messageContent;
  protected readonly markdownDocument = markdownDocument;
}
