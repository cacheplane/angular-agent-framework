// libs/chat/src/lib/primitives/chat-tool-calls/chat-tool-calls.component.ts
// SPDX-License-Identifier: MIT
import {
  Component, ChangeDetectionStrategy,
  computed, contentChildren, input, signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import type { Agent, Message, ToolCall } from '../../agent';
import { ChatToolCallCardComponent, type ToolCallInfo } from '../../compositions/chat-tool-call-card/chat-tool-call-card.component';
import { ChatToolCallTemplateDirective } from './chat-tool-call-template.directive';
import { summarizeGroup as defaultSummarizeGroup } from './group-summary';

interface Group {
  name: string;
  calls: ToolCall[];
  templateRef?: ChatToolCallTemplateDirective;
}

@Component({
  selector: 'chat-tool-calls',
  standalone: true,
  imports: [NgTemplateOutlet, ChatToolCallCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host { display: block; margin-bottom: 20px; }
    .ctc__group {
      border: 1px solid var(--ngaf-chat-separator);
      border-radius: var(--ngaf-chat-radius-card);
      margin: 0 0 4px;
    }
    .ctc__group-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      width: 100%;
      padding: 8px 12px;
      background: transparent;
      border: 0;
      font: inherit;
      color: var(--ngaf-chat-text);
      cursor: pointer;
      text-align: left;
    }
    .ctc__group-chevron {
      width: 10px; height: 10px;
      transition: transform 120ms ease;
    }
    .ctc__group[data-expanded="true"] .ctc__group-chevron { transform: rotate(90deg); }
    .ctc__group-body {
      padding: 0 12px 8px;
      border-top: 1px solid var(--ngaf-chat-separator);
    }
  `],
  template: `
    @for (group of groups(); track $index) {
      @if (group.calls.length > 1 && !group.templateRef) {
        <!-- Default grouped strip -->
        @let expanded = expandedGroups().has($index);
        <div class="ctc__group" [attr.data-group]="true" [attr.data-expanded]="expanded">
          <button type="button" class="ctc__group-header" (click)="toggleGroup($index)">
            <svg class="ctc__group-chevron" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M4 2l4 4-4 4"/>
            </svg>
            <span>{{ summarize(group.name, group.calls.length) }}</span>
          </button>
          @if (expanded) {
            <div class="ctc__group-body">
              @for (tc of group.calls; track tc.id) {
                <chat-tool-call-card [toolCall]="toToolCallInfo(tc)" />
              }
            </div>
          }
        </div>
      } @else if (group.templateRef) {
        @for (tc of group.calls; track tc.id) {
          <ng-container
            [ngTemplateOutlet]="group.templateRef.templateRef"
            [ngTemplateOutletContext]="{ $implicit: tc, status: tc.status }"
          />
        }
      } @else {
        @for (tc of group.calls; track tc.id) {
          <chat-tool-call-card [toolCall]="toToolCallInfo(tc)" />
        }
      }
    }
  `,
})
export class ChatToolCallsComponent {
  readonly agent = input.required<Agent>();
  readonly message = input<Message | undefined>(undefined);
  readonly grouping = input<'auto' | 'none'>('auto');
  readonly groupSummary = input<((name: string, count: number) => string) | undefined>(undefined);

  /**
   * Tool names whose groups should be hidden. Used by chat compositions
   * to filter out internal/orchestration tools (e.g. GenUI dispatchers)
   * whose args streaming is not meaningful to surface in the chat.
   * Default empty — preserves prior behavior for non-filtering consumers.
   */
  readonly excludeToolNames = input<readonly string[]>([]);

  /** Per-tool-name + wildcard templates registered as content children. */
  readonly templates = contentChildren(ChatToolCallTemplateDirective);

  private readonly templateRegistry = computed(() => {
    const map = new Map<string, ChatToolCallTemplateDirective>();
    for (const t of this.templates()) {
      map.set(t.name(), t);
    }
    return map;
  });

  readonly toolCalls = computed((): ToolCall[] => {
    const msg = this.message();
    if (msg && msg.role === 'assistant') {
      const all = this.agent().toolCalls();
      // Prefer adapter-provided `toolCallIds` (LangGraph populates it from
      // raw `tool_calls`). This is the per-message scope that prevents
      // every AI bubble from re-rendering the entire thread's tool-call
      // list when content is a flat string (the LangGraph adapter's
      // default — extractTextContent reduces complex content to string).
      if (msg.toolCallIds && msg.toolCallIds.length > 0) {
        return msg.toolCallIds.map(id => all.find(tc => tc.id === id)).filter((x): x is ToolCall => !!x);
      }
      // Anthropic-style content-block path: extract tool_use IDs inline.
      if (Array.isArray(msg.content)) {
        const blocks = msg.content.filter((b) => b.type === 'tool_use');
        return blocks.map(b => all.find(tc => tc.id === b.id)).filter((x): x is ToolCall => !!x);
      }
      // Assistant message provided but no tool-call linkage available:
      // this message didn't emit any tool calls. Return empty.
      return [];
    }
    // No message context at all (e.g. agent-level pinning) → global list.
    return this.agent().toolCalls();
  });

  readonly groups = computed((): Group[] => {
    const excludeSet = new Set(this.excludeToolNames());
    const calls = this.toolCalls().filter(tc => !excludeSet.has(tc.name));
    const groupingMode = this.grouping();
    const registry = this.templateRegistry();
    const wildcard = registry.get('*');
    const out: Group[] = [];
    for (const tc of calls) {
      const tpl = registry.get(tc.name) ?? wildcard;
      const last = out[out.length - 1];
      const sameName = last && last.name === tc.name;
      const canGroup = groupingMode === 'auto' && sameName;
      if (canGroup) {
        last.calls.push(tc);
        if (!last.templateRef && tpl) last.templateRef = tpl;
      } else {
        out.push({ name: tc.name, calls: [tc], templateRef: tpl });
      }
    }
    return out;
  });

  private readonly _expandedGroups = signal(new Set<number>());
  readonly expandedGroups = this._expandedGroups.asReadonly();

  toggleGroup(index: number): void {
    this._expandedGroups.update((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index); else next.add(index);
      return next;
    });
  }

  protected summarize(name: string, count: number): string {
    return (this.groupSummary() ?? defaultSummarizeGroup)(name, count);
  }

  protected toToolCallInfo(tc: ToolCall): ToolCallInfo {
    return { id: tc.id, name: tc.name, args: tc.args, result: tc.result, status: tc.status };
  }
}
