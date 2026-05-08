// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { ChatComponent, ChatWelcomeSuggestionComponent } from '@ngaf/chat';
import { DEMO_AGENT, DEMO_MODEL } from '../shell/shell-tokens';
import { WELCOME_SUGGESTIONS } from './welcome-suggestions';

@Component({
  selector: 'embed-mode',
  standalone: true,
  imports: [ChatComponent, ChatWelcomeSuggestionComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <chat
      [agent]="agent"
      [modelOptions]="modelOptions()"
      [(selectedModel)]="model"
    >
      <div chatWelcomeSuggestions>
        @for (s of suggestions; track s.value) {
          <chat-welcome-suggestion
            [label]="s.label"
            [value]="s.value"
            (selected)="send($event)"
          />
        }
      </div>
    </chat>
  `,
  styles: [`
    :host { display: block; height: 100%; }
  `],
})
export class EmbedMode {
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
