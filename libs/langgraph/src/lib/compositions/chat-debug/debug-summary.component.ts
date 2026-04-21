// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  Component,
  computed,
  input,
  ChangeDetectionStrategy,
} from '@angular/core';
import type { AgentRef } from '../../agent.types';
import type { DebugCheckpoint } from './debug-checkpoint-card.component';

@Component({
  selector: 'chat-debug-summary',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-center gap-3 text-xs text-[var(--chat-text-muted)]">
      <span>{{ checkpoints().length }} step(s)</span>
      <span>{{ totalDuration() }}ms total</span>
    </div>
  `,
})
export class DebugSummaryComponent {
  readonly ref = input.required<AgentRef<any, any>>();
  readonly checkpoints = input<DebugCheckpoint[]>([]);

  readonly totalDuration = computed(() =>
    this.checkpoints().reduce((sum, cp) => sum + (cp.duration ?? 0), 0),
  );
}
