// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  Component,
  input,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';

export interface ToolCallInfo {
  id: string;
  name: string;
  args: unknown;
  result?: unknown;
}

@Component({
  selector: 'chat-tool-call-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div style="border: 1px solid var(--chat-border); background: var(--chat-bg-alt); border-radius: var(--chat-radius-card); overflow: hidden;">
      <!-- Card header (always visible, click to toggle) -->
      <button
        style="width: 100%; display: flex; align-items: center; justify-content: space-between; padding: 8px 16px; font-size: 14px; font-weight: 500; color: var(--chat-text); background: none; border: none; cursor: pointer; text-align: left; transition: background 0.15s;"
        (click)="expanded.set(!expanded())"
        [attr.aria-expanded]="expanded()"
      >
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="color: var(--chat-text-muted);">⚙</span>
          <span style="font-family: monospace; color: var(--chat-text);">{{ toolCall().name }}</span>
          @if (toolCall().result !== undefined) {
            <span style="font-size: 12px; color: var(--chat-success); font-weight: 400;">✓ done</span>
          }
        </div>
        <span style="color: var(--chat-text-muted); font-size: 12px;">{{ expanded() ? '▲' : '▼' }}</span>
      </button>

      <!-- Expanded content: inputs and outputs -->
      @if (expanded()) {
        <div style="border-top: 1px solid var(--chat-border);">
          <div style="padding: 12px 16px;">
            <p style="font-size: 11px; font-weight: 600; color: var(--chat-text-muted); text-transform: uppercase; letter-spacing: 0.08em; margin: 0 0 4px;">Inputs</p>
            <pre style="font-size: 12px; color: var(--chat-text); overflow-x: auto; white-space: pre-wrap; margin: 0;">{{ formatJson(toolCall().args) }}</pre>
          </div>
          @if (toolCall().result !== undefined) {
            <div style="padding: 12px 16px; border-top: 1px solid var(--chat-border);">
              <p style="font-size: 11px; font-weight: 600; color: var(--chat-text-muted); text-transform: uppercase; letter-spacing: 0.08em; margin: 0 0 4px;">Output</p>
              <pre style="font-size: 12px; color: var(--chat-text); overflow-x: auto; white-space: pre-wrap; margin: 0;">{{ formatJson(toolCall().result) }}</pre>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class ChatToolCallCardComponent {
  readonly toolCall = input.required<ToolCallInfo>();

  readonly expanded = signal(false);

  formatJson(value: unknown): string {
    if (typeof value === 'string') return value;
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
}
