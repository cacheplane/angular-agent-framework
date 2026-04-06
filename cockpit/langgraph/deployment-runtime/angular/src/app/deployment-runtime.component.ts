import { Component } from '@angular/core';
import { LegacyChatComponent } from '@cacheplane/chat';
import { streamResource } from '@cacheplane/stream-resource';
import { environment } from '../environments/environment';

/**
 * DeploymentRuntimeComponent demonstrates production deployment patterns.
 *
 * Shows how streamResource() connects to a deployed LangGraph Cloud
 * instance. The sidebar displays connection info and deployment status.
 */
@Component({
  selector: 'app-deployment-runtime',
  standalone: true,
  imports: [LegacyChatComponent],
  template: `
    <cp-chat
      [messages]="stream.messages()"
      [isLoading]="stream.isLoading()"
      [error]="stream.error()"
      (sendMessage)="send($event)">
      <ng-template #sidebar>
        <h3 style="font-size: 0.8rem; font-weight: 600; margin-bottom: 0.75rem; color: #1a1a2e;">Deployment</h3>

        <div style="font-size: 0.75rem; margin-bottom: 0.75rem;">
          <div style="color: #888; margin-bottom: 2px;">API URL</div>
          <div style="font-family: monospace; color: #555770; word-break: break-all;">
            {{ apiUrl }}
          </div>
        </div>

        <div style="font-size: 0.75rem; margin-bottom: 0.75rem;">
          <div style="color: #888; margin-bottom: 2px;">Assistant ID</div>
          <div style="font-family: monospace; color: #555770;">
            {{ assistantId }}
          </div>
        </div>

        <div style="font-size: 0.75rem; margin-bottom: 0.75rem;">
          <div style="color: #888; margin-bottom: 4px;">Status</div>
          <span [style.background]="statusBadgeBackground()"
                [style.color]="statusBadgeColor()"
                style="display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 0.7rem; font-weight: 600;">
            {{ stream.status() }}
          </span>
        </div>

        @if (currentThreadId) {
          <div style="font-size: 0.75rem; margin-top: 0.75rem;">
            <div style="color: #888; margin-bottom: 2px;">Thread ID</div>
            <div style="font-family: monospace; color: #555770; word-break: break-all;">
              {{ currentThreadId }}
            </div>
          </div>
        }
      </ng-template>
    </cp-chat>
  `,
})
export class DeploymentRuntimeComponent {
  protected readonly stream = streamResource({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.deploymentRuntimeAssistantId,
    onThreadId: (id: string) => {
      this.currentThreadId = id;
    },
  });

  readonly apiUrl = environment.langGraphApiUrl;
  readonly assistantId = environment.deploymentRuntimeAssistantId;
  currentThreadId = '';

  send(text: string): void {
    this.stream.submit({ messages: [{ role: 'human', content: text }] });
  }

  statusBadgeBackground(): string {
    const status = this.stream.status();
    if (status === 'loading') return 'rgba(0,160,80,0.12)';
    if (status === 'error') return 'rgba(200,40,40,0.1)';
    return 'rgba(0,64,144,0.08)';
  }

  statusBadgeColor(): string {
    const status = this.stream.status();
    if (status === 'loading') return '#00802a';
    if (status === 'error') return '#c82828';
    return '#004090';
  }
}
