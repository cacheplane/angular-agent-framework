import { Component } from '@angular/core';
import { ChatComponent } from '@cacheplane/chat';
import { streamResource } from '@cacheplane/stream-resource';
import { environment } from '../environments/environment';

/**
 * DurableExecutionComponent demonstrates fault-tolerant multi-step execution
 * with `streamResource()`.
 *
 * This example shows how a graph checkpoints at each node, enabling it to
 * resume after failures. The backend processes each request through three
 * nodes: analyze, plan, generate. Each node updates `state.step` so the
 * UI can track progress.
 */
@Component({
  selector: 'app-durable-execution',
  standalone: true,
  imports: [ChatComponent],
  template: `<chat [ref]="stream" class="block h-screen" />`,
})
export class DurableExecutionComponent {
  protected readonly stream = streamResource({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
  });
}
