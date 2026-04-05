import { Component } from '@angular/core';
import { ChatComponent } from '@cacheplane/chat';
import { streamResource } from '@cacheplane/stream-resource';
import { environment } from '../environments/environment';

/**
 * PersistenceComponent demonstrates thread persistence with `streamResource()`.
 *
 * This example shows how conversations persist across browser refreshes.
 * Each thread has a unique ID that can be stored and resumed later.
 * Use `stream.switchThread(id)` to load a previous conversation,
 * or `stream.switchThread(null)` to start fresh.
 *
 * Key integration points:
 * - `onThreadId` callback captures new thread IDs for storage
 * - `stream.switchThread(id)` resumes a previous conversation
 * - `stream.messages()` loads the full history when switching threads
 */
@Component({
  selector: 'app-persistence',
  standalone: true,
  imports: [ChatComponent],
  template: `
    <cp-chat
      [messages]="stream.messages()"
      [isLoading]="stream.isLoading()"
      [error]="stream.error()"
      (sendMessage)="send($event)">
      <ng-template #sidebar>
        <h3 style="font-size: 0.8rem; font-weight: 600; margin-bottom: 0.75rem; color: #1a1a2e;">Threads</h3>
        @for (id of threadIds; track id) {
          <button (click)="selectThread(id)"
                  [style.color]="id === currentThreadId ? '#004090' : '#555770'"
                  [style.background]="id === currentThreadId ? 'rgba(0,64,144,0.06)' : 'transparent'"
                  style="display: block; width: 100%; text-align: left; padding: 6px 8px; border: none; cursor: pointer; font-size: 0.8rem; border-radius: 4px; font-family: monospace; margin-bottom: 2px;">
            {{ id.substring(0, 12) }}...
          </button>
        }
        <button (click)="newThread()"
                style="margin-top: 0.75rem; padding: 6px 10px; border: 1px solid rgba(0,64,144,0.15); border-radius: 6px; background: none; cursor: pointer; font-size: 0.75rem; color: #004090; width: 100%;">
          + New Thread
        </button>
      </ng-template>
    </cp-chat>
  `,
})
export class PersistenceComponent {
  /**
   * The streaming resource with thread persistence.
   *
   * The `onThreadId` callback fires when a new thread is created,
   * allowing us to track thread IDs for the sidebar picker.
   */
  protected readonly stream = streamResource({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
    onThreadId: (id: string) => {
      this.currentThreadId = id;
      if (!this.threadIds.includes(id)) this.threadIds.push(id);
    },
  });

  threadIds: string[] = [];
  currentThreadId = '';

  /**
   * Submit a message to the current thread.
   */
  send(text: string): void {
    this.stream.submit({ messages: [{ role: 'human', content: text }] });
  }

  /**
   * Switch to an existing thread, loading its full message history.
   */
  selectThread(id: string): void {
    this.currentThreadId = id;
    this.stream.switchThread(id);
  }

  /**
   * Start a new conversation thread.
   */
  newThread(): void {
    this.currentThreadId = '';
    this.stream.switchThread(null);
  }
}
