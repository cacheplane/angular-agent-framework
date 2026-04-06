// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component } from '@angular/core';
import { ChatComponent } from '@cacheplane/chat';
import { streamResource } from '@cacheplane/stream-resource';
import { environment } from '../environments/environment';

/**
 * Deployment-runtime demo — production deployment patterns.
 *
 * Shows how streamResource() connects to a deployed LangGraph Cloud
 * instance using environment-specific API URLs and assistant IDs.
 */
@Component({
  selector: 'app-deployment-runtime',
  standalone: true,
  imports: [ChatComponent],
  template: `<chat [ref]="stream" class="block h-screen" />`,
})
export class DeploymentRuntimeComponent {
  protected readonly stream = streamResource({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.deploymentRuntimeAssistantId,
  });
}
