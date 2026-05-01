// libs/chat/src/lib/primitives/chat-window/chat-window.component.ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';
import { CHAT_WINDOW_STYLES } from '../../styles/chat-window.styles';

@Component({
  selector: 'chat-window',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [CHAT_HOST_TOKENS, CHAT_WINDOW_STYLES],
  template: `
    <div class="chat-window__header"><ng-content select="[chatHeader]" /></div>
    <div class="chat-window__body"><ng-content select="[chatBody]" /></div>
    <div class="chat-window__footer"><ng-content select="[chatFooter]" /></div>
  `,
})
export class ChatWindowComponent {}
