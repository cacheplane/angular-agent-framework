// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component } from '@angular/core';
import { ChatComponent } from '@cacheplane/chat';
import { streamResource } from '@cacheplane/stream-resource';
import { environment } from '../environments/environment';

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
