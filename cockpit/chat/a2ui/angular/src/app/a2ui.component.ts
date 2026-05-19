// SPDX-License-Identifier: MIT
import { Component } from '@angular/core';
import { ChatComponent, ChatWelcomeSuggestionComponent, a2uiBasicCatalog } from '@ngaf/chat';
import { ExampleChatLayoutComponent } from '@ngaf/example-layouts';
import { agent } from '@ngaf/langgraph';
import { environment } from '../environments/environment';

const WELCOME_SUGGESTIONS = [
  { label: 'LAX → JFK',          value: 'I want to fly LAX to JFK' },
  { label: 'SFO → SEA',          value: 'I want to fly SFO to SEA' },
] as const;

@Component({
  selector: 'app-a2ui',
  standalone: true,
  imports: [ChatComponent, ChatWelcomeSuggestionComponent, ExampleChatLayoutComponent],
  template: `
    <example-chat-layout>
      <chat main [agent]="agent" [views]="catalog" class="flex-1 min-w-0">
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
    </example-chat-layout>
  `,
})
export class A2uiComponent {
  protected readonly agent = agent({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.a2uiAssistantId,
  });
  protected readonly catalog = a2uiBasicCatalog();
  protected readonly suggestions = WELCOME_SUGGESTIONS;

  protected send(text: string): void {
    void this.agent.submit({ message: text });
  }
}
