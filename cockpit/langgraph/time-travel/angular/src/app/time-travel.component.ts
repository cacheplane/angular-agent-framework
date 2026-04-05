import { Component } from '@angular/core';
import { ChatComponent } from '@cacheplane/chat';
import { streamResource } from '@cacheplane/stream-resource';
import { environment } from '../environments/environment';

/**
 * TimeTravelComponent demonstrates replaying and branching conversation history.
 *
 * Key integration points:
 * - `stream.history()` — array of ThreadState snapshots
 * - `stream.branch()` — current branch identifier
 * - `stream.setBranch(id)` — switch to a different checkpoint
 */
@Component({
  selector: 'app-time-travel',
  standalone: true,
  imports: [ChatComponent],
  template: `
    <cp-chat
      [messages]="stream.messages()"
      [isLoading]="stream.isLoading()"
      [error]="stream.error()"
      (sendMessage)="send($event)">
      <ng-template #sidebar>
        <h3 style="font-size: 0.8rem; font-weight: 600; margin-bottom: 0.75rem; color: #1a1a2e;">History</h3>
        @for (state of stream.history(); track $index) {
          <button
            (click)="selectCheckpoint(state)"
            [style.color]="state.checkpoint_id === stream.branch() ? '#004090' : '#555770'"
            [style.background]="state.checkpoint_id === stream.branch() ? 'rgba(0,64,144,0.06)' : 'transparent'"
            style="display: block; width: 100%; text-align: left; padding: 6px 8px; border: none; cursor: pointer; font-size: 0.75rem; border-radius: 4px; font-family: monospace; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            {{ formatCheckpoint(state) }}
          </button>
        }
        @if (stream.history().length === 0) {
          <p style="font-size: 0.75rem; color: #888; margin: 0;">No history yet. Send a message to begin.</p>
        }
      </ng-template>
    </cp-chat>
  `,
})
export class TimeTravelComponent {
  /**
   * The streaming resource with checkpointing enabled.
   *
   * `stream.history()` provides an array of ThreadState snapshots for
   * the current thread. `stream.branch()` tracks the active checkpoint.
   * Call `stream.setBranch(checkpointId)` to replay from a past state.
   */
  protected readonly stream = streamResource({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
  });

  /**
   * Submit a message to the current thread.
   */
  send(text: string): void {
    this.stream.submit({ messages: [{ role: 'human', content: text }] });
  }

  /**
   * Branch the conversation from the selected checkpoint.
   * After calling setBranch, the next submit will fork from that point.
   */
  selectCheckpoint(state: { checkpoint_id?: string }): void {
    if (state.checkpoint_id) {
      this.stream.setBranch(state.checkpoint_id);
    }
  }

  /**
   * Format a checkpoint for display in the sidebar.
   */
  formatCheckpoint(state: { checkpoint_id?: string; created_at?: string }): string {
    const id = state.checkpoint_id ?? 'unknown';
    const short = id.substring(0, 8);
    if (state.created_at) {
      const ts = new Date(state.created_at).toLocaleTimeString();
      return `${short}... @ ${ts}`;
    }
    return `${short}...`;
  }
}
