import { Component, computed } from '@angular/core';
import { ChatComponent } from '@threadplane/chat';
import { ExampleChatLayoutComponent } from '@threadplane/example-layouts';
import { injectAgent } from '@threadplane/langgraph';

/**
 * Delegation status derived from matching tool calls with tool result messages.
 */
interface Delegation {
  /** Tool call ID used to track request/response pairing. */
  id: string;
  /** Name of the delegated agent (tool name). */
  agent: string;
  /** Execution status: running until a matching tool result arrives. */
  status: 'running' | 'complete' | 'error';
  /** Human-readable status text. */
  statusText: string;
}

/**
 * SubagentsComponent demonstrates the Deep Agents subagent delegation pattern.
 *
 * The orchestrator agent receives a task and delegates subtasks to specialist
 * subagents via tool calls. The sidebar tracks each delegation by scanning
 * `stream.messages()` for AI tool_calls and matching ToolMessage results.
 */
@Component({
  selector: 'app-subagents',
  standalone: true,
  imports: [ChatComponent, ExampleChatLayoutComponent],
  template: `
    <example-chat-layout sidebarWidth="18rem">
      <chat main [agent]="agent" class="flex-1 min-w-0" />
      <aside sidebar class="panel">
        <h3 class="cap">Delegations</h3>
        @if (delegations().length === 0) {
          <p class="empty">No delegations yet</p>
        }
        @for (d of delegations(); track d.id) {
          <div class="delegation">
            <span class="dot"
                  [class.dot--running]="d.status === 'running'"
                  [class.dot--complete]="d.status === 'complete'"
                  [class.dot--error]="d.status === 'error'">
            </span>
            <span class="agent">{{ d.agent }}</span>
            <span class="status">{{ d.statusText }}</span>
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

    .delegation {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.25rem 0;
      font-size: var(--tplane-chat-font-size-sm);
    }

    .dot {
      flex: 0 0 auto;
      width: 0.5rem;
      height: 0.5rem;
      border-radius: var(--tplane-chat-radius-launcher);
    }

    .dot--running {
      background: var(--tplane-chat-warning-text);
    }

    .dot--complete {
      background: var(--tplane-chat-success);
    }

    .dot--error {
      background: var(--tplane-chat-error-text);
    }

    .agent {
      min-width: 0;
      overflow: hidden;
      color: var(--tplane-chat-text);
      font-weight: 600;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .status {
      margin-left: auto;
      color: var(--tplane-chat-text-muted);
      font-size: var(--tplane-chat-font-size-xs);
    }
  `],
})
export class SubagentsComponent {
  /**
   * The streaming resource connected to the subagents orchestrator graph.
   */
  protected readonly agent = injectAgent();

  /**
   * Reactive delegation list derived from messages.
   *
   * Scans all messages for AI tool_calls, then checks for matching
   * ToolMessage results (by tool_call_id) to determine completion status.
   */
  protected readonly delegations = computed<Delegation[]>(() => {
    const msgs = this.agent.langGraphMessages();
    const toolResultIds = new Set<string>();
    const errorResultIds = new Set<string>();

    // Collect all tool result message IDs and detect errors
    for (const msg of msgs) {
      const type = typeof msg._getType === 'function' ? msg._getType() : (msg as any).type;
      if (type === 'tool') {
        const toolCallId = (msg as any).tool_call_id;
        if (toolCallId) {
          toolResultIds.add(toolCallId);
          const status = (msg as any).status;
          if (status === 'error') {
            errorResultIds.add(toolCallId);
          }
        }
      }
    }

    // Extract tool calls from AI messages and match with results
    const delegations: Delegation[] = [];
    for (const msg of msgs) {
      const type = typeof msg._getType === 'function' ? msg._getType() : (msg as any).type;
      if (type === 'ai') {
        const toolCalls = (msg as any).tool_calls as Array<{ id: string; name: string }> | undefined;
        if (toolCalls?.length) {
          for (const tc of toolCalls) {
            const isError = errorResultIds.has(tc.id);
            const isComplete = toolResultIds.has(tc.id);
            delegations.push({
              id: tc.id,
              agent: tc.name,
              status: isError ? 'error' : isComplete ? 'complete' : 'running',
              statusText: isError ? 'error' : isComplete ? 'done' : 'running',
            });
          }
        }
      }
    }

    return delegations;
  });
}
