// SPDX-License-Identifier: MIT
import { Component } from '@angular/core';
import { ChatComponent } from '@cacheplane/chat';
import { agent, toAgent } from '@cacheplane/langgraph';
import { ExampleChatLayoutComponent } from '@cacheplane/example-layouts';
import { environment } from '../environments/environment';

/**
 * Streaming demo — simplest possible @cacheplane/chat integration.
 *
 * Creates a agent ref and passes it to the prebuilt <chat>
 * composition. The composition handles message rendering, input, typing
 * indicator, and error display internally.
 */
@Component({
  selector: 'app-streaming',
  standalone: true,
  imports: [ChatComponent, ExampleChatLayoutComponent],
  template: `
    <example-chat-layout>
      <chat main [agent]="chatAgent" class="flex-1 min-w-0" />
    </example-chat-layout>
  `,
})
export class StreamingComponent {
  protected readonly stream = agent({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
  });
  protected readonly chatAgent = toAgent(this.stream);
}
