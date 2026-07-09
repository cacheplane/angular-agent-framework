// SPDX-License-Identifier: MIT
import { Component } from '@angular/core';
import {
  ChatComponent,
  ChatToolCallsComponent,
  ChatWelcomeSuggestionComponent,
} from '@threadplane/chat';
import { ExampleChatLayoutComponent } from '@threadplane/example-layouts';
import { injectAgent } from '@threadplane/langgraph';

const SUGGESTIONS = [
  // value matches cockpit/chat/tool-calls/angular/e2e/c-tool-calls.spec.ts PROMPT.
  {
    label: 'Check a flight status',
    value: "What's the status of UA123?",
    description: 'Calls a lookup_flight tool; watch the tool-call card stream in the sidebar.',
  },
] as const;

/**
 * ToolCallsComponent demonstrates tool calling with ChatComponent
 * and a sidebar showing ChatToolCallsComponent.
 *
 * Welcome chip lets users one-click into the cap's recorded aimock flow.
 */
@Component({
  selector: 'app-tool-calls',
  standalone: true,
  imports: [
    ChatComponent,
    ChatToolCallsComponent,
    ChatWelcomeSuggestionComponent,
    ExampleChatLayoutComponent,
  ],
  template: `
    <example-chat-layout sidebarWidth="20rem">
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
      <div sidebar class="panel">
        <h3 class="cap">Tool Calls</h3>
        <chat-tool-calls [agent]="agent" />
        <div>
          <h4 class="cap">Available Tools</h4>
          <ul class="info-list">
            <li>search — Web search</li>
            <li>calculator — Math expressions</li>
            <li>weather — City weather</li>
          </ul>
        </div>
      </div>
    </example-chat-layout>
  `,
  styles: [`
    .panel {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      padding: 1rem;
      background: var(--tplane-chat-bg);
      color: var(--tplane-chat-text);
    }

    .cap {
      margin: 0;
      color: var(--tplane-chat-text-muted);
      font-size: var(--tplane-chat-font-size-xs);
      font-weight: 700;
      letter-spacing: 0.12em;
      line-height: var(--tplane-chat-line-height-tight);
      text-transform: uppercase;
    }

    .info-list {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      margin: 0.5rem 0 0;
      padding: 0;
      color: var(--tplane-chat-text-muted);
      font-size: var(--tplane-chat-font-size-xs);
      line-height: var(--tplane-chat-line-height);
      list-style: none;
    }
  `],
})
export class ToolCallsComponent {
  protected readonly agent = injectAgent();

  protected readonly suggestions = SUGGESTIONS;

  protected send(text: string): void {
    void this.agent.submit({ message: text });
  }
}
