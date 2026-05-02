// SPDX-License-Identifier: MIT
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';
import { CHAT_WELCOME_SUGGESTION_STYLES } from '../../styles/chat-welcome.styles';

@Component({
  selector: 'chat-welcome-suggestion',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [CHAT_HOST_TOKENS, CHAT_WELCOME_SUGGESTION_STYLES],
  template: `
    <button type="button" class="chat-welcome-suggestion" (click)="selected.emit(value())">
      <ng-content select="[chatWelcomeSuggestionIcon]" />
      <span class="chat-welcome-suggestion__label">{{ label() }}</span>
      <span class="chat-welcome-suggestion__chevron" aria-hidden="true">›</span>
    </button>
  `,
})
export class ChatWelcomeSuggestionComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly selected = output<string>();
}
