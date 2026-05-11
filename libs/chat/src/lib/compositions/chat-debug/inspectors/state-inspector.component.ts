// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input, computed, signal } from '@angular/core';
import type { AgentWithHistory } from '../../../agent';
import { CHAT_HOST_TOKENS } from '../../../styles/chat-tokens';
import { DebugStateInspectorComponent } from '../debug-state-inspector.component';
import { extractStateValues } from '../debug-utils';

@Component({
  selector: 'chat-debug-state-tab',
  standalone: true,
  imports: [DebugStateInspectorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    CHAT_HOST_TOKENS,
    `
    :host { display: flex; flex-direction: column; height: 100%; }
    .state__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px var(--ngaf-chat-space-4);
      border-bottom: 1px solid var(--ngaf-chat-separator);
      background: color-mix(in srgb, var(--ngaf-chat-surface-alt) 40%, var(--ngaf-chat-bg));
      font-size: var(--ngaf-chat-font-size-xs);
      font-weight: 500;
      color: var(--ngaf-chat-text-muted);
    }
    .state__copy {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: var(--ngaf-chat-bg);
      border: 1px solid var(--ngaf-chat-separator);
      border-radius: var(--ngaf-chat-radius-button);
      padding: 3px var(--ngaf-chat-space-2);
      font: inherit;
      font-size: var(--ngaf-chat-font-size-xs);
      color: var(--ngaf-chat-text-muted);
      cursor: pointer;
      transition: color 120ms ease, border-color 120ms ease;
    }
    .state__copy:hover {
      color: var(--ngaf-chat-text);
      border-color: var(--ngaf-chat-text-muted);
    }
    .state__copy.is-copied { color: var(--ngaf-chat-success); border-color: var(--ngaf-chat-success); }
    .state__copy svg { display: block; }
    .state__body {
      flex: 1;
      overflow-y: auto;
      padding: var(--ngaf-chat-space-3) var(--ngaf-chat-space-4);
    }
    `,
  ],
  template: `
    <div class="state__header">
      <span>Current state</span>
      <button type="button" class="state__copy" [class.is-copied]="justCopied()" (click)="copy()">
        @if (justCopied()) {
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 6L5 8.5L9.5 3.5"/></svg>
          <span>Copied</span>
        } @else {
          <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="8" height="8" rx="1.2"/><path d="M2 9V2.5C2 2.22 2.22 2 2.5 2H9"/></svg>
          <span>Copy</span>
        }
      </button>
    </div>
    <div class="state__body">
      <chat-debug-state-inspector [state]="state()" />
    </div>
  `,
})
export class StateInspectorComponent {
  readonly agent = input.required<AgentWithHistory>();

  readonly state = computed((): Record<string, unknown> => {
    const history = this.agent().history();
    const last = history[history.length - 1];
    return extractStateValues(last);
  });

  protected readonly justCopied = signal<boolean>(false);

  copy(): void {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    void navigator.clipboard.writeText(JSON.stringify(this.state(), null, 2));
    this.justCopied.set(true);
    setTimeout(() => this.justCopied.set(false), 1500);
  }
}
