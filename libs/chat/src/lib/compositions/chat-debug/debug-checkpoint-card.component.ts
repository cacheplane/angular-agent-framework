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
      [class]="isSelected() ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white hover:bg-gray-50'"
      (click)="selected.emit()"
    >
      <p class="text-xs font-medium text-gray-700 truncate">
        {{ checkpoint().node ?? 'Unknown' }}
      </p>
      <div class="flex gap-2 mt-1">
        @if (checkpoint().duration !== null && checkpoint().duration !== undefined) {
          <span class="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
            {{ checkpoint().duration }}ms
          </span>
        }
        @if (checkpoint().tokenCount !== null && checkpoint().tokenCount !== undefined) {
          <span class="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
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
