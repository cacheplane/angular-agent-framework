import { Component } from '@angular/core';
import { ChatComponent } from '@cacheplane/chat';
import { streamResource } from '@cacheplane/stream-resource';
import { environment } from '../environments/environment';

/**
 * SubagentsComponent demonstrates the Deep Agents subagent delegation pattern.
 *
 * The orchestrator agent receives a task and delegates subtasks to specialist
 * subagents via tool calls.
 */
@Component({
  selector: 'app-subagents',
  standalone: true,
  imports: [ChatComponent],
  template: `<chat [ref]="stream" class="block h-screen" />`,
})
export class SubagentsComponent {
  protected readonly stream = streamResource({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
  });
}
