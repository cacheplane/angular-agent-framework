// libs/chat/src/lib/compositions/chat/chat.component.ts
// SPDX-License-Identifier: MIT
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
  DestroyRef,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { Agent } from '../../agent';
import type { ViewRegistry, RenderEvent } from '@ngaf/render';
import type { A2uiActionMessage } from '@ngaf/a2ui';
import type { StateStore } from '@json-render/core';
import { ChatMessagesComponent } from '../../primitives/chat-messages/chat-messages.component';
import { MessageTemplateDirective } from '../../primitives/chat-messages/message-template.directive';
import { ChatInputComponent } from '../../primitives/chat-input/chat-input.component';
import { ChatTypingIndicatorComponent } from '../../primitives/chat-typing-indicator/chat-typing-indicator.component';
import { ChatErrorComponent } from '../../primitives/chat-error/chat-error.component';
import { ChatInterruptComponent } from '../../primitives/chat-interrupt/chat-interrupt.component';
import { ChatThreadListComponent, Thread } from '../../primitives/chat-thread-list/chat-thread-list.component';
import { ChatGenerativeUiComponent } from '../../primitives/chat-generative-ui/chat-generative-ui.component';
import { toRenderRegistry, signalStateStore } from '@ngaf/render';
import { createContentClassifier, type ContentClassifier } from '../../streaming/content-classifier';
import { messageContent } from '../shared/message-utils';
import { CHAT_THEME_STYLES } from '../../styles/chat-theme';
import { CHAT_MARKDOWN_STYLES } from '../../styles/chat-markdown';
import { ChatStreamingMdComponent } from '../../streaming/streaming-markdown.component';
import { A2uiSurfaceComponent } from '../../a2ui/surface.component';
import type { ChatRenderEvent } from './chat-render-event';
import { KeyValuePipe } from '@angular/common';

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
    ChatGenerativeUiComponent,
    ChatStreamingMdComponent,
    A2uiSurfaceComponent,
    KeyValuePipe,
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
            @if (agent().messages().length === 0 && !agent().isLoading()) {
              <!-- Empty state -->
              <div class="flex flex-col items-center justify-center py-20 gap-3" role="status">
                <div
                  class="w-10 h-10 flex items-center justify-center text-sm font-semibold"
                  style="background: var(--chat-avatar-bg); color: var(--chat-avatar-text); border-radius: var(--chat-radius-avatar);"
                >A</div>
                <p class="text-sm m-0" style="color: var(--chat-text-muted);">Send a message to start a conversation.</p>
              </div>
            }

            <chat-messages [agent]="agent()">
              <!-- Human messages: right-aligned bubble -->
              <ng-template chatMessageTemplate="human" let-message>
                <div class="flex justify-end">
                  <div
                    class="max-w-[75%] px-4 py-2.5 text-[length:var(--chat-font-size)] leading-[var(--chat-line-height)] break-words border"
                    style="background: var(--chat-user-bg); color: var(--chat-user-text); border-color: var(--chat-user-border); border-radius: var(--chat-radius-message) var(--chat-radius-message) 6px var(--chat-radius-message);"
                  >{{ messageContent(message) }}</div>
                </div>
              </ng-template>

              <!-- AI messages: classified rendering (markdown + generative UI) -->
              <ng-template chatMessageTemplate="ai" let-message let-index="index">
                @let content = messageContent(message);
                @let classified = classifyMessage(content, index);
                <div class="flex gap-3">
                  <div
                    class="w-7 h-7 flex items-center justify-center text-xs font-semibold shrink-0 mt-0.5"
                    style="background: var(--chat-avatar-bg); color: var(--chat-avatar-text); border-radius: var(--chat-radius-avatar);"
                  >A</div>
                  <div class="flex-1 min-w-0 flex flex-col gap-2">
                    @if (classified.markdown(); as md) {
                      <chat-streaming-md
                        class="chat-md break-words text-[length:var(--chat-font-size)] leading-[var(--chat-line-height)]"
                        style="color: var(--chat-text);"
                        [content]="md"
                        [streaming]="agent().isLoading()"
                      />
                    }

                    @if (classified.spec(); as spec) {
                      <chat-generative-ui
                        [spec]="spec"
                        [registry]="renderRegistry()"
                        [store]="resolvedStore()"
                        [handlers]="handlers()"
                        [loading]="agent().isLoading()"
                        (events)="onSpecEvent($event, index)"
                      />
                    }

                    @if (classified.type() === 'a2ui') {
                      @if (views(); as catalog) {
                        @for (entry of classified.a2uiSurfaces() | keyvalue; track entry.key) {
                          <a2ui-surface
                            [surface]="entry.value"
                            [catalog]="catalog"
                            [handlers]="handlers()"
                            (action)="onA2uiAction($event)"
                            (events)="onA2uiEvent($event, index, entry.key)"
                          />
                        }
                      }
                    }
                  </div>
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

            <chat-typing-indicator [agent]="agent()" />
          </div>
        </div>

        <!-- Interrupt banner -->
        @if (agent().interrupt) {
          <chat-interrupt [agent]="agent()">
            <ng-template let-interrupt>
              <div class="px-5 py-3 border-t" style="background: var(--chat-warning-bg); border-color: var(--chat-border);">
                <p class="text-sm m-0" style="color: var(--chat-warning-text);">Agent paused: {{ interrupt.value }}</p>
              </div>
            </ng-template>
          </chat-interrupt>
        }

        <!-- Error banner -->
        <div class="px-5 pb-2">
          <chat-error [agent]="agent()" />
        </div>

        <!-- Input area -->
        <div class="border-t px-5 py-4" style="border-color: var(--chat-border);">
          <div class="max-w-[var(--chat-max-width)] mx-auto">
            <chat-input
              [agent]="agent()"
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

  readonly agent = input.required<Agent>();

  readonly views = input<ViewRegistry | undefined>(undefined);
  readonly store = input<StateStore | undefined>(undefined);
  readonly handlers = input<Record<string, (params: Record<string, unknown>) => unknown | Promise<unknown>>>({});
  readonly threads = input<Thread[]>([]);
  readonly activeThreadId = input<string>('');
  readonly threadSelected = output<string>();
  readonly sidebarOpen = signal(false);

  readonly renderEvent = output<ChatRenderEvent>();


  private readonly _internalStore = signalStateStore({});

  /**
   * Resolved store: use the explicitly provided store input, or fall back to
   * an internal store when `views` are provided (generative-ui use case).
   */
  readonly resolvedStore = computed(() => {
    const explicit = this.store();
    if (explicit) return explicit;
    if (this.views()) return this._internalStore;
    return undefined;
  });

  private readonly destroyRef = inject(DestroyRef);
  private eventsSubscribed = false;

  private readonly classifiers = new Map<number, ContentClassifier>();

  /** Convert ViewRegistry → AngularRegistry for ChatGenerativeUiComponent. */
  readonly renderRegistry = computed(() => {
    const v = this.views();
    return v ? toRenderRegistry(v) : undefined;
  });

  readonly messageContent = messageContent;

  private readonly scrollContainer = viewChild<ElementRef<HTMLElement>>('scrollContainer');

  /** Track message count to trigger auto-scroll */
  private readonly messageCount = computed(() => this.agent().messages().length);

  private prevMessageCount = 0;

  constructor() {
    // Route state_update events from the agent to the render state store
    // so components bound to $state paths reactively update.
    effect(() => {
      if (this.eventsSubscribed) return;
      let agent: ReturnType<typeof this.agent>;
      try {
        agent = this.agent();
      } catch {
        // Required input not yet available — skip; effect will retry.
        return;
      }
      this.eventsSubscribed = true;
      agent.events$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event) => {
        if (event.type !== 'state_update') return;
        const store = this.resolvedStore();
        if (!store) return;
        store.update(event.data);
      });
    });

    // Auto-scroll to bottom:
    // - Always scroll when message count increases (new message sent/received)
    // - During streaming partials, only scroll if user is near bottom
    effect(() => {
      // Guard against required `agent` input not yet being set (can fire
      // during initial change detection before input signals are populated).
      let count: number;
      let msgs: ReturnType<ReturnType<typeof this.agent>['messages']>;
      try {
        count = this.messageCount();
        msgs = this.agent().messages();
      } catch {
        return;
      }
      // Track last message content to trigger scroll during streaming partials
      const lastContent = msgs.length > 0
        ? (msgs[msgs.length - 1] as unknown as Record<string, unknown>)['content']
        : undefined;
      void lastContent; // consume the tracked value

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

  classifyMessage(content: string, index: number): ContentClassifier {
    let classifier = this.classifiers.get(index);
    if (!classifier) {
      classifier = createContentClassifier();
      this.classifiers.set(index, classifier);
    }
    classifier.update(content);
    return classifier;
  }

  clearClassifiers(): void {
    for (const [, c] of this.classifiers) {
      c.dispose();
    }
    this.classifiers.clear();
  }

  onSpecEvent(event: RenderEvent, messageIndex: number): void {
    this.renderEvent.emit({ messageIndex, event });
  }

  onA2uiAction(message: A2uiActionMessage): void {
    void this.agent().submit({ message: JSON.stringify(message) });
  }

  onA2uiEvent(event: RenderEvent, messageIndex: number, surfaceId: string): void {
    this.renderEvent.emit({ messageIndex, surfaceId, event });
  }
}
