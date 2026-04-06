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
  template: `<chat [ref]="stream" class="block h-screen" />`,
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
  });
}
