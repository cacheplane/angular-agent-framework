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
    case 'pending':  return 'background: var(--ngaf-chat-surface-alt); color: var(--ngaf-chat-text-muted);';
    case 'running':  return 'background: var(--ngaf-chat-warning-bg); color: var(--ngaf-chat-warning-text);';
    case 'complete': return 'color: var(--ngaf-chat-success);';
    case 'error':    return 'background: var(--ngaf-chat-error-bg); color: var(--ngaf-chat-error-text);';
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
    .sac__name { color: var(--ngaf-chat-text); font-weight: 500; font-size: var(--ngaf-chat-font-size-sm); }
    .sac__id { font-family: var(--ngaf-chat-font-mono); font-size: var(--ngaf-chat-font-size-xs); color: var(--ngaf-chat-text-muted); margin-left: 4px; }
    .sac__pill {
      padding: 1px 8px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 500;
      margin-left: 4px;
    }
    .sac__pill[data-status="pending"] { background: var(--ngaf-chat-surface-alt); color: var(--ngaf-chat-text-muted); }
    .sac__pill[data-status="running"] { background: var(--ngaf-chat-warning-bg); color: var(--ngaf-chat-warning-text); }
    .sac__pill[data-status="complete"] { color: var(--ngaf-chat-success); }
    .sac__pill[data-status="error"] { background: var(--ngaf-chat-error-bg); color: var(--ngaf-chat-error-text); }
    .sac__count { font-size: var(--ngaf-chat-font-size-xs); color: var(--ngaf-chat-text-muted); }
    .sac__msg { padding: 6px 0; }
    .sac__msg + .sac__msg { border-top: 1px solid var(--ngaf-chat-separator); }
    .sac__reasoning {
      font-size: var(--ngaf-chat-font-size-xs);
      color: var(--ngaf-chat-text-muted);
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
      <div class="sac__count">{{ subagent().messages().length }} message(s)</div>
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
