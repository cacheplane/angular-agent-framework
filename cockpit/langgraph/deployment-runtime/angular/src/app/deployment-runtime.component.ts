// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component } from '@angular/core';
import { ChatComponent } from '@cacheplane/chat';
import { agent, toChatAgent } from '@cacheplane/langgraph';
import { ExampleChatLayoutComponent } from '@cacheplane/example-layouts';
import { environment } from '../environments/environment';

/**
 * Deployment-runtime demo — production deployment patterns.
 *
 * Shows how agent() connects to a deployed LangGraph Cloud
 * instance using environment-specific API URLs and assistant IDs.
 */
@Component({
  selector: 'app-deployment-runtime',
  standalone: true,
  imports: [ChatComponent, ExampleChatLayoutComponent],
  template: `
    <example-chat-layout>
      <chat main [agent]="chatAgent" class="flex-1 min-w-0" />
    </example-chat-layout>
  `,
})
export class DeploymentRuntimeComponent {
  protected readonly stream = agent({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.deploymentRuntimeAssistantId,
  });
  protected readonly chatAgent = toChatAgent(this.stream);
}
