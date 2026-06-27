import { Component, computed } from '@angular/core';
import { ChatComponent } from '@threadplane/chat';
import { ExampleChatLayoutComponent } from '@threadplane/example-layouts';
import { injectAgent } from '@threadplane/langgraph';

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
  imports: [ChatComponent, ExampleChatLayoutComponent],
  template: `
    <example-chat-layout sidebarWidth="w-72">
      <chat main [agent]="agent" class="flex-1 min-w-0" />
      <div sidebar class="p-4 space-y-2" style="background: var(--tplane-chat-bg); color: var(--tplane-chat-text);">
        <h3 class="text-xs font-semibold uppercase tracking-wide"
            style="color: var(--tplane-chat-text-muted);">
          Learned Facts
          @if (memoryEntries().length > 0) {
            <span class="ml-1 tabular-nums">({{ memoryEntries().length }})</span>
          }
        </h3>
        @if (memoryEntries().length === 0) {
          <p class="text-sm italic" style="color: var(--tplane-chat-text-muted);">No facts learned yet</p>
        }
        @for (entry of memoryEntries(); track entry[0]) {
          <div class="text-sm py-1">
            <span class="font-medium" style="color: var(--tplane-chat-text);">{{ entry[0] }}:</span>
            <span style="color: var(--tplane-chat-text-muted);"> {{ entry[1] }}</span>
          </div>
        }
      </div>
    </example-chat-layout>
  `,
})
export class MemoryComponent {
  /**
   * The streaming resource connected to the memory graph.
   *
   * The graph returns an `agent_memory` (or `memory`) dict alongside messages
   * in its state. We derive a reactive signal from `stream.value()` for display.
   */
  protected readonly agent = injectAgent();

  /**
   * Reactive list of [key, value] memory entries derived from the graph state.
   *
   * Checks for `agent_memory` first, then falls back to `memory`.
   * This signal re-computes whenever the stream state changes.
   */
  protected readonly memoryEntries = computed(() => {
    const val = this.agent.value() as Record<string, unknown>;
    const mem = val?.['agent_memory'] ?? val?.['memory'];
    if (!mem || typeof mem !== 'object') return [];
    return Object.entries(mem as Record<string, string>);
  });
}
