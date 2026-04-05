import { Component, Input } from '@angular/core';

/**
 * Renders a single chat message bubble.
 * Human messages align right with accent tint.
 * AI messages align left with subtle background.
 */
@Component({
  selector: 'cp-chat-message',
  standalone: true,
  template: `
    <div [class]="'cp-message cp-message--' + type">
      <span class="cp-message__role">{{ type }}</span>
      <p class="cp-message__content">{{ content }}</p>
    </div>
  `,
  styles: [`
    .cp-message { padding: 0.75rem 1rem; border-radius: 0.5rem; max-width: 80%; }
    .cp-message--human { background: rgba(0, 64, 144, 0.08); align-self: flex-end; }
    .cp-message--ai { background: rgba(0, 0, 0, 0.03); align-self: flex-start; }
    .cp-message__role { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.4; display: block; margin-bottom: 2px; }
    .cp-message__content { margin: 0; white-space: pre-wrap; font-size: 0.9rem; line-height: 1.6; }
  `],
})
export class ChatMessageComponent {
  @Input({ required: true }) type!: 'human' | 'ai';
  @Input({ required: true }) content!: string;
}
