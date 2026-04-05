// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  Component,
  input,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';
import { DebugCheckpointCardComponent } from './debug-checkpoint-card.component';
import type { DebugCheckpoint } from './debug-checkpoint-card.component';

@Component({
  selector: 'chat-debug-timeline',
  standalone: true,
  imports: [DebugCheckpointCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative space-y-1">
      <!-- Vertical rail -->
      <div class="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>

      @for (cp of checkpoints(); track $index; let i = $index) {
        <div class="relative pl-8">
          <!-- Rail dot -->
          <div
            class="absolute left-3 top-3 w-2.5 h-2.5 rounded-full border-2"
            [class]="i === selectedIndex() ? 'bg-blue-500 border-blue-500' : 'bg-white border-gray-300'"
          ></div>

          <chat-debug-checkpoint-card
            [checkpoint]="cp"
            [isSelected]="i === selectedIndex()"
            (selected)="checkpointSelected.emit(i)"
          />
        </div>
      }
    </div>
  `,
})
export class DebugTimelineComponent {
  readonly checkpoints = input<DebugCheckpoint[]>([]);
  readonly selectedIndex = input<number>(-1);
  readonly checkpointSelected = output<number>();
}
