// libs/chat/src/lib/compositions/chat-tool-call-card/chat-tool-call-card.component.ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { ChatTraceComponent, type TraceState } from '../../primitives/chat-trace/chat-trace.component';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';
import type { ToolCallStatus } from '../../agent';

export interface ToolCallInfo {
  id: string;
  name: string;
  args: unknown;
  result?: unknown;
  /** Optional — present when the parent provides it. Will drive the pill + default-collapsed logic in Phase 5. */
  status?: ToolCallStatus;
}

@Component({
  selector: 'chat-tool-call-card',
  standalone: true,
  imports: [ChatTraceComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [CHAT_HOST_TOKENS, `
    :host { display: block; }
    .tcc__name { font-family: var(--ngaf-chat-font-mono); color: var(--ngaf-chat-text); }
    .tcc__status { font-size: var(--ngaf-chat-font-size-xs); margin-left: 4px; }
    .tcc__status[data-state="done"] { color: var(--ngaf-chat-success); }
    .tcc__status[data-state="error"] { color: var(--ngaf-chat-error-text); }
    .tcc__section { padding: 8px 0; }
    .tcc__section + .tcc__section { border-top: 1px solid var(--ngaf-chat-separator); }
    .tcc__section-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--ngaf-chat-text-muted);
      margin: 0 0 4px;
    }
    .tcc__section-body {
      font-family: var(--ngaf-chat-font-mono);
      font-size: var(--ngaf-chat-font-size-xs);
      color: var(--ngaf-chat-text);
      white-space: pre-wrap;
      overflow-x: auto;
      margin: 0;
    }
  `],
  template: `
    <chat-trace [state]="state()">
      <span traceLabel>
        <span class="tcc__name">{{ toolCall().name }}</span>
        @switch (state()) {
          @case ('done') { <span class="tcc__status" data-state="done">done</span> }
          @case ('error') { <span class="tcc__status" data-state="error">error</span> }
          @case ('running') { <span class="tcc__status">running…</span> }
        }
      </span>
      <div class="tcc__section">
        <p class="tcc__section-label">Inputs</p>
        <pre class="tcc__section-body">{{ formatJson(toolCall().args) }}</pre>
      </div>
      @if (toolCall().result !== undefined) {
        <div class="tcc__section">
          <p class="tcc__section-label">Output</p>
          <pre class="tcc__section-body">{{ formatJson(toolCall().result) }}</pre>
        </div>
      }
    </chat-trace>
  `,
})
export class ChatToolCallCardComponent {
  readonly toolCall = input.required<ToolCallInfo>();

  readonly state = computed<TraceState>(() => {
    const tc = this.toolCall();
    if (tc.result !== undefined) return 'done';
    return 'running';
  });

  formatJson(value: unknown): string {
    if (typeof value === 'string') return value;
    try { return JSON.stringify(value, null, 2); } catch { return String(value); }
  }
}
