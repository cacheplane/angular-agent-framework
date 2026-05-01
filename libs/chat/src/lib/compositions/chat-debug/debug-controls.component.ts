// SPDX-License-Identifier: MIT
import {
  Component,
  input,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';

@Component({
  selector: 'chat-debug-controls',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    CHAT_HOST_TOKENS,
    `
    .debug-controls {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .debug-controls__btn {
      padding: 4px 8px;
      font-size: var(--ngaf-chat-font-size-xs);
      border-radius: 4px;
      border: 1px solid var(--ngaf-chat-separator);
      background: var(--ngaf-chat-surface-alt);
      color: var(--ngaf-chat-text);
      cursor: pointer;
      transition: background 150ms ease;
    }
    .debug-controls__btn:hover:not(:disabled) {
      background: color-mix(in srgb, var(--ngaf-chat-text) 5%, transparent);
    }
    .debug-controls__btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    `,
  ],
  template: `
    <div class="debug-controls">
      <button
        class="debug-controls__btn"
        [disabled]="selectedIndex() <= 0"
        title="Jump to start"
        (click)="jumpToStart.emit()"
      >|&lt;</button>
      <button
        class="debug-controls__btn"
        [disabled]="selectedIndex() <= 0"
        title="Step back"
        (click)="stepBack.emit()"
      >&lt;</button>
      <button
        class="debug-controls__btn"
        [disabled]="selectedIndex() >= checkpointCount() - 1"
        title="Step forward"
        (click)="stepForward.emit()"
      >&gt;</button>
      <button
        class="debug-controls__btn"
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
