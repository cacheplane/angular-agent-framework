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
  selector: 'chat',
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
  styles: [
    // Theme CSS custom properties (sourced from libs/chat/src/lib/styles/chat-theme.css)
    `:host {
      --chat-bg: #171717; --chat-bg-alt: #222222; --chat-bg-hover: #2a2a2a;
      --chat-text: #e0e0e0; --chat-text-muted: #777777; --chat-text-placeholder: #666666;
      --chat-border: #333333; --chat-border-light: #2a2a2a;
      --chat-user-bg: #2a2a2a; --chat-user-text: #f5f5f5; --chat-user-border: #333333;
      --chat-avatar-bg: #333333; --chat-avatar-text: #aaaaaa;
      --chat-input-bg: #222222; --chat-input-border: #333333; --chat-input-focus-border: #555555;
      --chat-send-bg: #444444; --chat-send-text: #aaaaaa;
      --chat-error-bg: #2d1515; --chat-error-text: #f87171;
      --chat-warning-bg: #2d2315; --chat-warning-text: #fbbf24; --chat-success: #4ade80;
      --chat-radius-message: 20px; --chat-radius-input: 24px; --chat-radius-card: 12px;
      --chat-radius-avatar: 8px; --chat-max-width: 720px;
      --chat-font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif;
      --chat-font-size: 15px; --chat-line-height: 1.6;
      font-family: var(--chat-font-family); font-size: var(--chat-font-size);
      line-height: var(--chat-line-height); color: var(--chat-text); background: var(--chat-bg);
      display: flex; flex-direction: column; height: 100%; overflow: hidden;
    }
    @media (prefers-color-scheme: light) {
      :host:not([data-chat-theme="dark"]) {
        --chat-bg: #ffffff; --chat-bg-alt: #f5f5f5; --chat-bg-hover: #ebebeb;
        --chat-text: #1a1a1a; --chat-text-muted: #999999; --chat-text-placeholder: #999999;
        --chat-border: #e5e5e5; --chat-border-light: #f0f0f0;
        --chat-user-bg: #f0f0f0; --chat-user-text: #1a1a1a; --chat-user-border: transparent;
        --chat-avatar-bg: #f0f0f0; --chat-avatar-text: #666666;
        --chat-input-bg: #f5f5f5; --chat-input-border: #e5e5e5; --chat-input-focus-border: #cccccc;
        --chat-send-bg: #e5e5e5; --chat-send-text: #999999;
        --chat-error-bg: #fef2f2; --chat-error-text: #dc2626;
        --chat-warning-bg: #fffbeb; --chat-warning-text: #d97706; --chat-success: #16a34a;
      }
    }
    :host([data-chat-theme="light"]) {
      --chat-bg: #ffffff; --chat-bg-alt: #f5f5f5; --chat-bg-hover: #ebebeb;
      --chat-text: #1a1a1a; --chat-text-muted: #999999; --chat-text-placeholder: #999999;
      --chat-border: #e5e5e5; --chat-border-light: #f0f0f0;
      --chat-user-bg: #f0f0f0; --chat-user-text: #1a1a1a; --chat-user-border: transparent;
      --chat-avatar-bg: #f0f0f0; --chat-avatar-text: #666666;
      --chat-input-bg: #f5f5f5; --chat-input-border: #e5e5e5; --chat-input-focus-border: #cccccc;
      --chat-send-bg: #e5e5e5; --chat-send-text: #999999;
      --chat-error-bg: #fef2f2; --chat-error-text: #dc2626;
      --chat-warning-bg: #fffbeb; --chat-warning-text: #d97706; --chat-success: #16a34a;
    }`,
  ],
  template: `
    <div style="display: flex; height: 100%; overflow: hidden;">
      <!-- Thread sidebar (optional) -->
      @if (threads().length > 0) {
        <div style="width: 256px; border-right: 1px solid var(--chat-border); background: var(--chat-bg-alt); overflow-y: auto; flex-shrink: 0;">
          <div style="padding: 8px 12px; border-bottom: 1px solid var(--chat-border);">
            <h2 style="font-size: 11px; font-weight: 600; color: var(--chat-text-muted); text-transform: uppercase; letter-spacing: 0.08em; margin: 0;">Threads</h2>
          </div>
          <chat-thread-list
            [threads]="threads()"
            [activeThreadId]="activeThreadId()"
            (threadSelected)="threadSelected.emit($event)"
          >
            <ng-template let-thread let-isActive="isActive">
              <button
                style="width: 100%; text-align: left; padding: 8px 12px; font-size: 14px; background: none; border: none; cursor: pointer; color: var(--chat-text); transition: background 0.15s;"
                [style.background]="isActive ? 'var(--chat-bg-hover)' : 'transparent'"
                [style.fontWeight]="isActive ? '500' : '400'"
                (click)="threadSelected.emit(thread.id)"
              >
                {{ thread.id }}
              </button>
            </ng-template>
          </chat-thread-list>
        </div>
      }

      <!-- Chat area -->
      <div style="display: flex; flex-direction: column; flex: 1; min-width: 0;">
        <!-- Messages area (scrollable) -->
        <div style="flex: 1; overflow-y: auto; padding: 24px 20px;">
          <div style="max-width: var(--chat-max-width); margin: 0 auto; display: flex; flex-direction: column; gap: 20px;">
            <chat-messages [ref]="ref()">
              <!-- Human messages: right-aligned bubble -->
              <ng-template chatMessageTemplate="human" let-message>
                <div style="display: flex; justify-content: flex-end;">
                  <div style="
                    max-width: 75%;
                    background: var(--chat-user-bg);
                    color: var(--chat-user-text);
                    border: 1px solid var(--chat-user-border);
                    border-radius: var(--chat-radius-message) var(--chat-radius-message) 6px var(--chat-radius-message);
                    padding: 10px 16px;
                    font-size: var(--chat-font-size);
                    line-height: var(--chat-line-height);
                    word-break: break-word;
                  ">{{ messageContent(message) }}</div>
                </div>
              </ng-template>

              <!-- AI messages: no bubble, left-aligned plain text with avatar -->
              <ng-template chatMessageTemplate="ai" let-message>
                <div style="display: flex; flex-direction: column; gap: 6px;">
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="
                      width: 24px;
                      height: 24px;
                      background: var(--chat-avatar-bg);
                      color: var(--chat-avatar-text);
                      border-radius: var(--chat-radius-avatar);
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      font-size: 11px;
                      font-weight: 600;
                      flex-shrink: 0;
                    ">A</div>
                    <span style="font-size: 12px; color: var(--chat-text-muted); font-weight: 500;">Assistant</span>
                  </div>
                  <div style="
                    color: var(--chat-text);
                    font-size: var(--chat-font-size);
                    line-height: var(--chat-line-height);
                    padding-left: 32px;
                    word-break: break-word;
                  ">{{ messageContent(message) }}</div>
                </div>
              </ng-template>

              <!-- Tool messages: monospace card -->
              <ng-template chatMessageTemplate="tool" let-message>
                <div style="
                  background: var(--chat-bg-alt);
                  border: 1px solid var(--chat-border);
                  border-radius: var(--chat-radius-card);
                  padding: 10px 14px;
                  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
                  font-size: 13px;
                  color: var(--chat-text);
                  word-break: break-word;
                  white-space: pre-wrap;
                ">{{ messageContent(message) }}</div>
              </ng-template>

              <!-- System messages: centered italic -->
              <ng-template chatMessageTemplate="system" let-message>
                <div style="display: flex; justify-content: center;">
                  <span style="font-size: 12px; color: var(--chat-text-muted); font-style: italic;">
                    {{ messageContent(message) }}
                  </span>
                </div>
              </ng-template>
            </chat-messages>

            <!-- Typing indicator -->
            <chat-typing-indicator [ref]="ref()" />
          </div>
        </div>

        <!-- Interrupt banner -->
        <chat-interrupt [ref]="ref()">
          <ng-template let-interrupt>
            <div style="padding: 12px 20px; background: var(--chat-warning-bg); border-top: 1px solid var(--chat-border);">
              <p style="font-size: 14px; color: var(--chat-warning-text); margin: 0;">Agent paused: {{ interrupt.value }}</p>
            </div>
          </ng-template>
        </chat-interrupt>

        <!-- Error banner -->
        <div style="padding: 0 20px 8px;">
          <chat-error [ref]="ref()" />
        </div>

        <!-- Input area -->
        <div style="border-top: 1px solid var(--chat-border); padding: 16px 20px;">
          <div style="max-width: var(--chat-max-width); margin: 0 auto;">
            <chat-input
              [ref]="ref()"
              [submitOnEnter]="true"
              placeholder="Type a message..."
            />
          </div>
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
