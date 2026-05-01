// libs/chat/src/lib/compositions/chat/chat.component.ts
// SPDX-License-Identifier: MIT
import {
  Component, ChangeDetectionStrategy, input, output, computed, effect, viewChild, ElementRef,
  DestroyRef, inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { KeyValuePipe } from '@angular/common';
import type { Agent } from '../../agent';
import type { ViewRegistry, RenderEvent } from '@ngaf/render';
import type { A2uiActionMessage } from '@ngaf/a2ui';
import type { StateStore } from '@json-render/core';
import { toRenderRegistry, signalStateStore } from '@ngaf/render';
import { ChatWindowComponent } from '../../primitives/chat-window/chat-window.component';
import { ChatMessageListComponent } from '../../primitives/chat-message-list/chat-message-list.component';
import { MessageTemplateDirective } from '../../primitives/chat-message-list/message-template.directive';
import { ChatMessageComponent, type ChatMessageRole } from '../../primitives/chat-message/chat-message.component';
import { ChatInputComponent } from '../../primitives/chat-input/chat-input.component';
import { ChatTypingIndicatorComponent } from '../../primitives/chat-typing-indicator/chat-typing-indicator.component';
import { ChatErrorComponent } from '../../primitives/chat-error/chat-error.component';
import { ChatInterruptComponent } from '../../primitives/chat-interrupt/chat-interrupt.component';
import { ChatThreadListComponent, type Thread } from '../../primitives/chat-thread-list/chat-thread-list.component';
import { ChatGenerativeUiComponent } from '../../primitives/chat-generative-ui/chat-generative-ui.component';
import { ChatStreamingMdComponent } from '../../streaming/streaming-markdown.component';
import { ChatToolCallsComponent } from '../../primitives/chat-tool-calls/chat-tool-calls.component';
import { ChatSubagentsComponent } from '../../primitives/chat-subagents/chat-subagents.component';
import { A2uiSurfaceComponent } from '../../a2ui/surface.component';
import { createContentClassifier, type ContentClassifier } from '../../streaming/content-classifier';
import { messageContent } from '../shared/message-utils';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';
import type { ChatRenderEvent } from './chat-render-event';

@Component({
  selector: 'chat',
  standalone: true,
  imports: [
    KeyValuePipe,
    ChatWindowComponent, ChatMessageListComponent, MessageTemplateDirective, ChatMessageComponent,
    ChatInputComponent, ChatTypingIndicatorComponent, ChatErrorComponent, ChatInterruptComponent,
    ChatThreadListComponent, ChatGenerativeUiComponent,
    ChatStreamingMdComponent, ChatToolCallsComponent, ChatSubagentsComponent, A2uiSurfaceComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [CHAT_HOST_TOKENS, `
    :host { display: flex; flex-direction: column; height: 100%; min-height: 0; background: var(--ngaf-chat-bg); }
    .chat-shell { display: flex; flex: 1; min-height: 0; }
    .chat-shell__sidebar {
      width: 240px;
      flex-shrink: 0;
      border-right: 1px solid var(--ngaf-chat-separator);
      background: var(--ngaf-chat-surface-alt);
      overflow-y: auto;
      display: none;
    }
    @media (min-width: 768px) { .chat-shell__sidebar { display: block; } }
    .chat-shell__main { flex: 1; min-width: 0; display: flex; flex-direction: column; min-height: 0; }
    .chat-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 60px 20px;
      color: var(--ngaf-chat-text-muted);
      text-align: center;
      flex: 1;
      min-height: 0;
    }
    .chat-empty[hidden] { display: none; }
    .chat-empty__title { font-size: 1.125rem; font-weight: 500; color: var(--ngaf-chat-text); margin: 0; }
    .chat-empty__sub { margin: 0; font-size: var(--ngaf-chat-font-size-sm); }
    .chat-empty__title { font-size: 1.125rem; font-weight: 500; color: var(--ngaf-chat-text); margin: 0; }
    .chat-empty__sub { margin: 0; font-size: var(--ngaf-chat-font-size-sm); }
    .chat-scroll { flex: 1; min-height: 0; overflow-y: auto; }
    .chat-scroll::-webkit-scrollbar { width: 6px; }
    .chat-scroll::-webkit-scrollbar-thumb { background: var(--ngaf-chat-separator); border-radius: 10px; }
  `],
  template: `
    <div class="chat-shell">
      @if (threads().length > 0) {
        <aside class="chat-shell__sidebar">
          <chat-thread-list
            [threads]="threads()"
            [activeThreadId]="activeThreadId()"
            (threadSelected)="threadSelected.emit($event)"
          />
        </aside>
      }
      <div class="chat-shell__main">
        <chat-window>
          <ng-content select="[chatHeader]" chatHeader />
          <div chatBody class="chat-scroll" #scrollContainer>
            <div class="chat-empty" [hidden]="agent().messages().length !== 0 || agent().isLoading()">
              <ng-content select="[chatEmptyState]">
                <p class="chat-empty__title">How can I help?</p>
                <p class="chat-empty__sub">Ask anything to get started.</p>
              </ng-content>
            </div>

            <chat-message-list [agent]="agent()">
              <ng-template chatMessageTemplate="human" let-message let-i="index">
                <chat-message [role]="'user'" [prevRole]="prevRole(i)">{{ messageContent(message) }}</chat-message>
              </ng-template>

              <ng-template chatMessageTemplate="ai" let-message let-i="index">
                @let content = messageContent(message);
                @let classified = classifyMessage(content, i);
                <chat-message
                  [role]="'assistant'"
                  [prevRole]="prevRole(i)"
                  [streaming]="agent().isLoading()"
                  [current]="i === agent().messages().length - 1"
                >
                  <chat-tool-calls [agent]="agent()" [message]="message" />
                  <chat-subagents [agent]="agent()" />
                  @if (classified.markdown(); as md) {
                    <chat-streaming-md [content]="md" [streaming]="agent().isLoading() && i === agent().messages().length - 1" />
                  }
                  @if (classified.spec(); as spec) {
                    <chat-generative-ui
                      [spec]="spec"
                      [registry]="renderRegistry()"
                      [store]="resolvedStore()"
                      [handlers]="handlers()"
                      [loading]="agent().isLoading()"
                      (events)="onSpecEvent($event, i)"
                    />
                  }
                  @if (classified.type() === 'a2ui' && views(); as catalog) {
                    @for (entry of classified.a2uiSurfaces() | keyvalue; track entry.key) {
                      <a2ui-surface
                        [surface]="entry.value"
                        [catalog]="catalog"
                        [handlers]="handlers()"
                        (action)="onA2uiAction($event)"
                        (events)="onA2uiEvent($event, i, entry.key)"
                      />
                    }
                  }
                </chat-message>
              </ng-template>

              <ng-template chatMessageTemplate="tool" let-message>
                <!-- Tool messages route through chat-trace; hidden from main flow. -->
              </ng-template>

              <ng-template chatMessageTemplate="system" let-message>
                <chat-message [role]="'system'">{{ messageContent(message) }}</chat-message>
              </ng-template>
            </chat-message-list>

            <chat-typing-indicator [agent]="agent()" />
          </div>
          <div chatFooter>
            <chat-error [agent]="agent()" />
            <chat-interrupt [agent]="agent()" />
            <chat-input [agent]="agent()" [submitOnEnter]="true" placeholder="Type a message..." />
          </div>
        </chat-window>
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
  readonly renderEvent = output<ChatRenderEvent>();

  private readonly _internalStore = signalStateStore({});
  readonly resolvedStore = computed(() => {
    const explicit = this.store();
    if (explicit) return explicit;
    if (this.views()) return this._internalStore;
    return undefined;
  });

  readonly renderRegistry = computed(() => {
    const v = this.views();
    return v ? toRenderRegistry(v) : undefined;
  });

  readonly messageContent = messageContent;
  private readonly classifiers = new Map<number, ContentClassifier>();
  private readonly destroyRef = inject(DestroyRef);
  private eventsSubscribed = false;

  private readonly scrollContainer = viewChild<ElementRef<HTMLElement>>('scrollContainer');
  private readonly messageCount = computed(() => this.agent().messages().length);
  private prevMessageCount = 0;

  constructor() {
    effect(() => {
      if (this.eventsSubscribed) return;
      let agent: ReturnType<typeof this.agent>;
      try { agent = this.agent(); } catch { return; }
      this.eventsSubscribed = true;
      agent.events$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event) => {
        if (event.type !== 'state_update') return;
        const store = this.resolvedStore();
        if (!store) return;
        store.update(event.data);
      });
    });

    effect(() => {
      let count: number;
      let msgs: ReturnType<ReturnType<typeof this.agent>['messages']>;
      try { count = this.messageCount(); msgs = this.agent().messages(); } catch { return; }
      const lastContent = msgs.length > 0 ? (msgs[msgs.length - 1] as unknown as Record<string, unknown>)['content'] : undefined;
      void lastContent;
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

  prevRole(index: number): ChatMessageRole | undefined {
    if (index === 0) return undefined;
    const prev = this.agent().messages()[index - 1];
    if (!prev) return undefined;
    const role = (prev as unknown as { role?: string }).role;
    if (role === 'user') return 'user';
    if (role === 'assistant') return 'assistant';
    if (role === 'system') return 'system';
    if (role === 'tool') return 'tool';
    return undefined;
  }

  classifyMessage(content: string, index: number): ContentClassifier {
    let c = this.classifiers.get(index);
    if (!c) { c = createContentClassifier(); this.classifiers.set(index, c); }
    c.update(content);
    return c;
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
