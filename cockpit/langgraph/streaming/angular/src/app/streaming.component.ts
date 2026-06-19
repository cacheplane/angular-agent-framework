// SPDX-License-Identifier: MIT
import { Component } from '@angular/core';
import { ChatComponent, ChatWelcomeSuggestionComponent } from '@threadplane/chat';
import { injectAgent } from '@threadplane/langgraph';
import { STREAMING_AGENT, type StreamingState } from './agent-ref';
import { ExampleChatLayoutComponent } from '@threadplane/example-layouts';

const WELCOME_SUGGESTIONS = [
  {
    label: 'Stream a long answer',
    value: 'Explain LangGraph checkpointing in 200 words.',
    description: 'Watch tokens arrive incrementally — the simplest @threadplane/chat integration.',
  },
  {
    label: 'How agents pick tools',
    value: 'Show me how an agent decides which tool to use.',
    description: 'Explains tool-selection reasoning; good entry point for the tool-calls demo.',
  },
] as const;

/**
 * Streaming demo — simplest possible @threadplane/chat integration.
 *
 * Injects the singleton agent (configured in app.config.ts) and passes it
 * to the prebuilt <chat> composition. The composition handles message
 * rendering, input, typing indicator, and error display internally.
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
              [description]="s.description"
              (selected)="send($event)"
            />
          }
        </div>
      </chat>
    </example-chat-layout>
  `,
})
export class StreamingComponent {
  protected readonly agent = injectAgent(STREAMING_AGENT);
  // Typed read: prove StreamingState flows through DI.
  protected readonly _typedState: StreamingState = this.agent.value();
  protected readonly suggestions = WELCOME_SUGGESTIONS;

  protected send(text: string): void {
    void this.agent.submit({ message: text });
  }
}
