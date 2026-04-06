import { Component } from '@angular/core';
import { ChatComponent } from '@cacheplane/chat';
import { streamResource } from '@cacheplane/stream-resource';
import { environment } from '../environments/environment';

/**
 * SandboxesComponent demonstrates a coding agent that executes Python code.
 *
 * The agent writes and runs code snippets to solve problems using a
 * `run_code` tool.
 */
@Component({
  selector: 'app-sandboxes',
  standalone: true,
  imports: [ChatComponent],
  template: `<chat [ref]="stream" class="block h-screen" />`,
})
export class SandboxesComponent {
  protected readonly stream = streamResource({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
  });
}
