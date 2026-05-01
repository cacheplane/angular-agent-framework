// SPDX-License-Identifier: MIT
import {
  Component,
  computed,
  effect,
  input,
  inject,
  signal,
  viewChild,
  ElementRef,
  ChangeDetectionStrategy,
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import type { AgentWithHistory } from '../../agent';
import { ChatMessageListComponent } from '../../primitives/chat-message-list/chat-message-list.component';
import { MessageTemplateDirective } from '../../primitives/chat-message-list/message-template.directive';
import { ChatInputComponent } from '../../primitives/chat-input/chat-input.component';
import { ChatTypingIndicatorComponent } from '../../primitives/chat-typing-indicator/chat-typing-indicator.component';
import { ChatErrorComponent } from '../../primitives/chat-error/chat-error.component';
import { messageContent } from '../shared/message-utils';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';
import { renderMarkdown } from '../../styles/chat-markdown';
import { DebugTimelineComponent } from './debug-timeline.component';
import { DebugDetailComponent } from './debug-detail.component';
import { DebugControlsComponent } from './debug-controls.component';
import { DebugSummaryComponent } from './debug-summary.component';
import type { DebugCheckpoint } from './debug-checkpoint-card.component';
import { toDebugCheckpoint, extractStateValues } from './debug-utils';

@Component({
  selector: 'chat-debug',
  standalone: true,
  imports: [
    ChatMessageListComponent,
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
    CHAT_HOST_TOKENS,
    `
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
      background: var(--ngaf-chat-bg);
    }

    /* Layout */
    .chat-debug__layout { display: flex; height: 100%; }

    /* Chat column */
    .chat-debug__chat { display: flex; flex-direction: column; flex: 1; min-width: 0; }
    .chat-debug__messages {
      flex: 1;
      overflow-y: auto;
      padding: var(--ngaf-chat-space-6) var(--ngaf-chat-space-5);
    }
    .chat-debug__messages-inner {
      max-width: var(--ngaf-chat-max-width);
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: var(--ngaf-chat-space-5);
    }

    /* Message templates */
    .chat-debug__msg-human { display: flex; justify-content: flex-end; }
    .chat-debug__msg-human__bubble {
      max-width: 75%;
      padding: 10px 16px;
      font-size: var(--ngaf-chat-font-size);
      line-height: var(--ngaf-chat-line-height);
      word-break: break-words;
      border-radius: var(--ngaf-chat-radius-bubble) var(--ngaf-chat-radius-bubble) 6px var(--ngaf-chat-radius-bubble);
      background: var(--ngaf-chat-surface-alt);
      color: var(--ngaf-chat-text);
      border: 1px solid var(--ngaf-chat-separator);
    }

    .chat-debug__msg-ai { display: flex; gap: 12px; }
    .chat-debug__msg-ai__avatar {
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: var(--ngaf-chat-font-size-xs);
      font-weight: 600;
      flex-shrink: 0;
      margin-top: 2px;
      border-radius: 8px;
      background: var(--ngaf-chat-surface-alt);
      color: var(--ngaf-chat-text-muted);
    }
    .chat-debug__msg-ai__content {
      flex: 1;
      min-width: 0;
      word-break: break-words;
      font-size: var(--ngaf-chat-font-size);
      line-height: var(--ngaf-chat-line-height);
      color: var(--ngaf-chat-text);
    }

    .chat-debug__msg-tool {
      padding: 10px 14px;
      font-family: var(--ngaf-chat-font-mono);
      font-size: 13px;
      word-break: break-words;
      white-space: pre-wrap;
      border-radius: var(--ngaf-chat-radius-card);
      border: 1px solid var(--ngaf-chat-separator);
      background: var(--ngaf-chat-surface-alt);
      color: var(--ngaf-chat-text);
    }

    .chat-debug__msg-system { display: flex; justify-content: center; }
    .chat-debug__msg-system__text {
      font-size: var(--ngaf-chat-font-size-xs);
      font-style: italic;
      color: var(--ngaf-chat-text-muted);
    }

    /* Input bar */
    .chat-debug__input-bar {
      border-top: 1px solid var(--ngaf-chat-separator);
      padding: var(--ngaf-chat-space-4) var(--ngaf-chat-space-5);
    }
    .chat-debug__input-inner {
      max-width: var(--ngaf-chat-max-width);
      margin: 0 auto;
    }

    /* Debug panel toggle */
    .chat-debug__toggle-btn {
      width: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
      border-left: 1px solid var(--ngaf-chat-separator);
      cursor: pointer;
      transition: background 150ms ease;
      background: var(--ngaf-chat-surface-alt);
      color: var(--ngaf-chat-text-muted);
    }
    .chat-debug__toggle-btn:hover {
      background: color-mix(in srgb, var(--ngaf-chat-text) 5%, transparent);
    }

    /* Debug panel */
    .chat-debug__panel {
      width: 320px;
      border-left: 1px solid var(--ngaf-chat-separator);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      flex-shrink: 0;
      background: var(--ngaf-chat-bg);
    }
    .chat-debug__panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      border-bottom: 1px solid var(--ngaf-chat-separator);
    }
    .chat-debug__panel-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin: 0;
      color: var(--ngaf-chat-text-muted);
    }
    .chat-debug__panel-close {
      font-size: var(--ngaf-chat-font-size-xs);
      background: transparent;
      border: 0;
      cursor: pointer;
      color: var(--ngaf-chat-text-muted);
      transition: color 150ms ease;
    }
    .chat-debug__panel-close:hover { color: var(--ngaf-chat-text); }

    .chat-debug__panel-section {
      padding: 8px 12px;
      border-bottom: 1px solid var(--ngaf-chat-separator);
    }
    .chat-debug__panel-timeline {
      flex: 1;
      overflow-y: auto;
      padding: 8px 12px;
    }
    .chat-debug__panel-detail {
      border-top: 1px solid var(--ngaf-chat-separator);
      padding: 8px 12px;
      max-height: 256px;
      overflow-y: auto;
    }

    /* Markdown rendering */
    :host ::ng-deep .chat-md p { margin: 0 0 0.75em; }
    :host ::ng-deep .chat-md p:last-child { margin-bottom: 0; }
    :host ::ng-deep .chat-md code {
      background: var(--ngaf-chat-surface-alt);
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.875em;
      font-family: var(--ngaf-chat-font-mono);
    }
    :host ::ng-deep .chat-md pre {
      background: var(--ngaf-chat-surface-alt);
      padding: 12px 16px;
      border-radius: var(--ngaf-chat-radius-card);
      overflow-x: auto;
      margin: 0.75em 0;
    }
    :host ::ng-deep .chat-md pre code { background: none; padding: 0; }
    :host ::ng-deep .chat-md ul, :host ::ng-deep .chat-md ol { margin: 0.5em 0; padding-left: 1.5em; }
    :host ::ng-deep .chat-md li { margin: 0.25em 0; }
    :host ::ng-deep .chat-md a { color: var(--ngaf-chat-text); text-decoration: underline; }
    :host ::ng-deep .chat-md strong { font-weight: 600; }
    :host ::ng-deep .chat-md blockquote {
      border-left: 3px solid var(--ngaf-chat-separator);
      padding-left: 12px;
      margin: 0.75em 0;
      color: var(--ngaf-chat-text-muted);
    }
    :host ::ng-deep .chat-md h1, :host ::ng-deep .chat-md h2, :host ::ng-deep .chat-md h3, :host ::ng-deep .chat-md h4 { margin: 1em 0 0.5em; font-weight: 600; }
    :host ::ng-deep .chat-md h1 { font-size: 1.25em; }
    :host ::ng-deep .chat-md h2 { font-size: 1.125em; }
    :host ::ng-deep .chat-md h3 { font-size: 1em; }
    :host ::ng-deep .chat-md table { border-collapse: collapse; width: 100%; margin: 0.75em 0; }
    :host ::ng-deep .chat-md th, :host ::ng-deep .chat-md td { border: 1px solid var(--ngaf-chat-separator); padding: 6px 12px; text-align: left; }
    :host ::ng-deep .chat-md th { background: var(--ngaf-chat-surface-alt); font-weight: 600; font-size: 0.875em; }
    `,
  ],
  template: `
    <div class="chat-debug__layout">
      <!-- Chat area -->
      <div class="chat-debug__chat">
        <div
          #scrollContainer
          class="chat-debug__messages"
          role="log"
          aria-label="Chat messages"
          aria-live="polite"
        >
          <div class="chat-debug__messages-inner">
            <chat-message-list [agent]="agent()">
              <!-- Human messages: right-aligned bubble -->
              <ng-template chatMessageTemplate="human" let-message>
                <div class="chat-debug__msg-human">
                  <div class="chat-debug__msg-human__bubble">{{ messageContent(message) }}</div>
                </div>
              </ng-template>

              <!-- AI messages: avatar inline with content (ChatGPT pattern) -->
              <ng-template chatMessageTemplate="ai" let-message>
                <div class="chat-debug__msg-ai">
                  <div class="chat-debug__msg-ai__avatar">A</div>
                  <div
                    class="chat-md chat-debug__msg-ai__content"
                    [innerHTML]="renderMd(messageContent(message))"
                  ></div>
                </div>
              </ng-template>

              <!-- Tool messages: monospace card -->
              <ng-template chatMessageTemplate="tool" let-message>
                <div class="chat-debug__msg-tool">{{ messageContent(message) }}</div>
              </ng-template>

              <!-- System messages: centered italic -->
              <ng-template chatMessageTemplate="system" let-message>
                <div class="chat-debug__msg-system" role="status">
                  <span class="chat-debug__msg-system__text">{{ messageContent(message) }}</span>
                </div>
              </ng-template>
            </chat-message-list>

            <chat-typing-indicator [agent]="agent()" />
          </div>
        </div>

        <chat-error [agent]="agent()" />

        <!-- Input area -->
        <div class="chat-debug__input-bar">
          <div class="chat-debug__input-inner">
            <chat-input
              [agent]="agent()"
              [submitOnEnter]="true"
              placeholder="Type a message..."
            />
          </div>
        </div>
      </div>

      <!-- Debug panel toggle (when closed) -->
      @if (!debugOpen()) {
        <button
          class="chat-debug__toggle-btn"
          title="Open debug panel"
          (click)="debugOpen.set(true)"
        >
          &laquo;
        </button>
      }

      <!-- Debug panel -->
      @if (debugOpen()) {
        <div class="chat-debug__panel">
          <!-- Header -->
          <div class="chat-debug__panel-header">
            <h3 class="chat-debug__panel-title">Debug</h3>
            <button
              class="chat-debug__panel-close"
              (click)="debugOpen.set(false)"
            >&raquo; Close</button>
          </div>

          <!-- Summary -->
          <div class="chat-debug__panel-section">
            <chat-debug-summary [checkpoints]="checkpoints()" />
          </div>

          <!-- Controls -->
          <div class="chat-debug__panel-section">
            <chat-debug-controls
              [checkpointCount]="checkpoints().length"
              [selectedIndex]="selectedCheckpointIndex()"
              (stepForward)="stepForward()"
              (stepBack)="stepBack()"
              (jumpToStart)="jumpToStart()"
              (jumpToEnd)="jumpToEnd()"
            />
          </div>

          <!-- Timeline -->
          <div class="chat-debug__panel-timeline">
            <chat-debug-timeline
              [checkpoints]="checkpoints()"
              [selectedIndex]="selectedCheckpointIndex()"
              (checkpointSelected)="selectedCheckpointIndex.set($event)"
            />
          </div>

          <!-- Detail -->
          @if (selectedCheckpointIndex() >= 0) {
            <div class="chat-debug__panel-detail">
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
  private readonly sanitizer = inject(DomSanitizer);

  readonly agent = input.required<AgentWithHistory>();

  readonly debugOpen = signal<boolean>(true);
  readonly selectedCheckpointIndex = signal<number>(-1);

  readonly checkpoints = computed((): DebugCheckpoint[] =>
    this.agent().history().map((cp, i) => toDebugCheckpoint(cp, i)),
  );

  readonly selectedState = computed((): Record<string, unknown> => {
    const idx = this.selectedCheckpointIndex();
    const history = this.agent().history();
    return extractStateValues(history[idx]);
  });

  readonly previousState = computed((): Record<string, unknown> => {
    const idx = this.selectedCheckpointIndex();
    const history = this.agent().history();
    if (idx <= 0) return {};
    return extractStateValues(history[idx - 1]);
  });

  // Message templates are intentionally co-located (shadcn copy-paste model)
  readonly messageContent = messageContent;

  private readonly scrollContainer = viewChild<ElementRef<HTMLElement>>('scrollContainer');

  /** Track message count to trigger auto-scroll */
  private readonly messageCount = computed(() => this.agent().messages().length);

  private prevMessageCount = 0;

  constructor() {
    effect(() => {
      const count = this.messageCount();
      this.agent().isLoading(); // track
      const el = this.scrollContainer()?.nativeElement;
      if (!el) return;

      const isNewMessage = count !== this.prevMessageCount;
      this.prevMessageCount = count;

      const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
      if (isNewMessage || isNearBottom) {
        requestAnimationFrame(() => {
          el.scrollTo({ top: el.scrollHeight, behavior: isNewMessage ? 'instant' : 'smooth' });
        });
      }
    });
  }

  renderMd(content: string) {
    return renderMarkdown(content, this.sanitizer);
  }

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
