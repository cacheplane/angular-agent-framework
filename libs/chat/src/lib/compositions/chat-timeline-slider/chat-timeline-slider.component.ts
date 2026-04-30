// SPDX-License-Identifier: MIT
import {
  Component, computed, input, output, signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import type { AgentWithHistory, AgentCheckpoint } from '../../agent';

@Component({
  selector: 'chat-timeline-slider',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-2">
      <div class="flex items-center justify-between px-1">
        <h3 class="text-xs font-semibold text-[var(--chat-text-muted)] uppercase tracking-wide">Timeline</h3>
        <span class="text-xs text-[var(--chat-text-muted)]">{{ history().length }} checkpoint(s)</span>
      </div>

      @if (history().length === 0) {
        <p class="text-xs text-[var(--chat-text-muted)] text-center py-4">No checkpoints yet.</p>
      }

      <div class="space-y-1">
        @for (cp of history(); track $index; let i = $index) {
          <div
            class="flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors"
            [class]="i === selectedIndex() ? 'border-[var(--chat-input-focus-border)] bg-[var(--chat-bg-hover)]' : 'border-[var(--chat-border)] bg-[var(--chat-bg)] hover:bg-[var(--chat-bg-hover)]'"
          >
            <span
              class="w-5 h-5 flex items-center justify-center rounded-full text-xs font-bold"
              [class]="i === selectedIndex() ? 'bg-[var(--chat-send-bg)] text-[var(--chat-send-text)]' : 'bg-[var(--chat-bg-alt)] text-[var(--chat-text-muted)]'"
            >
              {{ i + 1 }}
            </span>

            <div class="flex-1 min-w-0">
              <p class="text-xs font-medium text-[var(--chat-text)] truncate">
                {{ cp.label ?? 'Step ' + (i + 1) }}
              </p>
              @if (cp.id) {
                <p class="text-xs text-[var(--chat-text-muted)] font-mono truncate">{{ cp.id }}</p>
              }
            </div>

            <div class="flex gap-1 shrink-0">
              <button
                class="px-2 py-1 text-xs rounded bg-[var(--chat-bg-alt)] text-[var(--chat-text)] hover:bg-[var(--chat-bg-hover)] transition-colors"
                title="Replay from this checkpoint"
                (click)="replay(cp)"
              >Replay</button>
              <button
                class="px-2 py-1 text-xs rounded bg-[var(--chat-bg-alt)] text-[var(--chat-text)] hover:bg-[var(--chat-bg-hover)] transition-colors"
                title="Fork from this checkpoint"
                (click)="fork(cp, i)"
              >Fork</button>
            </div>
          </div>
        }
      </div>
    </div>
  `,
})
export class ChatTimelineSliderComponent {
  readonly agent = input.required<AgentWithHistory>();

  readonly selectedIndex = signal<number>(-1);

  readonly history = computed<AgentCheckpoint[]>(() => this.agent().history());

  readonly replayRequested = output<string>();
  readonly forkRequested = output<string>();

  replay(cp: AgentCheckpoint): void {
    if (cp.id) this.replayRequested.emit(cp.id);
  }

  fork(cp: AgentCheckpoint, index: number): void {
    this.selectedIndex.set(index);
    if (cp.id) this.forkRequested.emit(cp.id);
  }
}
