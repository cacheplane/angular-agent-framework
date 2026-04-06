import { Component, computed } from '@angular/core';
import { ChatComponent } from '@cacheplane/chat';
import { streamResource } from '@cacheplane/stream-resource';
import { environment } from '../environments/environment';

/**
 * MemoryComponent demonstrates persistent agent memory across sessions.
 *
 * The agent extracts facts about the user from each conversation turn
 * and stores them in `agent_memory` (or `memory`) state. The sidebar
 * displays all learned facts as key-value pairs with a live count.
 *
 * Key integration points:
 * - `stream.value()` exposes the full graph state including the memory dict
 * - `memoryEntries` is derived reactively for sidebar rendering
 * - Facts appear as the agent learns them during conversation
 */
@Component({
  selector: 'app-da-memory',
  standalone: true,
  imports: [ChatComponent],
  template: `
    <div class="flex h-screen">
      <chat [ref]="stream" class="flex-1 min-w-0" />
      <aside class="w-72 shrink-0 border-l overflow-y-auto p-4 space-y-2"
             style="border-color: var(--chat-border, #333); background: var(--chat-bg, #171717); color: var(--chat-text, #e0e0e0);">
        <h3 class="text-xs font-semibold uppercase tracking-wide"
            style="color: var(--chat-text-muted, #777);">
          Learned Facts
          @if (memoryEntries().length > 0) {
            <span class="ml-1 tabular-nums">({{ memoryEntries().length }})</span>
          }
        </h3>
        @if (memoryEntries().length === 0) {
          <p class="text-sm italic" style="color: var(--chat-text-muted, #777);">No facts learned yet</p>
        }
        @for (entry of memoryEntries(); track entry[0]) {
          <div class="text-sm py-1">
            <span class="font-medium" style="color: var(--chat-text, #e0e0e0);">{{ entry[0] }}:</span>
            <span style="color: var(--chat-text-muted, #777);"> {{ entry[1] }}</span>
          </div>
        }
      </aside>
    </div>
  `,
})
export class MemoryComponent {
  /**
   * The streaming resource connected to the memory graph.
   *
   * The graph returns an `agent_memory` (or `memory`) dict alongside messages
   * in its state. We derive a reactive signal from `stream.value()` for display.
   */
  protected readonly stream = streamResource({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
  });

  /**
   * Reactive list of [key, value] memory entries derived from the graph state.
   *
   * Checks for `agent_memory` first, then falls back to `memory`.
   * This signal re-computes whenever the stream state changes.
   */
  protected readonly memoryEntries = computed(() => {
    const val = this.stream.value() as Record<string, unknown>;
    const mem = val?.['agent_memory'] ?? val?.['memory'];
    if (!mem || typeof mem !== 'object') return [];
    return Object.entries(mem as Record<string, string>);
  });
}
