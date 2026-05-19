// libs/chat/src/lib/compositions/chat/chat.component.ts
// SPDX-License-Identifier: MIT
import {
  Component, ChangeDetectionStrategy, input, model, output, computed, effect, signal, untracked, viewChild, ElementRef,
  DestroyRef, inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { KeyValuePipe } from '@angular/common';
import type { Agent, Message } from '../../agent';
import { ChatReasoningComponent } from '../../primitives/chat-reasoning/chat-reasoning.component';
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
import { ChatThreadListComponent, type Thread } from '../../primitives/chat-thread-list/chat-thread-list.component';
import { ChatGenerativeUiComponent } from '../../primitives/chat-generative-ui/chat-generative-ui.component';
import { ChatStreamingMdComponent } from '../../streaming/streaming-markdown.component';
import { ChatToolCallsComponent } from '../../primitives/chat-tool-calls/chat-tool-calls.component';
import { ChatSubagentsComponent } from '../../primitives/chat-subagents/chat-subagents.component';
import { ChatMessageActionsComponent } from '../../primitives/chat-message-actions/chat-message-actions.component';
import { ChatWelcomeComponent } from '../../primitives/chat-welcome/chat-welcome.component';
import { ChatSelectComponent, type ChatSelectOption } from '../../primitives/chat-select/chat-select.component';
import { A2uiSurfaceComponent } from '../../a2ui/surface.component';
import { ChatScrollBubbleComponent } from '../../primitives/chat-scroll-bubble/chat-scroll-bubble.component';
import { createContentClassifier, type ContentClassifier } from '../../streaming/content-classifier';
import { createPartialArgsBridge, type PartialArgsBridge } from '../../a2ui/partial-args-bridge';
import { createA2uiSurfaceStore, type A2uiSurfaceStore } from '../../a2ui/surface-store';
import { messageContent } from '../shared/message-utils';
import { CHAT_HOST_TOKENS, ensureChatRootStyles } from '../../styles/chat-tokens';
import type { ChatRenderEvent } from './chat-render-event';
import { CHAT_LIFECYCLE, type ChatLifecycle } from '../../lifecycle';

/**
 * Internal helper: WritableSignals backing the readonly ChatLifecycle surface
 * exposed via CHAT_LIFECYCLE. ChatComponent populates these as the user
 * interacts; consumers (e.g. cockpit-telemetry) only see the readonly view.
 */
interface ChatLifecycleInternal extends ChatLifecycle {
  _internal: {
    componentReady: ReturnType<typeof signal<boolean>>;
    firstMessageSent: ReturnType<typeof signal<boolean>>;
    messageCount: ReturnType<typeof signal<number>>;
    inputSubmittedAt: ReturnType<typeof signal<number | null>>;
  };
}

function createChatLifecycle(): ChatLifecycleInternal {
  const componentReady = signal(false);
  const firstMessageSent = signal(false);
  const messageCount = signal(0);
  const inputSubmittedAt = signal<number | null>(null);
  return {
    componentReady: componentReady.asReadonly(),
    firstMessageSent: firstMessageSent.asReadonly(),
    messageCount: messageCount.asReadonly(),
    inputSubmittedAt: inputSubmittedAt.asReadonly(),
    _internal: { componentReady, firstMessageSent, messageCount, inputSubmittedAt },
  };
}

/**
 * Returns true when the scroll position is within `tolerance` px of the bottom.
 * Pure helper extracted for unit testing.
 */
export function isPinned(
  scrollHeight: number,
  scrollTop: number,
  clientHeight: number,
  tolerance = 150,
): boolean {
  return scrollHeight - scrollTop - clientHeight < tolerance;
}

@Component({
  selector: 'chat',
  standalone: true,
  imports: [
    KeyValuePipe,
    ChatWindowComponent, ChatMessageListComponent, MessageTemplateDirective, ChatMessageComponent,
    ChatInputComponent, ChatTypingIndicatorComponent, ChatErrorComponent,
    ChatThreadListComponent, ChatGenerativeUiComponent,
    ChatStreamingMdComponent, ChatToolCallsComponent, ChatSubagentsComponent, A2uiSurfaceComponent,
    ChatMessageActionsComponent, ChatWelcomeComponent, ChatSelectComponent, ChatReasoningComponent,
    ChatScrollBubbleComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: CHAT_LIFECYCLE, useFactory: createChatLifecycle },
  ],
  styles: [CHAT_HOST_TOKENS, `
    :host {
      display: flex;
      flex-direction: column;
      flex: 1 1 auto;
      height: 100%;
      min-height: 0;
      max-height: 100%;
      overflow: hidden;
      background: var(--ngaf-chat-bg);
    }
    :host > chat-welcome {
      display: flex;
      flex: 1 1 auto;
      width: 100%;
    }
    .chat-shell { display: flex; flex: 1; min-height: 0; overflow: hidden; }
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
    .chat-scroll { flex: 1; min-height: 0; overflow-y: auto; padding-top: var(--ngaf-chat-edge-pad); }
    .chat-scroll::-webkit-scrollbar { width: 6px; }
    .chat-scroll::-webkit-scrollbar-thumb { background: var(--ngaf-chat-separator); border-radius: 10px; }
    [chatFooter] {
      padding-bottom: var(--ngaf-chat-edge-pad);
    }
    .chat-footer-wrap { position: relative; }
  `],
  template: `
    @if (showWelcome()) {
      <chat-welcome>
        <chat-input chatWelcomeInput [agent]="agent()" [submitOnEnter]="true" placeholder="Type a message...">
          @if (modelOptions().length > 0) {
            <chat-select
              chatInputModelSelect
              [options]="modelOptions()"
              [(value)]="selectedModel"
              [placeholder]="modelPickerPlaceholder()"
            />
          }
        </chat-input>
        <ng-container ngProjectAs="[chatWelcomeSuggestions]">
          <ng-content select="[chatWelcomeSuggestions]" />
        </ng-container>
      </chat-welcome>
    } @else {
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
          <div chatBody class="chat-scroll" #scrollContainer (scroll)="onScroll()">
            <chat-message-list [agent]="agent()">
              <ng-template chatMessageTemplate="human" let-message let-i="index">
                <chat-message [role]="'user'" [prevRole]="prevRole(i)">{{ messageContent(message) }}</chat-message>
              </ng-template>

              <ng-template chatMessageTemplate="ai" let-message let-i="index">
                @let content = messageContent(message);
                @let classified = classifyMessage(content, message);
                @let pending = classified.type() === 'pending';
                <chat-message
                  [role]="'assistant'"
                  [message]="message"
                  [prevRole]="prevRole(i)"
                  [streaming]="agent().isLoading() && i === agent().messages().length - 1"
                  [current]="i === agent().messages().length - 1"
                  [checkpointId]="checkpointFor(message)"
                  (replayRequested)="replayRequested.emit($event)"
                  (forkRequested)="forkRequested.emit($event)"
                >
                  @if (message.reasoning) {
                    <chat-reasoning
                      [content]="message.reasoning"
                      [isStreaming]="isReasoningStreaming(message, i)"
                      [durationMs]="message.reasoningDurationMs"
                    />
                  }
                  <chat-tool-calls [agent]="agent()" [message]="message" [excludeToolNames]="genuiToolNames()">
                    <ng-container ngProjectAs="[chatToolCallTemplate]">
                      <ng-content select="[chatToolCallTemplate]" />
                    </ng-container>
                  </chat-tool-calls>
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
                        [state]="classified.a2uiSurfaceStates().get(entry.key)"
                        [catalog]="catalog"
                        [handlers]="handlers()"
                        (action)="onA2uiAction($event)"
                        (events)="onA2uiEvent($event, i, entry.key)"
                      />
                    }
                  }
                  <chat-message-actions
                    chatMessageControls
                    [content]="content"
                    [disabled]="agent().isLoading()"
                    (regenerate)="onRegenerate(i)"
                    (rate)="onRate(message, $event)"
                    (contentCopied)="onCopy(message, $event)"
                  />
                </chat-message>
              </ng-template>

              <ng-template chatMessageTemplate="tool" let-message>
                <!-- Tool messages route through chat-trace; hidden from main flow. -->
              </ng-template>

              <ng-template chatMessageTemplate="system" let-message>
                <chat-message [role]="'system'">{{ messageContent(message) }}</chat-message>
              </ng-template>
            </chat-message-list>

            <!-- Suppress the floor typing-indicator while the current
                 assistant bubble is streaming: its own caret is already
                 the loading affordance. Showing both reads as visual
                 noise rather than richer feedback. See
                 currentAssistantStreaming() on the component class. -->
            @if (pinned() && !currentAssistantStreaming()) {
              <chat-typing-indicator [agent]="agent()" />
            }
          </div>
          <div chatFooter class="chat-footer-wrap">
            @if (!pinned()) {
              <chat-scroll-bubble
                [mode]="agent().isLoading() ? 'streaming' : 'idle'"
                (clicked)="onScrollBubbleClick()"
              />
            }
            <chat-error [agent]="agent()" />
            <chat-input [agent]="agent()" [submitOnEnter]="true" placeholder="Type a message..." (submitted)="onUserSubmitted()">
              @if (modelOptions().length > 0) {
                <chat-select
                  chatInputModelSelect
                  [options]="modelOptions()"
                  [(value)]="selectedModel"
                  [placeholder]="modelPickerPlaceholder()"
                />
              } @else {
                <ng-container ngProjectAs="[chatInputModelSelect]">
                  <ng-content select="[chatInputModelSelect]" />
                </ng-container>
              }
            </chat-input>
          </div>
        </chat-window>
      </div>
    </div>
    }
  `,
})
export class ChatComponent {
  readonly agent = input.required<Agent>();
  readonly views = input<ViewRegistry | undefined>(undefined);
  readonly store = input<StateStore | undefined>(undefined);
  readonly handlers = input<Record<string, (params: Record<string, unknown>) => unknown | Promise<unknown>>>({});
  readonly threads = input<Thread[]>([]);
  readonly activeThreadId = input<string>('');
  readonly welcomeDisabled = input<boolean>(false);

  /**
   * High-level model-picker API. When `modelOptions` is non-empty, the chat
   * composition renders a `<chat-select>` inside the input pill (in BOTH
   * welcome and conversation modes), wired to the two-way `selectedModel`
   * model. Consumers who want full control should leave `modelOptions`
   * empty and project a `<chat-select chatInputModelSelect>` themselves.
   */
  readonly modelOptions = input<readonly ChatSelectOption[]>([]);
  readonly selectedModel = model<string>('');
  readonly modelPickerPlaceholder = input<string>('Choose a model');

  /**
   * Tool names whose calls produce a rendered GenUI surface rather than
   * visible text. Used to (a) filter <chat-tool-calls> so internal
   * dispatchers don't render args JSON as cards, and (b) detect
   * "this is a GenUI turn" for the building-UI skeleton.
   * Default covers the canonical A2UI + json-render schema tools.
   */
  readonly genuiToolNames = input<readonly string[]>([
    'generate_a2ui_schema',
    'generate_json_render_spec',
    'render_spec',
  ]);

  readonly showWelcome = computed(() => {
    if (this.welcomeDisabled()) return false;
    const a = this.agent() as unknown as { isThreadLoading?: () => boolean };
    if (a.isThreadLoading?.()) return false;
    return this.agent().messages().length === 0;
  });
  readonly threadSelected = output<string>();
  readonly renderEvent = output<ChatRenderEvent>();
  /** Emitted when the user clicks the regenerate button on an assistant message. */
  readonly regenerate = output<void>();
  /** Emitted when the user rates an assistant message. */
  readonly rate = output<{ messageIndex: number; rating: 'up' | 'down' }>();
  /** Emitted when the user copies an assistant message. */
  readonly messageCopy = output<{ messageIndex: number; content: string }>();
  /** Bubbled from chat-message gutter markers when the user requests a checkpoint replay. */
  readonly replayRequested = output<string>();
  /** Bubbled from chat-message gutter markers when the user requests a checkpoint fork. */
  readonly forkRequested = output<string>();

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

  /**
   * True while a message's reasoning is mid-stream — i.e. it's the latest
   * message, the agent is loading, the message has reasoning content, and
   * no response text has arrived yet. Once the response text begins, the
   * reasoning pill collapses (per its internal logic).
   */
  protected isReasoningStreaming(message: Message, index: number): boolean {
    const agent = this.agent();
    const isTail = index === agent.messages().length - 1;
    if (!isTail || !agent.isLoading()) return false;
    if (!message.reasoning || message.reasoning.length === 0) return false;
    const text = typeof message.content === 'string' ? message.content : '';
    return text.length === 0;
  }

  private readonly classifiers = new Map<string, ContentClassifier>();
  private readonly destroyRef = inject(DestroyRef);
  // Resolved against the component's own `providers` in normal use. The fallback
  // is for tests that construct ChatComponent via `new` inside a bare injection
  // context (no element injector, so component-level providers are skipped).
  private readonly lifecycle = (inject(CHAT_LIFECYCLE, { optional: true }) ?? createChatLifecycle()) as ChatLifecycleInternal;
  private eventsSubscribed = false;

  /**
   * Shared A2UI surface store fed by the live partial-args bridge. The
   * content-classifier path will share this store via tool_call_id
   * short-circuit (skipping re-dispatch for live tool_call_ids).
   */
  protected readonly liveSurfaceStore: A2uiSurfaceStore = createA2uiSurfaceStore();
  private readonly partialBridge: PartialArgsBridge = createPartialArgsBridge(this.liveSurfaceStore);
  private partialEventsLastIndex = 0;

  private readonly scrollContainer = viewChild<ElementRef<HTMLElement>>('scrollContainer');
  private readonly messageCount = computed(() => this.agent().messages().length);
  private prevMessageCount = 0;
  private wasLoading = false;
  protected readonly pinned = signal<boolean>(true);
  private programmaticScrollCount = 0;
  private static readonly PIN_TOLERANCE_PX = 150;

  /**
   * True iff there's a current (last-index) assistant message that's
   * still streaming. The bubble's own caret already signals loading;
   * we suppress the floor typing-indicator in that case so the user
   * doesn't see two loading affordances at once.
   *
   * Matches the same `streaming + current` condition the bubble uses
   * to enable `.chat-message__caret`:
   *   `agent().isLoading() && i === agent().messages().length - 1`
   *   `i === agent().messages().length - 1`
   *
   * Restricted to assistant role because the caret only renders on
   * assistant bubbles (`:host([data-role="assistant"][data-current=...
   *  ][data-streaming=...])`).
   */
  protected readonly currentAssistantStreaming = computed(() => {
    if (!this.agent().isLoading()) return false;
    const msgs = this.agent().messages();
    if (msgs.length === 0) return false;
    const last = msgs[msgs.length - 1];
    return last?.role === 'assistant';
  });

  constructor() {
    // Inject the chat lib's root CSS custom properties (--ngaf-chat-bg,
    // --ngaf-chat-surface, --ngaf-chat-radius-input, etc.) the first
    // time any chat composition is constructed. The module-eval side
    // effect that previously handled this is unreliable under
    // aggressive production tree-shaking — bundlers that don't see
    // the source `chat-tokens.ts` path in the published artifact's
    // `sideEffects` glob drop the call entirely, leaving consumers
    // with zero token defaults (sidenav has no width, input has no
    // border, chips have no chrome — everything renders as plain
    // text on the page background). Calling from a constructor that
    // is unconditionally reachable from user code defeats that
    // tree-shaking and is idempotent. */
    ensureChatRootStyles();
    effect(() => {
      if (this.eventsSubscribed) return;
      let agent: ReturnType<typeof this.agent>;
      try { agent = this.agent(); } catch { return; }
      this.eventsSubscribed = true;
      this.lifecycle._internal.componentReady.set(true);
      agent.events$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event) => {
        if (event.type !== 'state_update') return;
        const store = this.resolvedStore();
        if (!store) return;
        store.update(event.data);
      });
    });

    // Spec 4: flip CHAT_LIFECYCLE.firstMessageSent when the agent's stream
    // starts, regardless of submit path (input-bound, programmatic, suggestion-
    // click). Sticky — guarded so we never re-set a flag that's already true.
    // `lifecycle` is not on the base Agent contract; adapters like @ngaf/langgraph
    // attach it. Duck-type the read so non-lifecycle agents are a no-op.
    effect(() => {
      let agentRef: ReturnType<typeof this.agent>;
      try { agentRef = this.agent(); } catch { return; }
      const lc = (agentRef as unknown as { lifecycle?: { streamStartedAt?: () => number | null } }).lifecycle;
      const streamStartedAt = lc?.streamStartedAt?.();
      if (streamStartedAt != null && !this.lifecycle._internal.firstMessageSent()) {
        this.lifecycle._internal.firstMessageSent.set(true);
      }
    });

    // Auto-scroll-to-bottom. Fires on every signal update during streaming
    // (each token mutates the last message's content), so this MUST be cheap
    // and idempotent. Earlier this used scrollTo({ behavior: 'smooth' }) per
    // token, which queues overlapping smooth-scroll animations (~12/sec)
    // and produces visibly jerky scroll. Direct `scrollTop = scrollHeight`
    // is instant, free, and only repaints when the value actually changes.
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
      if (isNewMessage || this.pinned()) {
        this.programmaticScrollCount++;
        el.scrollTop = el.scrollHeight;
        requestAnimationFrame(() => { this.programmaticScrollCount--; });
        if (isNewMessage) untracked(() => this.pinned.set(true));
      }
    });

    // Final scroll when streaming completes. The content-mutation effect above
    // fires on every token but stops when streaming ends; action buttons
    // (reload, copy) render on idle and can land below the fold without this.
    effect(() => {
      let loading: boolean;
      try { loading = this.agent().isLoading(); } catch { return; }
      if (loading) {
        this.wasLoading = true;
        return;
      }
      if (!this.wasLoading) return;
      this.wasLoading = false;
      if (this.pinned()) {
        // Defer one frame so message-actions have rendered.
        requestAnimationFrame(() => {
          const el2 = this.scrollContainer()?.nativeElement;
          if (!el2) return;
          this.programmaticScrollCount++;
          el2.scrollTop = el2.scrollHeight;
          requestAnimationFrame(() => { this.programmaticScrollCount--; });
        });
      }
    });

    // Subscribe to a2ui-partial custom events from the LangGraph backend.
    // Each event delivers a cumulative args string keyed by tool_call_id;
    // bridge.push() re-parses and dispatches new envelopes incrementally.
    // The runtime-neutral Agent contract does not require a customEvents
    // signal, so we feature-detect: adapters that expose it (e.g.
    // LangGraphAgent's customEvents signal) light up live streaming;
    // others continue to use the wrapped final-message classifier path.
    effect(() => {
      let agent: ReturnType<typeof this.agent>;
      try { agent = this.agent(); } catch { return; }
      const customSig = (agent as unknown as {
        customEvents?: () => readonly { name: string; data: unknown }[];
      }).customEvents;
      if (typeof customSig !== 'function') return;
      const events = customSig();
      for (let i = this.partialEventsLastIndex; i < events.length; i++) {
        const e = events[i];
        if (e.name !== 'a2ui-partial') continue;
        const d = e.data as { tool_call_id?: string; args_so_far?: string } | null;
        if (!d || typeof d.tool_call_id !== 'string' || typeof d.args_so_far !== 'string') continue;
        this.partialBridge.push(d.tool_call_id, d.args_so_far);
      }
      this.partialEventsLastIndex = events.length;
    });

    effect(() => {
      // janitor: drop classifiers for messages no longer in the agent's list
      let liveIds: Set<string>;
      try {
        liveIds = new Set<string>();
        for (const m of this.agent().messages()) {
          const id = (m as unknown as { id?: string }).id;
          if (id) liveIds.add(id);
        }
      } catch { return; }
      for (const key of [...this.classifiers.keys()]) {
        if (!liveIds.has(key)) {
          this.classifiers.get(key)?.dispose();
          this.classifiers.delete(key);
        }
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

  protected onScroll(): void {
    if (this.programmaticScrollCount > 0) return;
    const el = this.scrollContainer()?.nativeElement;
    if (!el) return;
    const nextPinned = isPinned(el.scrollHeight, el.scrollTop, el.clientHeight, ChatComponent.PIN_TOLERANCE_PX);
    if (nextPinned !== this.pinned()) this.pinned.set(nextPinned);
  }

  protected onScrollBubbleClick(): void {
    const el = this.scrollContainer()?.nativeElement;
    if (!el) return;
    this.programmaticScrollCount++;
    el.scrollTop = el.scrollHeight;
    requestAnimationFrame(() => { this.programmaticScrollCount--; });
    this.pinned.set(true);
  }

  protected onUserSubmitted(): void {
    this.pinned.set(true);
    this.recordSubmit();
  }

  /**
   * Programmatic submit. Calls `agent.submit({ message: text })` and updates
   * the CHAT_LIFECYCLE signals. Trimmed-empty text is a no-op.
   */
  submitMessage(text: string): void {
    const trimmed = text.trim();
    if (!trimmed) return;
    void this.agent().submit({ message: trimmed });
    this.recordSubmit();
  }

  /**
   * Clears local view state (classifiers, surface store, lifecycle counters)
   * for a new thread.
   *
   * Resets messageCount to 0 and inputSubmittedAt to null. componentReady and
   * firstMessageSent are NOT reset (sticky for the chat instance lifetime).
   */
  clearThread(): void {
    this.clearClassifiers();
    this.lifecycle._internal.messageCount.set(0);
    this.lifecycle._internal.inputSubmittedAt.set(null);
  }

  private recordSubmit(): void {
    if (!this.lifecycle._internal.firstMessageSent()) {
      this.lifecycle._internal.firstMessageSent.set(true);
    }
    this.lifecycle._internal.messageCount.update((c) => c + 1);
    this.lifecycle._internal.inputSubmittedAt.set(Date.now());
  }

  /**
   * Look up the previous message in the agent's messages list.
   * Returns undefined for the first message.
   */
  protected prevMessage(index: number): unknown {
    if (index === 0) return undefined;
    return this.agent().messages()[index - 1];
  }

  /**
   * True when this assistant message is part of a GenUI render turn.
   * Walks backward through messages from `index` until it finds either
   * an assistant message with `tool_calls` referencing a GenUI tool
   * (→ this turn produces a surface) or a human message (→ the
   * preceding turn ended; this assistant message stands on its own).
   *
   * Also checks the message itself for:
   *   - `extra.tool_calls[].name` matching a GenUI tool (post-streaming
   *     state of the tool-call AI message), OR
   *   - `extra.content[].type === 'function_call' && .name` matching
   *     (live during the OpenAI Responses-API streaming chunks before
   *     `tool_calls` populates).
   *
   * The walk-back approach is robust to LangGraph's in-place
   * replacement of the ToolMessage (which strips the `name` field),
   * unlike a single prev-message check.
   */
  protected isGenuiTurn(message: unknown, _prevMsg: unknown, index?: number): boolean {
    const names = new Set(this.genuiToolNames());
    const m = message as { extra?: Record<string, unknown> } | null | undefined;
    if (!m) return false;

    // Direct check on the message itself (covers the tool-call AI message).
    const calls = (m.extra?.['tool_calls'] as Array<{ name?: string }> | undefined) ?? [];
    if (calls.some(c => c.name != null && names.has(c.name))) return true;

    const rawContent = m.extra?.['content'];
    if (Array.isArray(rawContent)) {
      for (const block of rawContent) {
        if (block != null
            && typeof block === 'object'
            && (block as { type?: unknown }).type === 'function_call'
            && typeof (block as { name?: unknown }).name === 'string'
            && names.has((block as { name: string }).name)) {
          return true;
        }
      }
    }

    // Content-shape detector: during streaming, LangGraph projects the
    // sub-LLM's tool_call.arguments as the assistant message's content
    // string (NOT as a structured array). The structured array form
    // only materialises after streaming completes. So during streaming,
    // we see the JSON envelopes flowing in as text — neither tool_calls
    // nor content[].function_call are populated. Detect via stable
    // A2UI/json-render markers in the content string.
    const projectedContent = (m as { content?: unknown }).content;
    if (typeof projectedContent === 'string' && projectedContent.length > 0) {
      // A2UI v1 envelope keys (canonical Google shape).
      if (projectedContent.includes('"surfaceUpdate"')
          || projectedContent.includes('"beginRendering"')
          || projectedContent.includes('"dataModelUpdate"')) {
        return true;
      }
      // json-render spec shape — looks like `{ "root": "...", "elements": ... }`.
      if (projectedContent.includes('"root"') && projectedContent.includes('"elements"')) {
        return true;
      }
    }

    // Direct prev-message check (fast path for the well-formed case
    // where the immediately-preceding tool message still has its name).
    const p = _prevMsg as { role?: string; name?: string; extra?: Record<string, unknown> } | null | undefined;
    if (p && p.role === 'tool') {
      const toolName = (p.extra?.['name'] as string | undefined) ?? p.name;
      if (typeof toolName === 'string' && names.has(toolName)) return true;
    }

    // Walk backward through messages for the emit-phase assistant
    // message whose own structure has no GenUI hint. Bounded by the
    // most recent human message (= start of the current turn).
    if (typeof index === 'number' && index > 0) {
      const msgs = this.agent().messages();
      for (let i = index - 1; i >= 0; i--) {
        const prev = msgs[i] as { role?: string; extra?: Record<string, unknown> };
        if (!prev) break;
        if (prev.role === 'user') break;  // crossed the turn boundary

        const prevCalls = (prev.extra?.['tool_calls'] as Array<{ name?: string }> | undefined) ?? [];
        if (prevCalls.some(c => c.name != null && names.has(c.name))) return true;

        const prevRaw = prev.extra?.['content'];
        if (Array.isArray(prevRaw)) {
          for (const block of prevRaw) {
            if (block != null
                && typeof block === 'object'
                && (block as { type?: unknown }).type === 'function_call'
                && typeof (block as { name?: unknown }).name === 'string'
                && names.has((block as { name: string }).name)) {
              return true;
            }
          }
        }
      }
    }

    return false;
  }

  classifyMessage(content: string, message: { id?: string }): ContentClassifier {
    const id = message.id ?? '';
    let c = this.classifiers.get(id);
    if (!c) {
      c = createContentClassifier();
      this.classifiers.set(id, c);
    }
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

  /** Regenerate the assistant response at the given message index. */
  onRegenerate(messageIndex: number): void {
    void this.agent().regenerate(messageIndex);
    this.regenerate.emit();
  }

  onRate(message: unknown, value: 'up' | 'down'): void {
    const idx = this.agent().messages().indexOf(message as never);
    this.rate.emit({ messageIndex: idx, rating: value });
  }

  onCopy(message: unknown, content: string): void {
    const idx = this.agent().messages().indexOf(message as never);
    this.messageCopy.emit({ messageIndex: idx, content });
  }

  /** Returns the checkpoint id associated with an AI message, if the
   *  underlying agent exposes messageCheckpoints(). */
  protected checkpointFor(msg: Message): string | undefined {
    const id = (msg as unknown as { id?: string }).id;
    if (typeof id !== 'string') return undefined;
    const map = (this.agent() as unknown as { messageCheckpoints?: () => ReadonlyMap<string, string> })
      .messageCheckpoints?.();
    return map?.get(id);
  }
}
