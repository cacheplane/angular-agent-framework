// libs/chat/src/lib/compositions/chat/chat.component.ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  Component,
  input,
  output,
  signal,
  computed,
  effect,
  viewChild,
  ElementRef,
  ChangeDetectionStrategy,
  inject,
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import type { AgentRef } from '@cacheplane/angular';
<<<<<<< HEAD
=======
import type { ViewRegistry } from '@cacheplane/render';
import type { StateStore } from '@json-render/core';
import { VIEW_REGISTRY } from '@cacheplane/render';
>>>>>>> origin/main
import { ChatMessagesComponent } from '../../primitives/chat-messages/chat-messages.component';
import { MessageTemplateDirective } from '../../primitives/chat-messages/message-template.directive';
import { ChatInputComponent } from '../../primitives/chat-input/chat-input.component';
import { ChatTypingIndicatorComponent } from '../../primitives/chat-typing-indicator/chat-typing-indicator.component';
import { ChatErrorComponent } from '../../primitives/chat-error/chat-error.component';
import { ChatInterruptComponent } from '../../primitives/chat-interrupt/chat-interrupt.component';
import { ChatThreadListComponent, Thread } from '../../primitives/chat-thread-list/chat-thread-list.component';
import { messageContent } from '../shared/message-utils';
import { CHAT_THEME_STYLES } from '../../styles/chat-theme';
import { CHAT_MARKDOWN_STYLES, renderMarkdown } from '../../styles/chat-markdown';

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
  styles: [CHAT_THEME_STYLES, CHAT_MARKDOWN_STYLES],
  template: `
    <div class="flex h-full overflow-hidden">
      <!-- Thread sidebar (optional, hidden on mobile) -->
      @if (threads().length > 0) {
        <div
          class="hidden md:flex w-64 flex-col flex-shrink-0 border-r overflow-y-auto"
          [class]="sidebarOpen() ? '!flex' : ''"
          style="border-color: var(--chat-border); background: var(--chat-bg-alt);"
          role="navigation"
          aria-label="Thread list"
        >
          <div class="px-3 py-2 border-b" style="border-color: var(--chat-border);">
            <h2 class="text-[11px] font-semibold uppercase tracking-wider m-0" style="color: var(--chat-text-muted);">Threads</h2>
          </div>
          <chat-thread-list
            [threads]="threads()"
            [activeThreadId]="activeThreadId()"
            (threadSelected)="threadSelected.emit($event)"
          >
            <ng-template let-thread let-isActive="isActive">
              <button
                class="w-full text-left px-3 py-2 text-sm border-0 cursor-pointer transition-colors duration-150"
                [style.background]="isActive ? 'var(--chat-bg-hover)' : 'transparent'"
                [style.fontWeight]="isActive ? '500' : '400'"
                [style.color]="'var(--chat-text)'"
                [attr.aria-current]="isActive ? 'true' : null"
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
        <div
          #scrollContainer
          class="flex-1 overflow-y-auto px-5 py-6"
          role="log"
          aria-label="Chat messages"
          aria-live="polite"
        >
          <div class="max-w-[var(--chat-max-width)] mx-auto flex flex-col gap-5">
            @if (ref().messages().length === 0 && !ref().isLoading()) {
              <!-- Empty state -->
              <div class="flex flex-col items-center justify-center py-20 gap-3" role="status">
                <div
                  class="w-10 h-10 flex items-center justify-center text-sm font-semibold"
                  style="background: var(--chat-avatar-bg); color: var(--chat-avatar-text); border-radius: var(--chat-radius-avatar);"
                >A</div>
                <p class="text-sm m-0" style="color: var(--chat-text-muted);">Send a message to start a conversation.</p>
              </div>
            }

<<<<<<< HEAD
            <chat-messages [ref]="ref()">
=======
            <chat-messages [ref]="ref()" [views]="resolvedViews()" [store]="store()">
>>>>>>> origin/main
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

        <!-- Interrupt banner -->
        <chat-interrupt [ref]="ref()">
          <ng-template let-interrupt>
            <div class="px-5 py-3 border-t" style="background: var(--chat-warning-bg); border-color: var(--chat-border);">
              <p class="text-sm m-0" style="color: var(--chat-warning-text);">Agent paused: {{ interrupt.value }}</p>
            </div>
          </ng-template>
        </chat-interrupt>

        <!-- Error banner -->
        <div class="px-5 pb-2">
          <chat-error [ref]="ref()" />
        </div>

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
    </div>
  `,
})
export class ChatComponent {
  private readonly sanitizer = inject(DomSanitizer);

  readonly ref = input.required<AgentRef<any, any>>();
<<<<<<< HEAD
  readonly threads = input<Thread[]>([]);
  readonly activeThreadId = input<string>('');
  readonly threadSelected = output<string>();
  readonly sidebarOpen = signal(false);

=======
  readonly views = input<ViewRegistry | undefined>(undefined);
  readonly store = input<StateStore | undefined>(undefined);
  readonly threads = input<Thread[]>([]);
  readonly activeThreadId = input<string>('');
  readonly threadSelected = output<string>();
  readonly action = output<{ name: string; params: Record<string, unknown> }>();
  readonly sidebarOpen = signal(false);

  // Inject DI-provided registry as fallback
  private readonly diViews = inject(VIEW_REGISTRY, { optional: true });

  // Resolved registry: input takes precedence over DI
  protected readonly resolvedViews = computed(() =>
    this.views() ?? this.diViews ?? undefined
  );

>>>>>>> origin/main
  readonly messageContent = messageContent;

  private readonly scrollContainer = viewChild<ElementRef<HTMLElement>>('scrollContainer');

  /** Track message count to trigger auto-scroll */
  private readonly messageCount = computed(() => this.ref().messages().length);

  private prevMessageCount = 0;

  constructor() {
    // Auto-scroll to bottom:
    // - Always scroll when message count increases (new message sent/received)
    // - During streaming partials, only scroll if user is near bottom
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
}
