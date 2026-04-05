// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component } from '@angular/core';
import { ChatComponent } from '@cacheplane/chat';
import { streamResource } from '@cacheplane/stream-resource';
import { environment } from '../environments/environment';

/**
 * Streaming demo — simplest possible @cacheplane/chat integration.
 *
 * Creates a streamResource ref and passes it to the prebuilt <chat-ui>
 * composition. The composition handles message rendering, input, typing
 * indicator, and error display internally.
 */
@Component({
  selector: 'app-streaming',
  standalone: true,
  imports: [ChatComponent],
  template: `<chat-ui [ref]="stream" class="block h-screen" />`,
})
export class StreamingComponent {
  protected readonly stream = streamResource({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
  });
}
