// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// TODO(phase-3): migrate from AgentRef to ChatAgent contract.
import {
  Component,
  computed,
  input,
  output,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import type { AgentRef, ThreadState } from '@cacheplane/langgraph';

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
        @for (state of history(); track $index; let i = $index) {
          <div
            class="flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors"
            [class]="i === selectedIndex() ? 'border-[var(--chat-input-focus-border)] bg-[var(--chat-bg-hover)]' : 'border-[var(--chat-border)] bg-[var(--chat-bg)] hover:bg-[var(--chat-bg-hover)]'"
          >
            <!-- Checkpoint indicator -->
            <span
              class="w-5 h-5 flex items-center justify-center rounded-full text-xs font-bold"
              [class]="i === selectedIndex() ? 'bg-[var(--chat-send-bg)] text-[var(--chat-send-text)]' : 'bg-[var(--chat-bg-alt)] text-[var(--chat-text-muted)]'"
            >
              {{ i + 1 }}
            </span>

            <!-- Checkpoint info -->
            <div class="flex-1 min-w-0">
              <p class="text-xs font-medium text-[var(--chat-text)] truncate">
                {{ checkpointLabel(state, i) }}
              </p>
              @if (state.checkpoint?.checkpoint_id) {
                <p class="text-xs text-[var(--chat-text-muted)] font-mono truncate">{{ state.checkpoint?.checkpoint_id }}</p>
              }
            </div>

            <!-- Action buttons -->
            <div class="flex gap-1 shrink-0">
              <button
                class="px-2 py-1 text-xs rounded bg-[var(--chat-bg-alt)] text-[var(--chat-text)] hover:bg-[var(--chat-bg-hover)] transition-colors"
                title="Replay from this checkpoint"
                (click)="replay(state)"
              >
                Replay
              </button>
              <button
                class="px-2 py-1 text-xs rounded bg-[var(--chat-bg-alt)] text-[var(--chat-text)] hover:bg-[var(--chat-bg-hover)] transition-colors"
                title="Fork from this checkpoint"
                (click)="fork(state, i)"
              >
                Fork
              </button>
            </div>
          </div>
        }
      </div>
    </div>
  `,
})
export class ChatTimelineSliderComponent {
  readonly ref = input.required<AgentRef<any, any>>();

  readonly selectedIndex = signal<number>(-1);

  readonly history = computed((): ThreadState<any>[] => this.ref().history());

  /** Emits the checkpoint_id when the user requests replay from that checkpoint. */
  readonly replayRequested = output<string>();
  /** Emits the checkpoint_id when the user requests a fork from that checkpoint. */
  readonly forkRequested = output<string>();

  checkpointLabel(state: ThreadState<any>, index: number): string {
    if (state.checkpoint?.checkpoint_id) {
      return `Checkpoint ${index + 1}`;
    }
    return `State ${index + 1}`;
  }

  replay(state: ThreadState<any>): void {
    if (state.checkpoint?.checkpoint_id) {
      this.replayRequested.emit(state.checkpoint.checkpoint_id);
    }
  }

  fork(state: ThreadState<any>, index: number): void {
    this.selectedIndex.set(index);
    if (state.checkpoint?.checkpoint_id) {
      this.forkRequested.emit(state.checkpoint.checkpoint_id);
    }
  }
}
