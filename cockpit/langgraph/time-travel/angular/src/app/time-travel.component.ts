import { Component } from '@angular/core';
import { ChatComponent } from '@cacheplane/chat';
import { streamResource } from '@cacheplane/stream-resource';
import { environment } from '../environments/environment';

/**
 * TimeTravelComponent demonstrates replaying and branching conversation history.
 *
 * Key integration points:
 * - `stream.history()` -- array of ThreadState snapshots
 * - `stream.branch()` -- current branch identifier
 * - `stream.setBranch(id)` -- switch to a different checkpoint
 */
@Component({
  selector: 'app-time-travel',
  standalone: true,
  imports: [ChatComponent],
  template: `<chat [ref]="stream" class="block h-screen" />`,
})
export class TimeTravelComponent {
  protected readonly stream = streamResource({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
  });
}
