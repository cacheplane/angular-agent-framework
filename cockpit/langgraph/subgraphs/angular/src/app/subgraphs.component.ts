// SPDX-License-Identifier: MIT
import { Component, computed } from '@angular/core';
import { ChatComponent } from '@ngaf/chat';
import { agent } from '@ngaf/langgraph';
import { ExampleChatLayoutComponent } from '@ngaf/example-layouts';
import { environment } from '../environments/environment';

/**
 * SubgraphsComponent demonstrates nested agent delegation with `agent()`.
 *
 * This example shows how a parent orchestrator delegates tasks to child subgraphs.
 * The sidebar tracks active subagents in real time using `stream.subagents()`,
 * a Signal<Map<string, SubagentStreamRef>> of running child graph executions.
 *
 * Key integration points:
 * - `stream.subagents()` returns a Map<string, SubagentStreamRef> of active subagents
 * - Each entry has a unique tool call ID (key) and a `status()` signal
 * - `subagentEntries` is a `computed()` signal derived from the map for template iteration
 */
@Component({
  selector: 'app-subgraphs',
  standalone: true,
  imports: [ChatComponent, ExampleChatLayoutComponent],
  template: `
    <example-chat-layout>
      <chat main [agent]="agent" class="flex-1 min-w-0" />
      <div sidebar class="p-4 space-y-2"
           style="background: var(--chat-bg, #171717); color: var(--chat-text, #e0e0e0);">
        <h3 class="text-xs font-semibold uppercase tracking-wide"
            style="color: var(--chat-text-muted, #777);">Subagents</h3>
        @if (subagentEntries().length === 0) {
          <p class="text-sm italic" style="color: var(--chat-text-muted, #777);">No subagents active</p>
        }
        @for (entry of subagentEntries(); track entry.id) {
          <div class="flex items-center gap-2 text-sm py-1">
            <span class="w-2 h-2 rounded-full shrink-0"
                  [style.background]="entry.status === 'complete' ? 'var(--chat-success, #4ade80)' : entry.status === 'error' ? 'var(--chat-error-text, #f87171)' : 'var(--chat-warning-text, #fbbf24)'">
            </span>
            <span class="font-mono text-xs truncate" style="color: var(--chat-text, #e0e0e0);">{{ entry.id }}</span>
            <span class="text-xs ml-auto" style="color: var(--chat-text-muted, #777);">{{ entry.msgCount }} msgs</span>
          </div>
        }
      </div>
    </example-chat-layout>
  `,
})
export class SubgraphsComponent {
  /**
   * The streaming resource that tracks subgraph (child agent) activity.
   *
   * `stream.subagents()` is a Signal<Map<string, SubagentStreamRef>> that updates
   * as the parent orchestrator dispatches work to child subgraphs.
   */
  protected readonly agent = agent({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
  });

  /**
   * Derived signal: converts the subagents Map to an array for template iteration.
   * Using `computed()` ensures the template re-renders whenever the Map changes.
   */
  protected readonly subagentEntries = computed(() => {
    const map = this.agent.subagents()!
    return Array.from(map.entries()).map(([id, ref]) => ({
      id,
      status: ref.status(),
      msgCount: ref.messages().length,
    }));
  });
}
