// SPDX-License-Identifier: MIT
import {
  Component,
  input,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';

@Component({
  selector: 'chat-debug-controls',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-center gap-1">
      <button
        class="px-2 py-1 text-xs rounded bg-[var(--chat-bg-alt)] hover:bg-[var(--chat-bg-hover)] transition-colors disabled:opacity-40"
        [disabled]="selectedIndex() <= 0"
        title="Jump to start"
        (click)="jumpToStart.emit()"
      >|&lt;</button>
      <button
        class="px-2 py-1 text-xs rounded bg-[var(--chat-bg-alt)] hover:bg-[var(--chat-bg-hover)] transition-colors disabled:opacity-40"
        [disabled]="selectedIndex() <= 0"
        title="Step back"
        (click)="stepBack.emit()"
      >&lt;</button>
      <button
        class="px-2 py-1 text-xs rounded bg-[var(--chat-bg-alt)] hover:bg-[var(--chat-bg-hover)] transition-colors disabled:opacity-40"
        [disabled]="selectedIndex() >= checkpointCount() - 1"
        title="Step forward"
        (click)="stepForward.emit()"
      >&gt;</button>
      <button
        class="px-2 py-1 text-xs rounded bg-[var(--chat-bg-alt)] hover:bg-[var(--chat-bg-hover)] transition-colors disabled:opacity-40"
        [disabled]="selectedIndex() >= checkpointCount() - 1"
        title="Jump to end"
        (click)="jumpToEnd.emit()"
      >&gt;|</button>
    </div>
  `,
})
export class DebugControlsComponent {
  readonly checkpointCount = input<number>(0);
  readonly selectedIndex = input<number>(-1);
  readonly stepForward = output<void>();
  readonly stepBack = output<void>();
  readonly jumpToStart = output<void>();
  readonly jumpToEnd = output<void>();
}
