// libs/chat/src/lib/primitives/chat-checkpoint-marker/chat-checkpoint-marker.component.ts
// SPDX-License-Identifier: MIT
import {
  Component, ChangeDetectionStrategy, input, output,
} from '@angular/core';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';

@Component({
  selector: 'chat-checkpoint-marker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [CHAT_HOST_TOKENS, `
    :host {
      display: inline-flex;
      align-items: center;
      width: 14px;
      height: 100%;
      flex: 0 0 14px;
    }
    .chat-checkpoint-marker__dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      padding: 0;
      cursor: pointer;
      background: transparent;
      box-shadow: inset 0 0 0 1px var(--a2ui-primary, var(--ngaf-chat-primary));
      transition: background 120ms ease;
      position: relative;
    }
    .chat-checkpoint-marker__dot:hover,
    .chat-checkpoint-marker__dot:focus-visible {
      background: var(--a2ui-primary, var(--ngaf-chat-primary));
      outline: none;
    }
    .chat-checkpoint-marker__dot[data-active="true"] {
      background: var(--a2ui-primary, var(--ngaf-chat-primary));
    }
    .chat-checkpoint-marker__pill {
      position: absolute;
      left: 18px;
      top: 50%;
      transform: translateY(-50%);
      display: none;
      gap: 6px;
      padding: 4px 8px;
      background: var(--ngaf-chat-surface-alt);
      border: 1px solid var(--ngaf-chat-separator);
      border-radius: var(--ngaf-chat-radius-button);
      white-space: nowrap;
      font-size: 11px;
      z-index: 5;
    }
    .chat-checkpoint-marker__dot:hover + .chat-checkpoint-marker__pill,
    .chat-checkpoint-marker__dot:focus-visible + .chat-checkpoint-marker__pill,
    .chat-checkpoint-marker__pill:hover {
      display: inline-flex;
    }
    @media (pointer: coarse) {
      .chat-checkpoint-marker__dot:hover + .chat-checkpoint-marker__pill,
      .chat-checkpoint-marker__dot:focus-visible + .chat-checkpoint-marker__pill {
        display: none;
      }
      .chat-checkpoint-marker__dot[data-open="true"] + .chat-checkpoint-marker__pill {
        display: inline-flex;
      }
    }
    .chat-checkpoint-marker__action {
      background: transparent;
      border: 0;
      color: var(--ngaf-chat-text);
      cursor: pointer;
      padding: 2px 4px;
      font-size: 11px;
    }
    .chat-checkpoint-marker__action:hover { color: var(--a2ui-primary, var(--ngaf-chat-primary)); }
  `],
  template: `
    <button
      type="button"
      class="chat-checkpoint-marker__dot"
      [attr.data-active]="isActive() ? 'true' : null"
      [attr.aria-label]="'Checkpoint ' + checkpointId()"
    ></button>
    <span class="chat-checkpoint-marker__pill" role="group" aria-label="Checkpoint actions">
      <button
        type="button"
        class="chat-checkpoint-marker__action"
        data-action="rewind"
        (click)="replayRequested.emit(checkpointId())"
      >↶ Rewind</button>
      <button
        type="button"
        class="chat-checkpoint-marker__action"
        data-action="fork"
        (click)="forkRequested.emit(checkpointId())"
      >⑂ Fork</button>
    </span>
  `,
})
export class ChatCheckpointMarkerComponent {
  readonly checkpointId = input.required<string>();
  readonly isActive = input<boolean>(false);

  readonly replayRequested = output<string>();
  readonly forkRequested = output<string>();
}
