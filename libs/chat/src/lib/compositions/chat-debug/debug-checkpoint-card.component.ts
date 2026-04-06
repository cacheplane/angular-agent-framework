// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  Component,
  input,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';

export interface DebugCheckpoint {
  node?: string;
  duration?: number;
  tokenCount?: number;
  checkpointId?: string;
}

@Component({
  selector: 'chat-debug-checkpoint-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      class="w-full text-left rounded-lg border px-3 py-2 transition-colors"
      [class]="isSelected() ? 'border-[var(--chat-input-focus-border)] bg-[var(--chat-bg-hover)]' : 'border-[var(--chat-border)] bg-[var(--chat-bg)] hover:bg-[var(--chat-bg-hover)]'"
      (click)="selected.emit()"
    >
      <p class="text-xs font-medium text-[var(--chat-text)] truncate">
        {{ checkpoint().node ?? 'Unknown' }}
      </p>
      <div class="flex gap-2 mt-1">
        @if (checkpoint().duration !== null && checkpoint().duration !== undefined) {
          <span class="text-xs px-1.5 py-0.5 rounded bg-[var(--chat-bg-alt)] text-[var(--chat-text-muted)]">
            {{ checkpoint().duration }}ms
          </span>
        }
        @if (checkpoint().tokenCount !== null && checkpoint().tokenCount !== undefined) {
          <span class="text-xs px-1.5 py-0.5 rounded bg-[var(--chat-bg-alt)] text-[var(--chat-text-muted)]">
            {{ checkpoint().tokenCount }} tok
          </span>
        }
      </div>
    </button>
  `,
})
export class DebugCheckpointCardComponent {
  readonly checkpoint = input.required<DebugCheckpoint>();
  readonly isSelected = input<boolean>(false);
  readonly selected = output<void>();
}
