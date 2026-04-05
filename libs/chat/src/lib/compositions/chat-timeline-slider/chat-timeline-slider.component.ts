// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  Component,
  computed,
  input,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import type { StreamResourceRef, ThreadState } from '@cacheplane/stream-resource';

@Component({
  selector: 'chat-timeline-slider',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-2">
      <div class="flex items-center justify-between px-1">
        <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Timeline</h3>
        <span class="text-xs text-gray-400">{{ history().length }} checkpoint(s)</span>
      </div>

      @if (history().length === 0) {
        <p class="text-xs text-gray-400 text-center py-4">No checkpoints yet.</p>
      }

      <div class="space-y-1">
        @for (state of history(); track $index; let i = $index) {
          <div
            class="flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors {{ i === selectedIndex() ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white hover:bg-gray-50' }}"
          >
            <!-- Checkpoint indicator -->
            <span class="w-5 h-5 flex items-center justify-center rounded-full text-xs font-bold {{ i === selectedIndex() ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500' }}">
              {{ i + 1 }}
            </span>

            <!-- Checkpoint info -->
            <div class="flex-1 min-w-0">
              <p class="text-xs font-medium text-gray-700 truncate">
                {{ checkpointLabel(state, i) }}
              </p>
              @if (state.checkpoint_id) {
                <p class="text-xs text-gray-400 font-mono truncate">{{ state.checkpoint_id }}</p>
              }
            </div>

            <!-- Action buttons -->
            <div class="flex gap-1 shrink-0">
              <button
                class="px-2 py-1 text-xs rounded bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
                title="Replay from this checkpoint"
                (click)="replay(state)"
              >
                Replay
              </button>
              <button
                class="px-2 py-1 text-xs rounded bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors"
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
  readonly ref = input.required<StreamResourceRef<any, any>>();

  readonly selectedIndex = signal<number>(-1);

  readonly history = computed((): ThreadState<any>[] => this.ref().history());

  checkpointLabel(state: ThreadState<any>, index: number): string {
    if (state.checkpoint_id) {
      return `Checkpoint ${index + 1}`;
    }
    return `State ${index + 1}`;
  }

  replay(state: ThreadState<any>): void {
    if (state.checkpoint_id) {
      this.ref().setBranch(state.checkpoint_id);
    }
  }

  fork(state: ThreadState<any>, index: number): void {
    this.selectedIndex.set(index);
    if (state.checkpoint_id) {
      this.ref().setBranch(state.checkpoint_id);
    }
  }
}
