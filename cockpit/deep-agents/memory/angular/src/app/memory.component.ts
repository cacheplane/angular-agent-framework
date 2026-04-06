import { Component } from '@angular/core';
import { ChatComponent } from '@cacheplane/chat';
import { streamResource } from '@cacheplane/stream-resource';
import { environment } from '../environments/environment';

/**
 * MemoryComponent demonstrates persistent agent memory across sessions.
 *
 * The agent extracts facts about the user from each conversation turn
 * and stores them in `agent_memory` state.
 */
@Component({
  selector: 'app-da-memory',
  standalone: true,
  imports: [ChatComponent],
  template: `<chat [ref]="stream" class="block h-screen" />`,
})
export class MemoryComponent {
  protected readonly stream = streamResource({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
  });
}
