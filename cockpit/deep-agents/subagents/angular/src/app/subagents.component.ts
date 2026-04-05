import { Component, computed } from '@angular/core';
import { ChatComponent } from '@cacheplane/chat';
import { streamResource } from '@cacheplane/stream-resource';
import { environment } from '../environments/environment';

/**
 * SubagentsComponent demonstrates the Deep Agents subagent delegation pattern.
 *
 * The orchestrator agent receives a task and delegates subtasks to specialist
 * subagents via tool calls. Each tool call spawns a child agent that streams
 * its own progress independently.
 *
 * Key integration points:
 * - `stream.subagents()` returns a Map<toolCallId, SubagentStreamRef>
 * - `subagentEntries` derives a sorted array for sidebar rendering
 * - Each entry shows the tool call ID (truncated), status badge, and message count
 * - Subagent statuses update reactively: pending → running → complete
 */
@Component({
  selector: 'app-subagents',
  standalone: true,
  imports: [ChatComponent],
  template: `
    <cp-chat
      [messages]="stream.messages()"
      [isLoading]="stream.isLoading()"
      [error]="stream.error()"
      (sendMessage)="send($event)">
      <ng-template #sidebar>
        <h3 style="font-size: 0.8rem; font-weight: 600; margin-bottom: 0.75rem; color: #1a1a2e;">Subagents</h3>
        @for (entry of subagentEntries(); track entry[0]) {
          <div style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
              <span
                style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em;"
                [style.background]="entry[1].status() === 'complete' ? '#d1fae5' : entry[1].status() === 'running' ? '#dbeafe' : '#f3f4f6'"
                [style.color]="entry[1].status() === 'complete' ? '#065f46' : entry[1].status() === 'running' ? '#1e40af' : '#6b7280'">
                {{ entry[1].status() }}
              </span>
              <span style="font-size: 0.75rem; color: #6b7280; font-family: monospace;">
                {{ entry[0].slice(0, 8) }}…
              </span>
            </div>
            <div style="font-size: 0.75rem; color: #374151;">
              {{ entry[1].messages().length }} message{{ entry[1].messages().length === 1 ? '' : 's' }}
            </div>
          </div>
        }
        @empty {
          <p style="color: #8b8fa3; font-size: 0.8rem;">Ask a question to see subagent activity.</p>
        }
      </ng-template>
    </cp-chat>
  `,
})
export class SubagentsComponent {
  protected readonly stream = streamResource({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
  });

  subagentEntries = computed(() => Array.from(this.stream.subagents().entries()));

  send(text: string): void {
    this.stream.submit({ messages: [{ role: 'human', content: text }] });
  }
}
