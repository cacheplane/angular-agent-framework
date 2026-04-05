import { Component, computed } from '@angular/core';
import { ChatComponent } from '@cacheplane/chat';
import { streamResource } from '@cacheplane/stream-resource';
import { environment } from '../environments/environment';

interface ToolCallEntry {
  name: string;
  args: string;
  result?: string;
}

/**
 * FilesystemComponent demonstrates agent file operations.
 *
 * The agent can read and write files using tool calls. The sidebar
 * shows a real-time log of each file operation as it happens.
 *
 * Key integration points:
 * - `stream.messages()` contains all messages including tool call results
 * - `computed()` derives tool call entries from AI messages
 * - Tool calls update reactively as the agent performs file operations
 */
@Component({
  selector: 'app-filesystem',
  standalone: true,
  imports: [ChatComponent],
  template: `
    <cp-chat
      [messages]="stream.messages()"
      [isLoading]="stream.isLoading()"
      [error]="stream.error()"
      (sendMessage)="send($event)">
      <ng-template #sidebar>
        <h3 style="font-size: 0.8rem; font-weight: 600; margin-bottom: 0.75rem; color: #1a1a2e;">File Operations</h3>
        @for (entry of toolCallEntries(); track $index) {
          <div style="display: flex; align-items: flex-start; gap: 8px; padding: 6px 0; font-size: 0.8rem; border-bottom: 1px solid #e5e7eb;">
            <span style="flex-shrink: 0; font-size: 1rem; line-height: 1.2;">
              {{ entry.name === 'read_file' ? '📖' : '✏️' }}
            </span>
            <div style="min-width: 0;">
              <div style="font-weight: 500; color: #1a1a2e; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                {{ getFilePath(entry.args) }}
              </div>
              <div style="color: #8b8fa3; font-size: 0.75rem; margin-top: 2px;">
                {{ entry.name === 'read_file' ? 'read' : 'write' }}
                {{ entry.result ? ' · done' : ' · running…' }}
              </div>
            </div>
          </div>
        }
        @empty {
          <p style="color: #8b8fa3; font-size: 0.8rem;">Ask the agent to read or write a file.</p>
        }
      </ng-template>
    </cp-chat>
  `,
})
export class FilesystemComponent {
  protected readonly stream = streamResource({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
  });

  toolCallEntries = computed(() => {
    const msg = this.stream.messages();
    const calls: ToolCallEntry[] = [];
    for (const m of msg) {
      if ((m as any).tool_calls) {
        for (const tc of (m as any).tool_calls) {
          calls.push({ name: tc.name, args: JSON.stringify(tc.args), result: tc.output });
        }
      }
    }
    return calls;
  });

  getFilePath(args: string): string {
    try {
      const parsed = JSON.parse(args);
      return parsed.path ?? args;
    } catch {
      return args;
    }
  }

  send(text: string): void {
    this.stream.submit({ messages: [{ role: 'human', content: text }] });
  }
}
