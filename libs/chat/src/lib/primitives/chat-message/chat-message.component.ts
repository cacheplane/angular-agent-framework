// libs/chat/src/lib/primitives/chat-message/chat-message.component.ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input, output, computed, effect, inject } from '@angular/core';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';
import { CHAT_MESSAGE_STYLES } from '../../styles/chat-message.styles';
import { ChatCitationsComponent } from '../chat-citations/chat-citations.component';
import { ChatCheckpointMarkerComponent } from '../chat-checkpoint-marker/chat-checkpoint-marker.component';
import { ChatGenuiSkeletonComponent } from '../chat-genui-skeleton/chat-genui-skeleton.component';
import { CitationsResolverService } from '../../markdown/citations-resolver.service';
import type { Message } from '../../agent/message';

export type ChatMessageRole = 'user' | 'assistant' | 'system' | 'tool';

/** Default set of tool names that produce a rendered surface rather than
 *  visible text. Consumers can override via the `genuiToolNames` input. */
const DEFAULT_GENUI_TOOL_NAMES: readonly string[] = [
  'generate_a2ui_schema',
  'generate_json_render_spec',
];

@Component({
  selector: 'chat-message',
  standalone: true,
  imports: [ChatCitationsComponent, ChatCheckpointMarkerComponent, ChatGenuiSkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [CHAT_HOST_TOKENS, CHAT_MESSAGE_STYLES, `
    .chat-message__layout { display: flex; gap: 8px; align-items: flex-start; }
    .chat-message__gutter { flex: 0 0 14px; display: flex; align-items: flex-start; padding-top: 4px; }
    .chat-message__gutter:empty { flex-basis: 0; }
    .chat-message__main { flex: 1; min-width: 0; }
  `],
  providers: [CitationsResolverService],
  host: {
    '[attr.data-role]': 'role()',
    '[attr.data-current]': 'currentStr()',
    '[attr.data-streaming]': 'streamingStr()',
    '[attr.data-prev-role]': 'prevRole() ?? null',
  },
  template: `
    <div class="chat-message__layout">
      <div class="chat-message__gutter">
        @if (checkpointId(); as cpId) {
          <chat-checkpoint-marker
            [checkpointId]="cpId"
            [isActive]="checkpointActive()"
            (replayRequested)="replayRequested.emit($event)"
            (forkRequested)="forkRequested.emit($event)"
          />
        }
      </div>
      <div class="chat-message__main">
        @if (isGenUiToolCall()) {
          <chat-genui-skeleton />
        } @else {
          <div [class]="bodyClass()">
            <ng-content />
            <span class="chat-message__caret" aria-hidden="true"></span>
          </div>
          @if (message()?.role === 'assistant' && message(); as msg) {
            <chat-citations [message]="msg" />
          }
          <div class="chat-message__controls">
            <ng-content select="[chatMessageControls]" />
          </div>
        }
      </div>
    </div>
  `,
})
export class ChatMessageComponent {
  readonly role = input.required<ChatMessageRole>();
  readonly current = input(false);
  readonly streaming = input(false);
  readonly prevRole = input<ChatMessageRole | undefined>(undefined);
  readonly message = input<Message | undefined>(undefined);

  /** Optional checkpoint id to anchor a gutter marker. When set, a
   *  chat-checkpoint-marker is rendered in the left gutter and emits
   *  bubble through this component's replayRequested / forkRequested outputs. */
  readonly checkpointId = input<string | undefined>(undefined);
  readonly checkpointActive = input<boolean>(false);

  /** Tool names whose call/result messages should render a skeleton in
   *  place of the streaming body. Defaults to the A2UI / json-render
   *  pair; consumers can override or extend. */
  readonly genuiToolNames = input<readonly string[]>(DEFAULT_GENUI_TOOL_NAMES);

  readonly replayRequested = output<string>();
  readonly forkRequested = output<string>();

  private readonly resolver = inject(CitationsResolverService);

  constructor() {
    effect(() => {
      this.resolver.message.set(this.message() ?? null);
    });
  }

  readonly currentStr = computed(() => String(this.current()));
  readonly streamingStr = computed(() => String(this.streaming()));

  readonly bodyClass = computed(() => {
    switch (this.role()) {
      case 'user': return 'chat-message__bubble';
      case 'assistant': return 'chat-message__assistant-body';
      default: return 'chat-message__plain';
    }
  });

  /** True when this message represents (or results from) a GenUI tool
   *  call whose body should be suppressed in favor of a skeleton.
   *
   *  Detection layers — each catches a distinct phase of the streaming
   *  pipeline so the skeleton replaces the body from the first token:
   *
   *  1a. Post-streaming AI message with `extra.tool_calls[].name`
   *      referencing a GenUI tool.
   *  1b. Live-streaming AI message whose OpenAI Responses-API content
   *      array contains a `function_call` block with the tool name —
   *      arrives on the first chunk, before `tool_calls` populates.
   *  1c. Emit-phase AI message whose content starts with the A2UI
   *      sentinel `---a2ui_JSON---` (or any prefix of it during the
   *      first few stream tokens).
   *  2.  Tool result message whose `name` matches a GenUI tool. */
  readonly isGenUiToolCall = computed<boolean>(() => {
    const m = this.message();
    if (!m) return false;
    const names = new Set(this.genuiToolNames());

    if (m.role === 'assistant') {
      // 1a: tool_calls field (post-streaming).
      const calls = (m.extra?.['tool_calls'] as Array<{ name?: string }> | undefined) ?? [];
      if (calls.some(c => c.name != null && names.has(c.name))) return true;

      // 1b: OpenAI Responses-API content-array `function_call` block —
      //     available from the first streaming chunk.
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

      // 1c: A2UI sentinel prefix on the emit-phase message. Matches
      //     both the full prefix and any partial prefix that arrives
      //     during the first few stream tokens (e.g. `--`, `---a`).
      if (typeof m.content === 'string' && m.content.length > 0) {
        const A2UI_SENTINEL = '---a2ui_JSON---';
        if (m.content.startsWith(A2UI_SENTINEL)) return true;
        if (A2UI_SENTINEL.startsWith(m.content)) return true;
      }
    }

    // 2: tool result message tagged with the GenUI tool name.
    if (m.role === 'tool') {
      const name = (m.extra?.['name'] as string | undefined) ?? m.name;
      if (typeof name === 'string' && names.has(name)) return true;
    }

    return false;
  });
}
