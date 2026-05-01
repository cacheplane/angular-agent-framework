// SPDX-License-Identifier: MIT
import {
  Component,
  computed,
  input,
  ChangeDetectionStrategy,
} from '@angular/core';
import type { DebugCheckpoint } from './debug-checkpoint-card.component';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';

@Component({
  selector: 'chat-debug-summary',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    CHAT_HOST_TOKENS,
    `
    .debug-summary {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: var(--ngaf-chat-font-size-xs);
      color: var(--ngaf-chat-text-muted);
    }
    `,
  ],
  template: `
    <div class="debug-summary">
      <span>{{ checkpoints().length }} step(s)</span>
      <span>{{ totalDuration() }}ms total</span>
    </div>
  `,
})
export class DebugSummaryComponent {
  readonly checkpoints = input<DebugCheckpoint[]>([]);

  readonly totalDuration = computed(() =>
    this.checkpoints().reduce((sum, cp) => sum + (cp.duration ?? 0), 0),
  );
}
