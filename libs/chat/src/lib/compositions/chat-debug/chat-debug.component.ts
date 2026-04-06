// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
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
import { CHAT_THEME_STYLES } from '../../styles/chat-theme';
import { CHAT_MARKDOWN_STYLES, renderMarkdown } from '../../styles/chat-markdown';

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
  styles: [CHAT_THEME_STYLES, CHAT_MARKDOWN_STYLES],
  template: `
    <div class="flex h-full">
      <!-- Chat area -->
      <div class="flex flex-col flex-1 min-w-0">
        <div
          #scrollContainer
          class="flex-1 overflow-y-auto px-5 py-6"
          role="log"
          aria-label="Chat messages"
          aria-live="polite"
        >
          <div class="max-w-[var(--chat-max-width)] mx-auto flex flex-col gap-5">
            <chat-messages [ref]="ref()">
              <!-- Human messages: right-aligned bubble -->
              <ng-template chatMessageTemplate="human" let-message>
                <div class="flex justify-end">
                  <div
                    class="max-w-[75%] px-4 py-2.5 text-[length:var(--chat-font-size)] leading-[var(--chat-line-height)] break-words border"
                    style="background: var(--chat-user-bg); color: var(--chat-user-text); border-color: var(--chat-user-border); border-radius: var(--chat-radius-message) var(--chat-radius-message) 6px var(--chat-radius-message);"
                  >{{ messageContent(message) }}</div>
                </div>
              </ng-template>

              <!-- AI messages: avatar inline with content (ChatGPT pattern) -->
              <ng-template chatMessageTemplate="ai" let-message>
                <div class="flex gap-3">
                  <div
                    class="w-7 h-7 flex items-center justify-center text-xs font-semibold shrink-0 mt-0.5"
                    style="background: var(--chat-avatar-bg); color: var(--chat-avatar-text); border-radius: var(--chat-radius-avatar);"
                  >A</div>
                  <div
                    class="chat-md flex-1 min-w-0 break-words text-[length:var(--chat-font-size)] leading-[var(--chat-line-height)]"
                    style="color: var(--chat-text);"
                    [innerHTML]="renderMd(messageContent(message))"
                  ></div>
                </div>
              </ng-template>

              <!-- Tool messages: monospace card -->
              <ng-template chatMessageTemplate="tool" let-message>
                <div
                  class="px-3.5 py-2.5 font-mono text-[13px] break-words whitespace-pre-wrap border"
                  style="background: var(--chat-bg-alt); color: var(--chat-text); border-color: var(--chat-border); border-radius: var(--chat-radius-card);"
                >{{ messageContent(message) }}</div>
              </ng-template>

              <!-- System messages: centered italic -->
              <ng-template chatMessageTemplate="system" let-message>
                <div class="flex justify-center" role="status">
                  <span class="text-xs italic" style="color: var(--chat-text-muted);">
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
        <div class="border-t px-5 py-4" style="border-color: var(--chat-border);">
          <div class="max-w-[var(--chat-max-width)] mx-auto">
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
          class="w-8 flex items-center justify-center border-l border-t-0 border-r-0 border-b-0 cursor-pointer transition-colors duration-150"
          style="border-color: var(--chat-border); background: var(--chat-bg-alt); color: var(--chat-text-muted);"
          title="Open debug panel"
          (click)="debugOpen.set(true)"
        >
          &laquo;
        </button>
      }

      <!-- Debug panel -->
      @if (debugOpen()) {
        <div
          class="w-80 border-l flex flex-col overflow-hidden shrink-0"
          style="border-color: var(--chat-border); background: var(--chat-bg);"
        >
          <!-- Header -->
          <div class="flex items-center justify-between px-3 py-2 border-b" style="border-color: var(--chat-border);">
            <h3 class="text-[11px] font-semibold uppercase tracking-wider m-0" style="color: var(--chat-text-muted);">Debug</h3>
            <button
              class="text-xs bg-transparent border-0 cursor-pointer transition-colors duration-150"
              style="color: var(--chat-text-muted);"
              (click)="debugOpen.set(false)"
            >&raquo; Close</button>
          </div>

          <!-- Summary -->
          <div class="px-3 py-2 border-b" style="border-color: var(--chat-border-light);">
            <chat-debug-summary [ref]="ref()" [checkpoints]="checkpoints()" />
          </div>

          <!-- Controls -->
          <div class="px-3 py-2 border-b" style="border-color: var(--chat-border-light);">
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
          <div class="flex-1 overflow-y-auto px-3 py-2">
            <chat-debug-timeline
              [checkpoints]="checkpoints()"
              [selectedIndex]="selectedCheckpointIndex()"
              (checkpointSelected)="selectedCheckpointIndex.set($event)"
            />
          </div>

          <!-- Detail -->
          @if (selectedCheckpointIndex() >= 0) {
            <div class="border-t px-3 py-2 max-h-64 overflow-y-auto" style="border-color: var(--chat-border);">
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

  private readonly scrollContainer = viewChild<ElementRef<HTMLElement>>('scrollContainer');

  /** Track message count to trigger auto-scroll */
  private readonly messageCount = computed(() => this.ref().messages().length);

  private prevMessageCount = 0;

  constructor() {
    effect(() => {
      const count = this.messageCount();
      this.ref().isLoading(); // track
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
