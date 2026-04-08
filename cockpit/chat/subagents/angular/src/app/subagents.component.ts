// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component } from '@angular/core';
import {
  ChatComponent,
  ChatSubagentsComponent,
  ChatSubagentCardComponent,
} from '@cacheplane/chat';
import { agent } from '@cacheplane/angular';
import { environment } from '../environments/environment';

/**
 * SubagentsComponent demonstrates subagent orchestration with
 * ChatComponent and a sidebar showing ChatSubagentsComponent /
 * ChatSubagentCardComponent for tracking active subagents.
 */
@Component({
  selector: 'app-subagents',
  standalone: true,
  imports: [ChatComponent, ChatSubagentsComponent, ChatSubagentCardComponent],
  template: `
    <div class="flex h-screen">
      <chat [ref]="stream" class="flex-1 min-w-0" />
      <aside class="w-80 shrink-0 border-l overflow-y-auto p-4 space-y-4"
             style="border-color: var(--chat-border, #333); background: var(--chat-bg, #171717); color: var(--chat-text, #e0e0e0);">
        <h3 class="text-xs font-semibold uppercase tracking-wide"
            style="color: var(--chat-text-muted, #777);">Active Subagents</h3>
        <chat-subagents [ref]="stream" />
        <div class="mt-4">
          <h4 class="text-xs font-semibold uppercase tracking-wide mb-2"
              style="color: var(--chat-text-muted, #777);">Agent Pipeline</h4>
          <ol class="text-xs space-y-1 list-decimal list-inside" style="color: var(--chat-text-muted, #777);">
            <li>Orchestrator</li>
            <li>Research Agent</li>
            <li>Analysis Agent</li>
            <li>Summary Agent</li>
          </ol>
        </div>
      </aside>
    </div>
  `,
})
export class SubagentsComponent {
  protected readonly stream = agent({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
  });
}
