// SPDX-License-Identifier: MIT
import { Component } from '@angular/core';
import {
  ChatComponent,
  ChatSubagentsComponent,
  ChatSubagentCardComponent,
  ChatWelcomeSuggestionComponent,
} from '@ngaf/chat';
import { ExampleChatLayoutComponent } from '@ngaf/example-layouts';
import { agent } from '@ngaf/langgraph';
import { environment } from '../environments/environment';

const SUGGESTIONS = [
  // value matches cockpit/chat/subagents/angular/e2e/c-subagents.spec.ts PROMPT.
  { label: 'Plan a trip', value: 'Plan a trip from LAX to JFK' },
] as const;

/**
 * SubagentsComponent demonstrates subagent orchestration with
 * ChatComponent and a sidebar showing ChatSubagentsComponent /
 * ChatSubagentCardComponent for tracking active subagents.
 *
 * Welcome chip lets users one-click into the cap's recorded aimock flow.
 */
@Component({
  selector: 'app-subagents',
  standalone: true,
  imports: [
    ChatComponent,
    ChatSubagentsComponent,
    ChatSubagentCardComponent,
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
              (selected)="send($event)"
            />
          }
        </div>
      </chat>
      <div sidebar class="p-4 space-y-4" style="background: var(--ngaf-chat-bg); color: var(--ngaf-chat-text);">
        <h3 class="text-xs font-semibold uppercase tracking-wide"
            style="color: var(--ngaf-chat-text-muted);">Active Subagents</h3>
        <chat-subagents [agent]="agent" />
        <div class="mt-4">
          <h4 class="text-xs font-semibold uppercase tracking-wide mb-2"
              style="color: var(--ngaf-chat-text-muted);">Agent Pipeline</h4>
          <ol class="text-xs space-y-1 list-decimal list-inside" style="color: var(--ngaf-chat-text-muted);">
            <li>Orchestrator</li>
            <li>Research Agent</li>
            <li>Analysis Agent</li>
            <li>Summary Agent</li>
          </ol>
        </div>
      </div>
    </example-chat-layout>
  `,
})
export class SubagentsComponent {
  protected readonly agent = agent({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
  });

  protected readonly suggestions = SUGGESTIONS;

  protected send(text: string): void {
    void this.agent.submit({ message: text });
  }
}
