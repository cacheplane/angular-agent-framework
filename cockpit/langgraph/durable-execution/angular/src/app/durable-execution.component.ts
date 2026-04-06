import { Component } from '@angular/core';
import { LegacyChatComponent } from '@cacheplane/chat';
import { streamResource } from '@cacheplane/stream-resource';
import { environment } from '../environments/environment';

/**
 * DurableExecutionComponent demonstrates fault-tolerant multi-step execution
 * with `streamResource()`.
 *
 * This example shows how a graph checkpoints at each node, enabling it to
 * resume after failures. The sidebar shows execution status in real time:
 * - `stream.status()` as a badge (idle/loading/resolved/error)
 * - `stream.hasValue()` indicator for received data
 * - A "Retry" button that calls `stream.reload()` when `stream.error()` is set
 *
 * The backend processes each request through three nodes:
 *   analyze → plan → generate
 * Each node updates `state.step` so the UI can track progress.
 */
@Component({
  selector: 'app-durable-execution',
  standalone: true,
  imports: [LegacyChatComponent],
  template: `
    <cp-chat
      [messages]="stream.messages()"
      [isLoading]="stream.isLoading()"
      [error]="stream.error()"
      (sendMessage)="send($event)">
      <ng-template #sidebar>
        <h3 style="font-size: 0.8rem; font-weight: 600; margin-bottom: 0.75rem; color: #1a1a2e;">Execution Status</h3>

        <div style="margin-bottom: 0.75rem;">
          <span style="font-size: 0.7rem; font-weight: 500; color: #555770; text-transform: uppercase; letter-spacing: 0.05em;">Status</span>
          <div style="margin-top: 4px;">
            <span [style.background]="statusBadgeColor()" style="display: inline-block; padding: 3px 8px; border-radius: 10px; font-size: 0.72rem; font-weight: 600; color: #fff; font-family: monospace;">
              {{ stream.status() }}
            </span>
          </div>
        </div>

        <div style="margin-bottom: 0.75rem;">
          <span style="font-size: 0.7rem; font-weight: 500; color: #555770; text-transform: uppercase; letter-spacing: 0.05em;">Data Received</span>
          <div style="margin-top: 4px; display: flex; align-items: center; gap: 6px;">
            <span [style.background]="stream.hasValue() ? '#22c55e' : '#d1d5db'"
                  style="display: inline-block; width: 10px; height: 10px; border-radius: 50%;"></span>
            <span style="font-size: 0.8rem; color: #1a1a2e;">{{ stream.hasValue() ? 'Yes' : 'No' }}</span>
          </div>
        </div>

        @if (stream.error()) {
          <div style="margin-top: 0.75rem; padding: 8px; background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); border-radius: 6px;">
            <div style="font-size: 0.72rem; color: #dc2626; margin-bottom: 6px; font-weight: 600;">Execution Failed</div>
            <button (click)="stream.reload()"
                    style="width: 100%; padding: 6px 10px; background: #dc2626; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 0.75rem; font-weight: 600;">
              Retry
            </button>
          </div>
        }
      </ng-template>
    </cp-chat>
  `,
})
export class DurableExecutionComponent {
  /**
   * The streaming resource backing this durable-execution demo.
   *
   * The graph runs three nodes (analyze → plan → generate), checkpointing
   * after each one. If the graph fails partway through, `stream.reload()`
   * re-submits the last input so the run can resume from the last checkpoint.
   */
  protected readonly stream = streamResource({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
  });

  /**
   * Submit a message to be processed through the multi-node graph.
   */
  send(text: string): void {
    this.stream.submit({ messages: [{ role: 'human', content: text }] });
  }

  /**
   * Returns a colour for the status badge based on the current stream status.
   */
  statusBadgeColor(): string {
    switch (this.stream.status()) {
      case 'loading':
      case 'reloading': return '#2563eb';
      case 'resolved':  return '#16a34a';
      case 'error':     return '#dc2626';
      default:          return '#6b7280';
    }
  }
}
