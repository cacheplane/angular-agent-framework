// libs/chat/src/lib/compositions/chat-popup/chat-popup.component.ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input, model } from '@angular/core';
import type { Agent } from '../../agent';
import { ChatComponent } from '../chat/chat.component';
import { ChatLauncherButtonComponent } from '../../primitives/chat-launcher-button/chat-launcher-button.component';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';

@Component({
  selector: 'chat-popup',
  standalone: true,
  imports: [ChatComponent, ChatLauncherButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [CHAT_HOST_TOKENS, `
    :host { position: fixed; bottom: 1rem; right: 1rem; z-index: 30; }
    .chat-popup__launcher { position: relative; }
    .chat-popup__window {
      position: fixed;
      bottom: 5rem;
      right: 1rem;
      width: 24rem;
      height: 600px;
      max-height: calc(100vh - 6rem);
      background: var(--ngaf-chat-bg);
      border: 1px solid var(--ngaf-chat-separator);
      border-radius: 0.75rem;
      box-shadow: 0 5px 40px rgba(0,0,0,.16);
      transform-origin: bottom right;
      transform: scale(0.95) translateY(20px);
      opacity: 0;
      pointer-events: none;
      transition: transform 200ms ease-out, opacity 100ms ease-out;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .chat-popup__window[data-open="true"] {
      transform: scale(1) translateY(0);
      opacity: 1;
      pointer-events: auto;
    }
    @media (max-width: 640px) {
      .chat-popup__window { inset: 0; width: 100vw; height: 100vh; max-height: 100vh; border-radius: 0; bottom: auto; right: auto; }
    }
    .chat-popup__close {
      position: absolute; top: 8px; right: 8px;
      width: 32px; height: 32px;
      background: transparent; border: 0; cursor: pointer;
      color: var(--ngaf-chat-text-muted);
      border-radius: 50%;
      z-index: 1;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .chat-popup__close:hover { background: var(--ngaf-chat-surface-alt); color: var(--ngaf-chat-text); }
  `],
  template: `
    <div class="chat-popup__launcher">
      <chat-launcher-button (click)="toggle()" />
    </div>
    <div class="chat-popup__window" [attr.data-open]="open() ? 'true' : 'false'" role="dialog" aria-modal="false">
      <button type="button" class="chat-popup__close" (click)="closeWindow()" aria-label="Close chat">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
      <chat [agent]="agent()">
        <ng-content select="[chatHeader]" chatHeader />
      </chat>
    </div>
  `,
})
export class ChatPopupComponent {
  readonly agent = input.required<Agent>();
  readonly open = model(false);

  toggle(): void { this.open.update((v) => !v); }
  openWindow(): void { this.open.set(true); }
  closeWindow(): void { this.open.set(false); }
}
