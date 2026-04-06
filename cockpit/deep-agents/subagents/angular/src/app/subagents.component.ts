import { Component, computed } from '@angular/core';
import { ChatComponent } from '@cacheplane/chat';
import { streamResource } from '@cacheplane/stream-resource';
import { environment } from '../environments/environment';

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
  imports: [ChatComponent],
  template: `
    <div class="flex h-screen">
      <chat [ref]="stream" class="flex-1 min-w-0" />
      <aside class="w-72 shrink-0 border-l overflow-y-auto p-4 space-y-2"
             style="border-color: var(--chat-border, #333); background: var(--chat-bg, #171717); color: var(--chat-text, #e0e0e0);">
        <h3 class="text-xs font-semibold uppercase tracking-wide"
            style="color: var(--chat-text-muted, #777);">Delegations</h3>
        @if (delegations().length === 0) {
          <p class="text-sm italic" style="color: var(--chat-text-muted, #777);">No delegations yet</p>
        }
        @for (d of delegations(); track d.id) {
          <div class="flex items-center gap-2 text-sm py-1">
            <span class="w-2 h-2 rounded-full shrink-0"
                  [style.background]="d.status === 'complete' ? 'var(--chat-success, #4ade80)' : d.status === 'error' ? 'var(--chat-error-text, #f87171)' : 'var(--chat-warning-text, #fbbf24)'">
            </span>
            <span class="font-medium truncate" style="color: var(--chat-text, #e0e0e0);">{{ d.agent }}</span>
            <span class="text-xs ml-auto" style="color: var(--chat-text-muted, #777);">{{ d.statusText }}</span>
          </div>
        }
      </aside>
    </div>
  `,
})
export class SubagentsComponent {
  /**
   * The streaming resource connected to the subagents orchestrator graph.
   */
  protected readonly stream = streamResource({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
  });

  /**
   * Reactive delegation list derived from messages.
   *
   * Scans all messages for AI tool_calls, then checks for matching
   * ToolMessage results (by tool_call_id) to determine completion status.
   */
  protected readonly delegations = computed<Delegation[]>(() => {
    const msgs = this.stream.messages();
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
