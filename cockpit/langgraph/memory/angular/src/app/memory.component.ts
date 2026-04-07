// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component, computed } from '@angular/core';
import { ChatComponent } from '@cacheplane/chat';
import { agent } from '@cacheplane/angular';
import { environment } from '../environments/environment';

/**
 * MemoryComponent demonstrates cross-thread persistent context with `agent()`.
 *
 * This example shows how an agent can learn and remember facts about the user
 * across separate conversations. The graph maintains a `memory` dict in its
 * state that is updated as new facts are extracted from the conversation.
 *
 * Key integration points:
 * - `stream.value()` exposes the full graph state, including the `memory` field
 * - `memoryEntries` is derived from `stream.value()` for reactive sidebar rendering
 * - Facts appear in the sidebar as the agent learns them during conversation
 */
@Component({
  selector: 'app-memory',
  standalone: true,
  imports: [ChatComponent],
  template: `
    <div class="flex h-screen">
      <chat [ref]="stream" class="flex-1 min-w-0" />
      <aside class="w-72 shrink-0 border-l overflow-y-auto p-4 space-y-2"
             style="border-color: var(--chat-border, #333); background: var(--chat-bg, #171717); color: var(--chat-text, #e0e0e0);">
        <h3 class="text-xs font-semibold uppercase tracking-wide"
            style="color: var(--chat-text-muted, #777);">Learned Facts</h3>
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
   * The graph returns a `memory` dict alongside messages in its state.
   * We expose it via `stream.value()` and derive a reactive signal for display.
   */
  protected readonly stream = agent({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
  });

  /**
   * Reactive list of [key, value] memory entries derived from the graph state.
   *
   * The Python graph stores learned facts in `state.memory` as a plain dict.
   * This signal re-computes whenever the stream state changes.
   */
  protected readonly memoryEntries = computed(() => {
    const val = this.stream.value() as Record<string, unknown>;
    const mem = val?.['memory'];
    if (!mem || typeof mem !== 'object') return [];
    return Object.entries(mem as Record<string, string>);
  });
}
