// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component, inject } from '@angular/core';
import { ChatComponent } from '@cacheplane/chat';
import { AG_UI_AGENT } from '@cacheplane/ag-ui';
import { ExampleChatLayoutComponent } from '@cacheplane/example-layouts';

/**
 * Streaming demo — simplest possible @cacheplane/chat integration with AG-UI.
 *
 * Injects the AG_UI_AGENT token (provided by provideAgUiAgent) and passes it
 * to the prebuilt <chat> composition. The composition handles message rendering,
 * input, typing indicator, and error display internally.
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
  protected readonly agent = inject(AG_UI_AGENT);
}
