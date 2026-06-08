// SPDX-License-Identifier: MIT
import { Component } from '@angular/core';
import { ChatComponent, ChatWelcomeSuggestionComponent, a2uiBasicCatalog } from '@threadplane/chat';
import { ExampleChatLayoutComponent } from '@threadplane/example-layouts';
import { injectAgent } from '@threadplane/ag-ui';

const WELCOME_SUGGESTIONS = [
  { label: 'LAX → JFK', value: 'I want to fly LAX to JFK' },
  { label: 'SFO → SEA', value: 'I want to fly SFO to SEA' },
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
            <chat-welcome-suggestion [label]="s.label" [value]="s.value" (selected)="send($event)" />
          }
        </div>
      </chat>
    </example-chat-layout>
  `,
})
export class A2uiComponent {
  protected readonly agent = injectAgent();
  protected readonly catalog = a2uiBasicCatalog();
  protected readonly suggestions = WELCOME_SUGGESTIONS;
  protected send(text: string): void { void this.agent.submit({ message: text }); }
}
