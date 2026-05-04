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
  /** Optional — present when the parent provides it. Drives the pill + default-collapsed logic. */
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
    .tcc__pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 1px 7px;
      border-radius: 9999px;
      background: var(--ngaf-chat-surface-alt);
      color: var(--ngaf-chat-text-muted);
      font-size: 11px;
      font-weight: 600;
      margin-left: 6px;
      line-height: 1.4;
    }
    .tcc__pill[data-status="complete"] { color: var(--ngaf-chat-success); }
    .tcc__pill[data-status="error"]    { color: var(--ngaf-chat-error-text); }
    .tcc__pill svg { width: 11px; height: 11px; }
    .tcc__pill[data-status="running"] svg { animation: tcc-spin 0.8s linear infinite; }
    @keyframes tcc-spin { to { transform: rotate(360deg); } }
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
    <chat-trace [state]="state()" [defaultExpanded]="autoExpanded()">
      <span traceLabel>
        <span class="tcc__name">{{ toolCall().name }}</span>
        <span class="tcc__pill" [attr.data-status]="status()" [attr.aria-label]="ariaLabel()">
          @switch (status()) {
            @case ('running') {
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M8 2 a6 6 0 0 1 6 6" stroke-linecap="round"/>
              </svg>
            }
            @case ('complete') {
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="m3 8 4 4 6-8"/>
              </svg>
            }
            @case ('error') {
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true">
                <path d="M8 4v5"/>
                <circle cx="8" cy="12" r="0.5" fill="currentColor"/>
              </svg>
            }
          }
        </span>
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
  readonly defaultCollapsed = input<boolean>(true);

  readonly status = computed<ToolCallStatus>(() => {
    const tc = this.toolCall();
    if (tc.status) return tc.status;
    return tc.result !== undefined ? 'complete' : 'running';
  });

  readonly state = computed<TraceState>(() => {
    switch (this.status()) {
      case 'complete': return 'done';
      case 'error':    return 'error';
      case 'running':  return 'running';
      default:         return 'pending';
    }
  });

  readonly autoExpanded = computed<boolean>(() => {
    const s = this.status();
    if (s === 'running' || s === 'error') return true;
    return !this.defaultCollapsed();
  });

  readonly ariaLabel = computed<string>(() => {
    switch (this.status()) {
      case 'running':  return 'Running';
      case 'complete': return 'Completed';
      case 'error':    return 'Failed';
      default:         return '';
    }
  });

  formatJson(value: unknown): string {
    if (typeof value === 'string') return value;
    try { return JSON.stringify(value, null, 2); } catch { return String(value); }
  }
}
