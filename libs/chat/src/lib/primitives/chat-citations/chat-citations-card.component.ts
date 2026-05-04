// libs/chat/src/lib/primitives/chat-citations/chat-citations-card.component.ts
// SPDX-License-Identifier: MIT
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { Citation } from '../../agent/citation';

@Component({
  selector: 'chat-citations-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="chat-citations-card">
      <div class="chat-citations-card__index">{{ citation().index }}</div>
      <div class="chat-citations-card__body">
        @if (citation().url; as url) {
          <a class="chat-citations-card__title" [href]="url" target="_blank" rel="noopener noreferrer">
            {{ citation().title ?? url }}
          </a>
        } @else if (citation().title) {
          <span class="chat-citations-card__title">{{ citation().title }}</span>
        }
        @if (citation().snippet; as s) {
          <p class="chat-citations-card__snippet">{{ s }}</p>
        }
      </div>
    </div>
  `,
})
export class ChatCitationsCardComponent {
  readonly citation = input.required<Citation>();
}
