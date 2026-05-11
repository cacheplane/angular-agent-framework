// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { CHAT_HOST_TOKENS } from '../../../styles/chat-tokens';

@Component({
  selector: 'chat-debug-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    CHAT_HOST_TOKENS,
    `
    :host {
      display: block;
      padding: var(--ngaf-chat-space-4);
      border-bottom: 1px solid color-mix(in srgb, var(--ngaf-chat-separator) 60%, transparent);
    }
    :host:last-child { border-bottom: 0; }
    .section__label {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--ngaf-chat-text-muted);
      margin: 0 0 var(--ngaf-chat-space-3);
    }
    .section__body { display: flex; flex-direction: column; gap: var(--ngaf-chat-space-2); }
    `,
  ],
  template: `
    @if (label()) {
      <h4 class="section__label">{{ label() }}</h4>
    }
    <div class="section__body"><ng-content /></div>
  `,
})
export class ChatDebugSectionComponent {
  readonly label = input<string>('');
}
