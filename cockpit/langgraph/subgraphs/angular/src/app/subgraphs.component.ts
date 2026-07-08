// SPDX-License-Identifier: MIT
import { Component, computed } from '@angular/core';
import { ChatComponent } from '@threadplane/chat';
import { injectAgent } from '@threadplane/langgraph';
import { ExampleChatLayoutComponent } from '@threadplane/example-layouts';

/**
 * SubgraphsComponent demonstrates nested agent delegation with `injectAgent()`.
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
  styles: `
    :host {
      --st-done: #2ea567;
      --st-active: #e0a850;
      --st-error: #e0645a;
    }
    .panel {
      padding: 1rem;
    }
    .cap {
      margin-bottom: 1rem;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--ds-text-muted);
    }
    .empty {
      font-size: 13px;
      font-style: italic;
      color: var(--ds-text-muted);
    }
    .row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 6px 0;
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 999px;
      flex-shrink: 0;
      background: var(--ds-text-muted);
    }
    .dot--complete { background: var(--st-done); }
    .dot--error { background: var(--st-error); }
    .dot--running { background: var(--st-active); }
    .id {
      font-family: var(--ds-font-mono);
      font-size: 11px;
      color: var(--ds-text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      min-width: 0;
    }
    .count {
      margin-left: auto;
      font-size: 11px;
      color: var(--ds-text-muted);
      flex-shrink: 0;
    }
  `,
  template: `
    <example-chat-layout>
      <chat main [agent]="agent" class="flex-1 min-w-0" />
      <div sidebar class="panel">
        <h3 class="cap">Subagents</h3>
        @if (subagentEntries().length === 0) {
          <p class="empty">No subagents active</p>
        }
        @for (entry of subagentEntries(); track entry.id) {
          <div class="row">
            <span class="dot"
                  [class.dot--complete]="entry.status === 'complete'"
                  [class.dot--error]="entry.status === 'error'"
                  [class.dot--running]="entry.status !== 'complete' && entry.status !== 'error'"></span>
            <span class="id">{{ entry.id }}</span>
            <span class="count">{{ entry.msgCount }} msgs</span>
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
  protected readonly agent = injectAgent();

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
