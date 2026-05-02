// libs/chat/src/lib/compositions/chat-sidebar/chat-sidebar.component.ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input, model } from '@angular/core';
import type { Agent } from '../../agent';
import { ChatComponent } from '../chat/chat.component';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';

@Component({
  selector: 'chat-sidebar',
  standalone: true,
  imports: [ChatComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.data-push]': 'pushContent() ? "true" : "false"',
    '[attr.data-open]': 'open() ? "true" : "false"',
  },
  styles: [CHAT_HOST_TOKENS, `
    :host { display: block; }
    .chat-sidebar__content { transition: margin-right 300ms ease; min-height: 100vh; }
    :host([data-push="true"][data-open="true"]) .chat-sidebar__content { margin-right: 28rem; }
    @media (max-width: 640px) {
      :host([data-push="true"][data-open="true"]) .chat-sidebar__content { margin-right: 0; }
    }
    .chat-sidebar__panel {
      position: fixed;
      top: 0; right: 0; bottom: 0;
      width: 28rem;
      background: var(--ngaf-chat-bg);
      border-left: 1px solid var(--ngaf-chat-separator);
      box-shadow: -8px 0 32px rgba(0,0,0,.08);
      transform: translateX(100%);
      transition: transform 200ms ease-out;
      z-index: 30;
      display: flex;
      flex-direction: column;
    }
    .chat-sidebar__panel[data-open="true"] { transform: translateX(0); }
    @media (max-width: 640px) {
      .chat-sidebar__panel { width: 100vw; }
    }
    .chat-sidebar__close {
      position: absolute; top: 8px; right: 8px;
      width: 32px; height: 32px;
      background: transparent; border: 0; cursor: pointer;
      color: var(--ngaf-chat-text-muted);
      border-radius: 50%; z-index: 1;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .chat-sidebar__close:hover { background: var(--ngaf-chat-surface-alt); color: var(--ngaf-chat-text); }
  `],
  template: `
    <div class="chat-sidebar__content"><ng-content /></div>
    <aside class="chat-sidebar__panel" [attr.data-open]="open() ? 'true' : 'false'" role="complementary" [attr.aria-hidden]="open() ? 'false' : 'true'">
      <button type="button" class="chat-sidebar__close" (click)="closeWindow()" aria-label="Close chat">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
      <chat [agent]="agent()">
        <ng-content select="[chatHeader]" chatHeader />
      </chat>
    </aside>
  `,
})
export class ChatSidebarComponent {
  readonly agent = input.required<Agent>();
  readonly open = model(false);
  readonly pushContent = input<boolean>(false);

  toggle(): void { this.open.update((v) => !v); }
  openWindow(): void { this.open.set(true); }
  closeWindow(): void { this.open.set(false); }
}
