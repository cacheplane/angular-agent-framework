// SPDX-License-Identifier: MIT
import {
  Component,
  computed,
  input,
  ChangeDetectionStrategy,
} from '@angular/core';
import { JsonPipe } from '@angular/common';
import { computeStateDiff } from './state-diff';
import type { DiffEntry } from './state-diff';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';

@Component({
  selector: 'chat-debug-state-diff',
  standalone: true,
  imports: [JsonPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    CHAT_HOST_TOKENS,
    `
    .debug-state-diff__empty {
      font-size: var(--ngaf-chat-font-size-xs);
      color: var(--ngaf-chat-text-muted);
      font-style: italic;
      margin: 0;
    }
    .debug-state-diff__list {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .debug-state-diff__entry {
      font-size: var(--ngaf-chat-font-size-xs);
      font-family: var(--ngaf-chat-font-mono);
      padding: 4px 8px;
      border-radius: 4px;
    }
    .debug-state-diff__entry--added {
      background: var(--ngaf-chat-surface-alt);
      color: var(--ngaf-chat-success);
    }
    .debug-state-diff__entry--removed {
      background: var(--ngaf-chat-error-bg);
      color: var(--ngaf-chat-error-text);
    }
    .debug-state-diff__entry--changed {
      background: var(--ngaf-chat-warning-bg);
      color: var(--ngaf-chat-warning-text);
    }
    .debug-state-diff__key { font-weight: 600; }
    .debug-state-diff__value {
      display: block;
      padding-left: 16px;
      color: var(--ngaf-chat-text-muted);
    }
    `,
  ],
  template: `
    @if (diffEntries().length === 0) {
      <p class="debug-state-diff__empty">No changes</p>
    } @else {
      <div class="debug-state-diff__list">
        @for (entry of diffEntries(); track entry.path) {
          <div class="debug-state-diff__entry" [class]="entryClass(entry.type)">
            <span class="debug-state-diff__key">{{ prefix(entry.type) }} {{ entry.path }}</span>
            @if (entry.type === 'changed') {
              <span class="debug-state-diff__value">{{ entry.before | json }} &rarr; {{ entry.after | json }}</span>
            } @else if (entry.type === 'added') {
              <span class="debug-state-diff__value">{{ entry.after | json }}</span>
            } @else {
              <span class="debug-state-diff__value">{{ entry.before | json }}</span>
            }
          </div>
        }
      </div>
    }
  `,
})
export class DebugStateDiffComponent {
  readonly before = input<Record<string, unknown>>({});
  readonly after = input<Record<string, unknown>>({});

  readonly diffEntries = computed((): DiffEntry[] =>
    computeStateDiff(this.before(), this.after()),
  );

  prefix(type: DiffEntry['type']): string {
    switch (type) {
      case 'added': return '+';
      case 'removed': return '-';
      case 'changed': return '~';
    }
  }

  entryClass(type: DiffEntry['type']): string {
    switch (type) {
      case 'added': return 'debug-state-diff__entry--added';
      case 'removed': return 'debug-state-diff__entry--removed';
      case 'changed': return 'debug-state-diff__entry--changed';
    }
  }

  /** @deprecated Use entryClass instead — kept for backward compat if any template references it */
  colorClass(type: DiffEntry['type']): string {
    return this.entryClass(type);
  }
}
