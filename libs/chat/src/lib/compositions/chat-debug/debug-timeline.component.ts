// SPDX-License-Identifier: MIT
import {
  Component,
  input,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';
import { DebugCheckpointCardComponent } from './debug-checkpoint-card.component';
import type { DebugCheckpoint } from './debug-checkpoint-card.component';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';

@Component({
  selector: 'chat-debug-timeline',
  standalone: true,
  imports: [DebugCheckpointCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    CHAT_HOST_TOKENS,
    `
    .debug-timeline {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .debug-timeline__rail {
      position: absolute;
      left: 16px;
      top: 0;
      bottom: 0;
      width: 2px;
      background: var(--ngaf-chat-separator);
    }
    .debug-timeline__item {
      position: relative;
      padding-left: 32px;
    }
    .debug-timeline__dot {
      position: absolute;
      left: 12px;
      top: 12px;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      border: 2px solid var(--ngaf-chat-separator);
      background: var(--ngaf-chat-bg);
    }
    .debug-timeline__dot--selected {
      background: var(--ngaf-chat-primary);
      border-color: var(--ngaf-chat-text-muted);
    }
    `,
  ],
  template: `
    <div class="debug-timeline">
      <!-- Vertical rail -->
      <div class="debug-timeline__rail"></div>

      @for (cp of checkpoints(); track $index; let i = $index) {
        <div class="debug-timeline__item">
          <!-- Rail dot -->
          <div
            class="debug-timeline__dot"
            [class.debug-timeline__dot--selected]="i === selectedIndex()"
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
