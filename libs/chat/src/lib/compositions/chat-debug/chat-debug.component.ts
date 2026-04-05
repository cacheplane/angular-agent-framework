// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  Component,
  computed,
  input,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import type { StreamResourceRef } from '@cacheplane/stream-resource';
import { ChatMessagesComponent } from '../../primitives/chat-messages/chat-messages.component';
import { MessageTemplateDirective } from '../../primitives/chat-messages/message-template.directive';
import { ChatInputComponent } from '../../primitives/chat-input/chat-input.component';
import { ChatTypingIndicatorComponent } from '../../primitives/chat-typing-indicator/chat-typing-indicator.component';
import { ChatErrorComponent } from '../../primitives/chat-error/chat-error.component';
import { DebugTimelineComponent } from './debug-timeline.component';
import { DebugDetailComponent } from './debug-detail.component';
import { DebugControlsComponent } from './debug-controls.component';
import { DebugSummaryComponent } from './debug-summary.component';
import type { DebugCheckpoint } from './debug-checkpoint-card.component';
import { toDebugCheckpoint, extractStateValues } from './debug-utils';
import { messageContent } from '../shared/message-utils';

@Component({
  selector: 'chat-debug',
  standalone: true,
  imports: [
    ChatMessagesComponent,
    MessageTemplateDirective,
    ChatInputComponent,
    ChatTypingIndicatorComponent,
    ChatErrorComponent,
    DebugTimelineComponent,
    DebugDetailComponent,
    DebugControlsComponent,
    DebugSummaryComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
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
    <div style="display: flex; height: 100%;">
      <!-- Chat area -->
      <div style="display: flex; flex-direction: column; flex: 1; min-width: 0;">
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

              <!-- AI messages: no bubble, avatar badge + "Assistant" label + plain text -->
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

            <chat-typing-indicator [ref]="ref()" />
          </div>
        </div>

        <chat-error [ref]="ref()" />

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

      <!-- Debug panel toggle (when closed) -->
      @if (!debugOpen()) {
        <button
          style="width: 32px; display: flex; align-items: center; justify-content: center; border-left: 1px solid var(--chat-border); background: var(--chat-bg-alt); color: var(--chat-text-muted); border-top: none; border-right: none; border-bottom: none; cursor: pointer; transition: background 0.15s;"
          title="Open debug panel"
          (click)="debugOpen.set(true)"
        >
          &laquo;
        </button>
      }

      <!-- Debug panel -->
      @if (debugOpen()) {
        <div style="width: 320px; border-left: 1px solid var(--chat-border); background: var(--chat-bg); display: flex; flex-direction: column; overflow: hidden; flex-shrink: 0;">
          <!-- Header -->
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-bottom: 1px solid var(--chat-border);">
            <h3 style="font-size: 11px; font-weight: 600; color: var(--chat-text-muted); text-transform: uppercase; letter-spacing: 0.08em; margin: 0;">Debug</h3>
            <button
              style="font-size: 12px; color: var(--chat-text-muted); background: none; border: none; cursor: pointer; transition: color 0.15s;"
              (click)="debugOpen.set(false)"
            >&raquo; Close</button>
          </div>

          <!-- Summary -->
          <div style="padding: 8px 12px; border-bottom: 1px solid var(--chat-border-light);">
            <chat-debug-summary [ref]="ref()" [checkpoints]="checkpoints()" />
          </div>

          <!-- Controls -->
          <div style="padding: 8px 12px; border-bottom: 1px solid var(--chat-border-light);">
            <chat-debug-controls
              [ref]="ref()"
              [checkpointCount]="checkpoints().length"
              [selectedIndex]="selectedCheckpointIndex()"
              (stepForward)="stepForward()"
              (stepBack)="stepBack()"
              (jumpToStart)="jumpToStart()"
              (jumpToEnd)="jumpToEnd()"
            />
          </div>

          <!-- Timeline -->
          <div style="flex: 1; overflow-y: auto; padding: 8px 12px;">
            <chat-debug-timeline
              [checkpoints]="checkpoints()"
              [selectedIndex]="selectedCheckpointIndex()"
              (checkpointSelected)="selectedCheckpointIndex.set($event)"
            />
          </div>

          <!-- Detail -->
          @if (selectedCheckpointIndex() >= 0) {
            <div style="border-top: 1px solid var(--chat-border); padding: 8px 12px; max-height: 256px; overflow-y: auto;">
              <chat-debug-detail
                [currentState]="selectedState()"
                [previousState]="previousState()"
              />
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class ChatDebugComponent {
  readonly ref = input.required<StreamResourceRef<any, any>>();

  readonly debugOpen = signal<boolean>(true);
  readonly selectedCheckpointIndex = signal<number>(-1);

  readonly checkpoints = computed((): DebugCheckpoint[] =>
    this.ref().history().map((state, i) => toDebugCheckpoint(state, i)),
  );

  readonly selectedState = computed((): Record<string, unknown> => {
    const idx = this.selectedCheckpointIndex();
    const history = this.ref().history();
    return extractStateValues(history[idx]);
  });

  readonly previousState = computed((): Record<string, unknown> => {
    const idx = this.selectedCheckpointIndex();
    const history = this.ref().history();
    if (idx <= 0) return {};
    return extractStateValues(history[idx - 1]);
  });

  // Message templates are intentionally co-located (shadcn copy-paste model)
  readonly messageContent = messageContent;

  stepForward(): void {
    const idx = this.selectedCheckpointIndex();
    if (idx < this.checkpoints().length - 1) {
      this.selectedCheckpointIndex.set(idx + 1);
    }
  }

  stepBack(): void {
    const idx = this.selectedCheckpointIndex();
    if (idx > 0) {
      this.selectedCheckpointIndex.set(idx - 1);
    }
  }

  jumpToStart(): void {
    this.selectedCheckpointIndex.set(0);
  }

  jumpToEnd(): void {
    this.selectedCheckpointIndex.set(this.checkpoints().length - 1);
  }
}
