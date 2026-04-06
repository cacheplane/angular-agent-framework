// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
/**
 * PersistenceComponent demonstrates LangGraph's thread-based persistence.
 *
 * Each conversation is stored as a "thread" on the LangGraph backend. Threads
 * survive page refreshes and can be resumed at any time by switching back to
 * them. This example tracks created threads in a local signal and lets the
 * user switch between them via the chat sidebar.
 *
 * Key integration points:
 * - `threadId: null` — lets streamResource auto-create a new thread on first submit
 * - `onThreadId` — called once the backend assigns a thread ID; used here to
 *   add the thread to the local list and set it as active
 * - `stream.switchThread(id)` — reconnects the resource to an existing thread
 */
import { Component, signal } from '@angular/core';
import { ChatComponent, type Thread } from '@cacheplane/chat';
import { streamResource } from '@cacheplane/stream-resource';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-persistence',
  standalone: true,
  imports: [ChatComponent],
  template: `
    <chat
      [ref]="stream"
      [threads]="threads()"
      [activeThreadId]="activeThreadId()"
      (threadSelected)="onThreadSelected($event)"
      class="block h-screen"
    />
  `,
})
export class PersistenceComponent {
  protected readonly threads = signal<Thread[]>([]);
  protected readonly activeThreadId = signal<string>('');

  protected readonly stream = streamResource({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
    threadId: null,
    onThreadId: (id: string) => this.trackThread(id),
  });

  private trackThread(id: string): void {
    this.activeThreadId.set(id);
    if (!this.threads().find(t => t.id === id)) {
      this.threads.update(list => [...list, { id }]);
    }
  }

  protected onThreadSelected(id: string): void {
    this.activeThreadId.set(id);
    this.stream.switchThread(id);
  }
}
