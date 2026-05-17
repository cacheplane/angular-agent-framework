// SPDX-License-Identifier: MIT
import { Component } from '@angular/core';
import { ChatComponent, ChatWelcomeSuggestionComponent } from '@ngaf/chat';
import { agent } from '@ngaf/langgraph';
import { ExampleChatLayoutComponent } from '@ngaf/example-layouts';
import { environment } from '../environments/environment';

const WELCOME_SUGGESTIONS = [
  { label: 'Stream a long answer',             value: 'Explain LangGraph checkpointing in 200 words.' },
  { label: 'Walk me through agent tool calls', value: 'Show me how an agent decides which tool to use.' },
] as const;

/**
 * Streaming demo — simplest possible @ngaf/chat integration.
 *
 * Creates a agent ref and passes it to the prebuilt <chat>
 * composition. The composition handles message rendering, input, typing
 * indicator, and error display internally.
 */
@Component({
  selector: 'app-streaming',
  standalone: true,
  imports: [ChatComponent, ChatWelcomeSuggestionComponent, ExampleChatLayoutComponent],
  template: `
    <example-chat-layout>
      <chat main [agent]="agent" class="flex-1 min-w-0">
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
export class StreamingComponent {
  protected readonly agent = agent({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
  });
  protected readonly suggestions = WELCOME_SUGGESTIONS;

  protected send(text: string): void {
    void this.agent.submit({ message: text });
  }
}
