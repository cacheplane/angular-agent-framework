// SPDX-License-Identifier: MIT
import { Component } from '@angular/core';
import { ChatComponent } from '@threadplane/chat';
import { injectAgent } from '@threadplane/ag-ui';
import { ExampleChatLayoutComponent } from '@threadplane/example-layouts';

/**
 * Streaming demo — simplest possible @threadplane/chat integration with AG-UI.
 *
 * Retrieves the agent with injectAgent() (provided by provideAgent /
 * provideFakeAgent) and passes it to the prebuilt <chat> composition. The
 * composition handles message rendering, input, typing indicator, and error
 * display internally.
 *
 * Demonstrates the chat-runtime decoupling: same <chat> composition as the
 * LangGraph cockpit, AG-UI runtime instead of LangGraph.
 */
@Component({
  selector: 'app-streaming',
  standalone: true,
  imports: [ChatComponent, ExampleChatLayoutComponent],
  template: `
    <example-chat-layout>
      <chat main [agent]="agent" class="flex-1 min-w-0" />
    </example-chat-layout>
  `,
})
export class StreamingComponent {
  protected readonly agent = injectAgent();
}
