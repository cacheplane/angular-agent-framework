// SPDX-License-Identifier: MIT
import { Component } from '@angular/core';
import {
  ChatComponent,
  ChatWelcomeSuggestionComponent,
} from '@threadplane/chat';
import { ExampleChatLayoutComponent } from '@threadplane/example-layouts';
import { injectAgent } from '@threadplane/langgraph';

const SUGGESTIONS = [
  // value matches cockpit/chat/subagents/angular/e2e/c-subagents.spec.ts PROMPT.
  {
    label: 'Plan a trip from LAX to JFK',
    value: 'Plan a trip from LAX to JFK',
    description: 'Orchestrator delegates to research, booking, and itinerary subagents in turn.',
  },
] as const;

/**
 * SubagentsComponent demonstrates subagent orchestration: the orchestrator
 * dispatches `task` subagents (research/booking/itinerary), each a real
 * LangGraph subgraph. Each dispatch renders inline as a persistent
 * chat-subagent-card in the conversation (via the <chat> composition), so no
 * separate active-only sidebar tray is needed. The sidebar keeps a short
 * static pipeline note for context.
 *
 * Welcome chip lets users one-click into the cap's recorded aimock flow.
 */
@Component({
  selector: 'app-subagents',
  standalone: true,
  imports: [
    ChatComponent,
    ChatWelcomeSuggestionComponent,
    ExampleChatLayoutComponent,
  ],
  template: `
    <example-chat-layout sidebarWidth="w-80">
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
      <div sidebar class="p-4 space-y-4" style="background: var(--tplane-chat-bg); color: var(--tplane-chat-text);">
        <div>
          <h4 class="text-xs font-semibold uppercase tracking-wide mb-2"
              style="color: var(--tplane-chat-text-muted);">Agent Pipeline</h4>
          <ol class="text-xs space-y-1 list-decimal list-inside" style="color: var(--tplane-chat-text-muted);">
            <li>Orchestrator</li>
            <li>Research subagent</li>
            <li>Booking subagent</li>
            <li>Itinerary subagent</li>
          </ol>
        </div>
      </div>
    </example-chat-layout>
  `,
})
export class SubagentsComponent {
  protected readonly agent = injectAgent();

  protected readonly suggestions = SUGGESTIONS;

  protected send(text: string): void {
    void this.agent.submit({ message: text });
  }
}
