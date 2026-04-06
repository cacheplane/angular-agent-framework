import { Component, computed } from '@angular/core';
import { LegacyChatComponent } from '@cacheplane/chat';
import { streamResource } from '@cacheplane/stream-resource';
import { environment } from '../environments/environment';

/**
 * SubgraphsComponent demonstrates nested agent delegation with `streamResource()`.
 *
 * This example shows how a parent orchestrator delegates tasks to child subgraphs.
 * The sidebar tracks active subagents in real time using `stream.subagents()`,
 * a Map of running child graph executions and their current status.
 *
 * Key integration points:
 * - `stream.subagents()` returns a Map<string, SubagentStreamRef> of active subagents
 * - Each entry has a unique run ID (key) and a `status()` signal ('running' | 'done' | 'error')
 * - `subagentEntries` is a `computed()` signal derived from the map for iteration in the template
 */
@Component({
  selector: 'app-subgraphs',
  standalone: true,
  imports: [LegacyChatComponent],
  template: `
    <cp-chat
      [messages]="stream.messages()"
      [isLoading]="stream.isLoading()"
      [error]="stream.error()"
      (sendMessage)="send($event)">
      <ng-template #sidebar>
        <h3 style="font-size: 0.8rem; font-weight: 600; margin-bottom: 0.75rem; color: #1a1a2e;">Subagents</h3>
        @for (entry of subagentEntries(); track entry[0]) {
          <div style="font-size: 0.75rem; font-family: monospace; padding: 4px 0; color: #555770;">
            {{ entry[0].substring(0, 8) }}: {{ entry[1].status() }}
          </div>
        }
        @empty {
          <p style="font-size: 0.75rem; color: #9ba0b4; margin: 0;">No active subagents</p>
        }
      </ng-template>
    </cp-chat>
  `,
})
export class SubgraphsComponent {
  /**
   * The streaming resource that tracks subgraph (child agent) activity.
   *
   * `stream.subagents()` is a Signal<Map<string, SubagentStreamRef>> that updates
   * as the parent orchestrator dispatches work to child subgraphs.
   */
  protected readonly stream = streamResource({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
  });

  /**
   * Derived signal: converts the subagents Map to an array of entries for template iteration.
   * Using `computed()` ensures the template re-renders whenever the Map changes.
   */
  subagentEntries = computed(() => Array.from(this.stream.subagents().entries()));

  /**
   * Submit a message to the orchestrator graph.
   */
  send(text: string): void {
    this.stream.submit({ messages: [{ role: 'human', content: text }] });
  }
}
