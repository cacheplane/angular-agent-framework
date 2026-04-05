import { Component, computed } from '@angular/core';
import { ChatComponent } from '@cacheplane/chat';
import { streamResource } from '@cacheplane/stream-resource';
import { environment } from '../environments/environment';

/**
 * MemoryComponent demonstrates persistent agent memory across sessions.
 *
 * The agent extracts facts about the user from each conversation turn
 * and stores them in `agent_memory` state. The sidebar shows all learned
 * facts in real time as the agent updates its memory.
 *
 * Key integration points:
 * - `stream.value()` contains the agent state including `agent_memory`
 * - `computed()` derives key/value pairs for the sidebar
 * - Memory entries update reactively as the agent learns new facts
 */
@Component({
  selector: 'app-da-memory',
  standalone: true,
  imports: [ChatComponent],
  template: `
    <cp-chat
      [messages]="stream.messages()"
      [isLoading]="stream.isLoading()"
      [error]="stream.error()"
      (sendMessage)="send($event)">
      <ng-template #sidebar>
        <h3 style="font-size: 0.8rem; font-weight: 600; margin-bottom: 0.75rem; color: #1a1a2e;">Learned Facts</h3>
        @for (entry of memoryEntries(); track entry[0]) {
          <div style="padding: 6px 0; font-size: 0.8rem; border-bottom: 1px solid #e5e7eb;">
            <div style="font-weight: 600; color: #1a1a2e; margin-bottom: 2px;">{{ entry[0] }}</div>
            <div style="color: #555770;">{{ entry[1] }}</div>
          </div>
        }
        @empty {
          <p style="color: #8b8fa3; font-size: 0.8rem;">Tell the agent something about yourself to see it remember.</p>
        }
      </ng-template>
    </cp-chat>
  `,
})
export class MemoryComponent {
  protected readonly stream = streamResource({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
  });

  memoryEntries = computed(() => {
    const val = this.stream.value() as { agent_memory?: Record<string, string> } | undefined;
    return Object.entries(val?.agent_memory ?? {});
  });

  send(text: string): void {
    this.stream.submit({ messages: [{ role: 'human', content: text }] });
  }
}
