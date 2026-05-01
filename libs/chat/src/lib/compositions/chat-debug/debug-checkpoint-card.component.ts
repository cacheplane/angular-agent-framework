// SPDX-License-Identifier: MIT
import {
  Component,
  input,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';

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
  styles: [
    CHAT_HOST_TOKENS,
    `
    .debug-checkpoint-card {
      width: 100%;
      text-align: left;
      border-radius: var(--ngaf-chat-radius-card);
      border: 1px solid var(--ngaf-chat-separator);
      padding: 8px 12px;
      cursor: pointer;
      background: var(--ngaf-chat-bg);
      transition: background 150ms ease, border-color 150ms ease;
    }
    .debug-checkpoint-card:hover {
      background: color-mix(in srgb, var(--ngaf-chat-text) 5%, transparent);
    }
    .debug-checkpoint-card--selected {
      border-color: var(--ngaf-chat-text-muted);
      background: color-mix(in srgb, var(--ngaf-chat-text) 5%, transparent);
    }
    .debug-checkpoint-card__title {
      font-size: var(--ngaf-chat-font-size-xs);
      font-weight: 500;
      color: var(--ngaf-chat-text);
      margin: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .debug-checkpoint-card__meta {
      display: flex;
      gap: 8px;
      margin-top: 4px;
    }
    .debug-checkpoint-card__badge {
      font-size: var(--ngaf-chat-font-size-xs);
      padding: 2px 6px;
      border-radius: 4px;
      background: var(--ngaf-chat-surface-alt);
      color: var(--ngaf-chat-text-muted);
    }
    `,
  ],
  template: `
    <button
      class="debug-checkpoint-card"
      [class.debug-checkpoint-card--selected]="isSelected()"
      (click)="selected.emit()"
    >
      <p class="debug-checkpoint-card__title">{{ checkpoint().node ?? 'Unknown' }}</p>
      <div class="debug-checkpoint-card__meta">
        @if (checkpoint().duration !== null && checkpoint().duration !== undefined) {
          <span class="debug-checkpoint-card__badge">{{ checkpoint().duration }}ms</span>
        }
        @if (checkpoint().tokenCount !== null && checkpoint().tokenCount !== undefined) {
          <span class="debug-checkpoint-card__badge">{{ checkpoint().tokenCount }} tok</span>
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
