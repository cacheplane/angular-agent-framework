// libs/chat/src/lib/compositions/chat-subagent-card/chat-subagent-card.component.ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { ChatTraceComponent, type TraceState } from '../../primitives/chat-trace/chat-trace.component';
import { ChatToolCallCardComponent, type ToolCallInfo } from '../chat-tool-call-card/chat-tool-call-card.component';
import { ChatStreamingMdComponent } from '../../streaming/streaming-markdown.component';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';
import type { Subagent, SubagentStatus } from '../../agent/subagent';
import type { Message, ToolCall } from '../../agent';

/**
 * Returns a CSS style string for a subagent's status badge.
 * Kept exported for backward compatibility with existing consumers; the
 * preferred way to style status visually is via the `data-status` attribute
 * + CSS selectors (see component styles below).
 */
export function statusColor(status: SubagentStatus): string {
  switch (status) {
    case 'pending':  return 'background: var(--tplane-chat-surface-alt); color: var(--tplane-chat-text-muted);';
    case 'running':  return 'background: var(--tplane-chat-warning-bg); color: var(--tplane-chat-warning-text);';
    case 'complete': return 'color: var(--tplane-chat-success);';
    case 'error':    return 'background: var(--tplane-chat-error-bg); color: var(--tplane-chat-error-text);';
  }
}

function statusToTraceState(s: SubagentStatus): TraceState {
  switch (s) {
    case 'pending':  return 'pending';
    case 'running':  return 'running';
    case 'complete': return 'done';
    case 'error':    return 'error';
  }
}

@Component({
  selector: 'chat-subagent-card',
  standalone: true,
  imports: [ChatTraceComponent, ChatToolCallCardComponent, ChatStreamingMdComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [CHAT_HOST_TOKENS, `
    :host { display: block; }
    .sac__name { color: var(--tplane-chat-text); font-weight: 500; font-size: var(--tplane-chat-font-size-sm); }
    .sac__id { font-family: var(--tplane-chat-font-mono); font-size: var(--tplane-chat-font-size-xs); color: var(--tplane-chat-text-muted); margin-left: 4px; }
    .sac__pill {
      padding: 1px 8px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 500;
      margin-left: 4px;
    }
    .sac__pill[data-status="pending"] { background: var(--tplane-chat-surface-alt); color: var(--tplane-chat-text-muted); }
    .sac__pill[data-status="running"] { background: var(--tplane-chat-warning-bg); color: var(--tplane-chat-warning-text); }
    .sac__pill[data-status="complete"] { color: var(--tplane-chat-success); }
    .sac__pill[data-status="error"] { background: var(--tplane-chat-error-bg); color: var(--tplane-chat-error-text); }
    .sac__count { font-size: var(--tplane-chat-font-size-xs); color: var(--tplane-chat-text-muted); }
    .sac__msg { padding: 6px 0; }
    .sac__msg + .sac__msg { border-top: 1px solid var(--tplane-chat-separator); }
    .sac__reasoning {
      font-size: var(--tplane-chat-font-size-xs);
      color: var(--tplane-chat-text-muted);
      font-style: italic;
      margin-bottom: 4px;
    }
  `],
  template: `
    <chat-trace [state]="state()">
      <span traceLabel>
        <span class="sac__name">{{ subagent().name ?? 'Subagent' }}</span>
        <span class="sac__id">{{ subagent().toolCallId }}</span>
        <span class="sac__pill" [attr.data-status]="subagent().status()">{{ subagent().status() }}</span>
      </span>
      <div class="sac__count" traceMeta>{{ subagent().messages().length }} message(s)</div>
      @for (m of subagent().messages(); track m.id) {
        <div class="sac__msg" [attr.data-role]="m.role">
          @if (m.reasoning) {
            <div class="sac__reasoning">{{ m.reasoning }}</div>
          }
          @if (textOf(m); as t) {
            <chat-streaming-md [content]="t" />
          }
          @for (tc of toolCallsFor(m); track tc.id) {
            <chat-tool-call-card [toolCall]="toToolCallInfo(tc)" />
          }
        </div>
      }
    </chat-trace>
  `,
})
export class ChatSubagentCardComponent {
  readonly subagent = input.required<Subagent>();
  readonly state = computed<TraceState>(() => statusToTraceState(this.subagent().status()));

  protected textOf(m: Message): string {
    const c = m.content;
    return typeof c === 'string' ? c : '';
  }

  protected toolCallsFor(m: Message): ToolCall[] {
    const ids = m.toolCallIds ?? [];
    if (ids.length === 0) return [];
    const all = this.subagent().toolCalls?.() ?? [];
    return ids.map((id) => all.find((tc) => tc.id === id)).filter((tc): tc is ToolCall => !!tc);
  }

  protected toToolCallInfo(tc: ToolCall): ToolCallInfo {
    return { id: tc.id, name: tc.name, args: tc.args, result: tc.result, status: tc.status };
  }
}
