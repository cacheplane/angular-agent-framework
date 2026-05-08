// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { ChatPopupComponent, ChatWelcomeSuggestionComponent } from '@ngaf/chat';
import { DEMO_AGENT, DEMO_MODEL } from '../shell/shell-tokens';
import { WELCOME_SUGGESTIONS } from './welcome-suggestions';

@Component({
  selector: 'popup-mode',
  standalone: true,
  imports: [ChatPopupComponent, ChatWelcomeSuggestionComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="popup-mode__background">
      <p class="popup-mode__hint">
        Click the launcher button (bottom-right) to open the chat.
      </p>
    </div>
    <chat-popup [agent]="agent" [(selectedModel)]="model" [modelOptions]="modelOptions()">
      <div chatWelcomeSuggestions>
        @for (s of suggestions; track s.value) {
          <chat-welcome-suggestion
            [label]="s.label"
            [value]="s.value"
            (selected)="send($event)"
          />
        }
      </div>
    </chat-popup>
  `,
  styles: [`
    :host { display: block; height: 100%; }
    .popup-mode__background {
      display: grid;
      place-items: center;
      height: 100%;
      color: #8a92a3;
      font-size: 14px;
    }
  `],
})
export class PopupMode {
  protected readonly agent = inject(DEMO_AGENT);
  protected readonly model = inject(DEMO_MODEL) as ReturnType<typeof signal<string>>;
  protected readonly suggestions = WELCOME_SUGGESTIONS;
  protected readonly modelOptions = signal<readonly { value: string; label: string }[]>([
    { value: 'gpt-5', label: 'gpt-5' },
    { value: 'gpt-5-mini', label: 'gpt-5-mini' },
    { value: 'gpt-5-nano', label: 'gpt-5-nano' },
  ]);

  protected send(text: string): void {
    void this.agent.submit({ message: text });
  }
}
