import { Component, computed } from '@angular/core';
import { LegacyChatComponent } from '@cacheplane/chat';
import { streamResource } from '@cacheplane/stream-resource';
import { environment } from '../environments/environment';

/**
 * MemoryComponent demonstrates cross-thread persistent context with `streamResource()`.
 *
 * This example shows how an agent can learn and remember facts about the user
 * across separate conversations. The graph maintains a `memory` dict in its
 * state that is updated as new facts are extracted from the conversation.
 *
 * Key integration points:
 * - `stream.value()` exposes the full graph state, including the `memory` field
 * - `memory()` signal is derived from `stream.value()` for reactive sidebar rendering
 * - Facts appear in the sidebar as the agent learns them during conversation
 */
@Component({
  selector: 'app-memory',
  standalone: true,
  imports: [LegacyChatComponent],
  template: `
    <cp-chat
      [messages]="stream.messages()"
      [isLoading]="stream.isLoading()"
      [error]="stream.error()"
      (sendMessage)="send($event)">
      <ng-template #sidebar>
        <h3 style="font-size: 0.8rem; font-weight: 600; margin-bottom: 0.75rem; color: #1a1a2e;">Agent Memory</h3>
        @if (memoryEntries().length === 0) {
          <p style="font-size: 0.75rem; color: #888; font-style: italic;">
            No facts learned yet. Start chatting!
          </p>
        }
        @for (entry of memoryEntries(); track entry.key) {
          <div style="margin-bottom: 0.5rem; padding: 6px 8px; background: rgba(0,64,144,0.04); border-radius: 6px; border-left: 3px solid rgba(0,64,144,0.2);">
            <div style="font-size: 0.7rem; font-weight: 600; color: #004090; text-transform: uppercase; letter-spacing: 0.03em; margin-bottom: 2px;">
              {{ entry.key }}
            </div>
            <div style="font-size: 0.8rem; color: #333; word-break: break-word;">
              {{ entry.value }}
            </div>
          </div>
        }
      </ng-template>
    </cp-chat>
  `,
})
export class MemoryComponent {
  /**
   * The streaming resource connected to the memory graph.
   *
   * The graph returns a `memory` dict alongside messages in its state.
   * We expose it via `stream.value()` and derive a reactive signal for display.
   */
  protected readonly stream = streamResource({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
  });

  /**
   * Reactive list of key-value memory entries derived from the graph state.
   *
   * The graph updates `memory` as it learns facts from the conversation.
   * This signal re-computes whenever the stream state changes.
   */
  protected readonly memoryEntries = computed(() => {
    const state = this.stream.value() as { memory?: Record<string, unknown> } | null;
    const memory = state?.memory ?? {};
    return Object.entries(memory).map(([key, value]) => ({
      key,
      value: typeof value === 'string' ? value : JSON.stringify(value),
    }));
  });

  /**
   * Submit a message to the agent.
   */
  send(text: string): void {
    this.stream.submit({ messages: [{ role: 'human', content: text }] });
  }
}
