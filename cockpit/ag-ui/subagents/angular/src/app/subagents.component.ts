// SPDX-License-Identifier: MIT
import { Component } from '@angular/core';
import { ChatComponent } from '@threadplane/chat';
import { injectAgent } from '@threadplane/ag-ui';
import { ExampleChatLayoutComponent } from '@threadplane/example-layouts';

/**
 * Subagents demo — research-delegation over the AG-UI transport.
 *
 * Retrieves the agent with injectAgent() (provided by provideAgent /
 * provideFakeAgent) and passes it to the prebuilt <chat> composition. No
 * subagent-specific wiring is needed in the component: when the orchestrator
 * dispatches a `task` tool call, the backend converts the subagent_activity
 * CUSTOM events into native AG-UI ACTIVITY events, the @threadplane/ag-ui
 * reducer projects them onto `agent.subagents()`, and <chat> renders each
 * dispatch inline as a persistent `chat-subagent-card`.
 *
 * Demonstrates the chat-runtime decoupling: same <chat> composition as the
 * LangGraph cockpit, AG-UI runtime instead of LangGraph.
 */
@Component({
  selector: 'app-subagents',
  standalone: true,
  imports: [ChatComponent, ExampleChatLayoutComponent],
  template: `
    <example-chat-layout>
      <chat main [agent]="agent" class="flex-1 min-w-0" />
    </example-chat-layout>
  `,
})
export class SubagentsComponent {
  protected readonly agent = injectAgent();
}
