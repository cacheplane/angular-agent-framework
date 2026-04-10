// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component } from '@angular/core';
import {
  ChatComponent,
  ChatToolCallsComponent,
  ChatToolCallCardComponent,
} from '@cacheplane/chat';
import { ExampleChatLayoutComponent } from '@cacheplane/example-layouts';
import { agent } from '@cacheplane/angular';
import { environment } from '../environments/environment';

/**
 * ToolCallsComponent demonstrates tool calling with ChatComponent
 * and a sidebar showing ChatToolCallsComponent / ChatToolCallCardComponent.
 */
@Component({
  selector: 'app-tool-calls',
  standalone: true,
  imports: [ChatComponent, ChatToolCallsComponent, ChatToolCallCardComponent, ExampleChatLayoutComponent],
  template: `
    <example-chat-layout sidebarWidth="w-80">
      <chat main [ref]="stream" class="flex-1 min-w-0" />
      <div sidebar class="p-4 space-y-4" style="background: var(--chat-bg, #171717); color: var(--chat-text, #e0e0e0);">
        <h3 class="text-xs font-semibold uppercase tracking-wide"
            style="color: var(--chat-text-muted, #777);">Tool Calls</h3>
        <chat-tool-calls [ref]="stream" />
        <div class="mt-4 space-y-2">
          <h4 class="text-xs font-semibold uppercase tracking-wide"
              style="color: var(--chat-text-muted, #777);">Available Tools</h4>
          <ul class="text-xs space-y-1 list-disc list-inside" style="color: var(--chat-text-muted, #777);">
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
  protected readonly stream = agent({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
  });
}
