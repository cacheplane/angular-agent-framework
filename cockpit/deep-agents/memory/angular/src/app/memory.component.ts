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
    <example-chat-layout sidebarWidth="18rem">
      <chat main [agent]="agent" class="flex-1 min-w-0" />
      <aside sidebar class="panel">
        <h3 class="cap">
          Learned Facts
          @if (memoryEntries().length > 0) {
            <span class="count">({{ memoryEntries().length }})</span>
          }
        </h3>
        @if (memoryEntries().length === 0) {
          <p class="empty">No facts learned yet</p>
        }
        @for (entry of memoryEntries(); track entry[0]) {
          <div class="fact-row">
            <span class="fact-key">{{ entry[0] }}:</span>
            <span class="fact-value"> {{ entry[1] }}</span>
          </div>
        }
      </aside>
    </example-chat-layout>
  `,
  styles: [`
    .panel {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding: 1rem;
      background: var(--tplane-chat-bg);
      color: var(--tplane-chat-text);
    }

    .cap {
      margin: 0;
      font-size: var(--tplane-chat-font-size-xs);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--tplane-chat-text-muted);
    }

    .empty {
      margin: 0;
      font-size: var(--tplane-chat-font-size-sm);
      font-style: italic;
      color: var(--tplane-chat-text-muted);
    }

    .fact-row {
      padding: 0.25rem 0;
      font-size: var(--tplane-chat-font-size-sm);
    }

    .fact-key {
      color: var(--tplane-chat-text);
      font-weight: 600;
    }

    .fact-value {
      color: var(--tplane-chat-text-muted);
    }

    .count {
      margin-left: 0.25rem;
      font-variant-numeric: tabular-nums;
    }
  `],
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
