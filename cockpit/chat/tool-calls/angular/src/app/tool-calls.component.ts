// SPDX-License-Identifier: MIT
import { Component } from '@angular/core';
import {
  ChatComponent,
  ChatToolCallsComponent,
  ChatToolCallCardComponent,
  ChatWelcomeSuggestionComponent,
} from '@threadplane/chat';
import { ExampleChatLayoutComponent } from '@threadplane/example-layouts';
import { agent } from '@threadplane/langgraph';
import { environment } from '../environments/environment';

const SUGGESTIONS = [
  // value matches cockpit/chat/tool-calls/angular/e2e/c-tool-calls.spec.ts PROMPT.
  { label: 'Look up flight UA123', value: "What's the status of UA123?" },
] as const;

/**
 * ToolCallsComponent demonstrates tool calling with ChatComponent
 * and a sidebar showing ChatToolCallsComponent / ChatToolCallCardComponent.
 *
 * Welcome chip lets users one-click into the cap's recorded aimock flow.
 */
@Component({
  selector: 'app-tool-calls',
  standalone: true,
  imports: [
    ChatComponent,
    ChatToolCallsComponent,
    ChatToolCallCardComponent,
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
            style="color: var(--ngaf-chat-text-muted);">Tool Calls</h3>
        <chat-tool-calls [agent]="agent" />
        <div class="mt-4 space-y-2">
          <h4 class="text-xs font-semibold uppercase tracking-wide"
              style="color: var(--ngaf-chat-text-muted);">Available Tools</h4>
          <ul class="text-xs space-y-1 list-disc list-inside" style="color: var(--ngaf-chat-text-muted);">
            <li>search — Web search</li>
            <li>calculator — Math expressions</li>
            <li>weather — City weather</li>
          </ul>
        </div>
      </div>
    </example-chat-layout>
  `,
})
export class ToolCallsComponent {
  protected readonly agent = agent({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
  });

  protected readonly suggestions = SUGGESTIONS;

  protected send(text: string): void {
    void this.agent.submit({ message: text });
  }
}
