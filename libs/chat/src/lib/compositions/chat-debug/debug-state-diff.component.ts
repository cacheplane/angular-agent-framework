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

@Component({
  selector: 'chat-debug-state-diff',
  standalone: true,
  imports: [JsonPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (diffEntries().length === 0) {
      <p class="text-xs text-[var(--chat-text-muted)] italic">No changes</p>
    } @else {
      <div class="space-y-1">
        @for (entry of diffEntries(); track entry.path) {
          <div
            class="text-xs font-mono px-2 py-1 rounded"
            [class]="colorClass(entry.type)"
          >
            <span class="font-semibold">{{ prefix(entry.type) }} {{ entry.path }}</span>
            @if (entry.type === 'changed') {
              <span class="block pl-4 text-[var(--chat-text-muted)]">{{ entry.before | json }} &rarr; {{ entry.after | json }}</span>
            } @else if (entry.type === 'added') {
              <span class="block pl-4">{{ entry.after | json }}</span>
            } @else {
              <span class="block pl-4">{{ entry.before | json }}</span>
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

  colorClass(type: DiffEntry['type']): string {
    switch (type) {
      case 'added': return 'bg-[var(--chat-bg-alt)] text-[var(--chat-success)]';
      case 'removed': return 'bg-[var(--chat-error-bg)] text-[var(--chat-error-text)]';
      case 'changed': return 'bg-[var(--chat-warning-bg)] text-[var(--chat-warning-text)]';
    }
  }
}
