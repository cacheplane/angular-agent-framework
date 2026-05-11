// libs/chat/src/lib/compositions/chat-thread-drawer/chat-thread-drawer.component.ts
// SPDX-License-Identifier: MIT
import {
  Component, ChangeDetectionStrategy, input, output,
} from '@angular/core';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';

export type ChatThreadDrawerMode = 'push' | 'overlay';

@Component({
  selector: 'chat-thread-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [CHAT_HOST_TOKENS, `
    :host {
      --chat-thread-drawer-width: 280px;
      display: contents;
    }
    .chat-thread-drawer__scrim {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.4);
      z-index: 1000;
      border: 0;
      padding: 0;
      cursor: pointer;
    }
    .chat-thread-drawer {
      position: fixed;
      top: 0;
      bottom: 0;
      width: var(--chat-thread-drawer-width);
      background: var(--ngaf-chat-bg);
      border-right: 1px solid var(--ngaf-chat-separator);
      z-index: 1001;
      transition: left 200ms ease;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
    }
    @media (max-width: 767px) {
      .chat-thread-drawer { width: 100%; }
    }
  `],
  template: `
    @if (open() && mode() === 'overlay') {
      <button
        type="button"
        class="chat-thread-drawer__scrim"
        aria-label="Close conversations"
        (click)="openChange.emit(false)"
      ></button>
    }
    <aside
      class="chat-thread-drawer"
      role="dialog"
      aria-label="Conversations"
      tabindex="-1"
      [attr.data-open]="open() ? 'true' : 'false'"
      [attr.data-mode]="mode()"
      [style.left.px]="open() ? 0 : -320"
      (keydown.escape)="openChange.emit(false)"
    >
      <ng-content />
    </aside>
  `,
})
export class ChatThreadDrawerComponent {
  readonly open = input.required<boolean>();
  readonly mode = input<ChatThreadDrawerMode>('push');

  readonly openChange = output<boolean>();
}
