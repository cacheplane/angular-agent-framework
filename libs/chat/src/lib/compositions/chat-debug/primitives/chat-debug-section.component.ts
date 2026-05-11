// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { CHAT_DEBUG_TOKENS } from '../chat-debug-tokens';

@Component({
  selector: 'chat-debug-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    CHAT_DEBUG_TOKENS,
    `
    :host {
      display: block;
      padding: 14px 16px;
      border-bottom: 1px solid var(--ngaf-chat-debug-border);
    }
    :host:last-child { border-bottom: 0; }
    .section__label {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--ngaf-chat-debug-text-subtle);
      margin: 0 0 10px;
    }
    .section__body { display: flex; flex-direction: column; gap: 10px; }
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
