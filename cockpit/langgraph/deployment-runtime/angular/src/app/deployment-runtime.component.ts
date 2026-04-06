import { Component, signal } from '@angular/core';
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
        <h3 style="font-size: 0.8rem; font-weight: 600; margin-bottom: 0.75rem; color: var(--chat-text, #e0e0e0);">Deployment</h3>

        <div style="font-size: 0.75rem; margin-bottom: 0.75rem;">
          <div style="color: var(--chat-text-muted, #777); margin-bottom: 2px;">API URL</div>
          <div style="font-family: monospace; color: var(--chat-text, #e0e0e0); word-break: break-all;">
            {{ apiUrl }}
          </div>
        </div>

        <div style="font-size: 0.75rem; margin-bottom: 0.75rem;">
          <div style="color: var(--chat-text-muted, #777); margin-bottom: 2px;">Assistant ID</div>
          <div style="font-family: monospace; color: var(--chat-text, #e0e0e0);">
            {{ assistantId }}
          </div>
        </div>

        <div style="font-size: 0.75rem; margin-bottom: 0.75rem;">
          <div style="color: var(--chat-text-muted, #777); margin-bottom: 4px;">Status</div>
          <span [style.background]="statusBadgeBackground()"
                [style.color]="statusBadgeColor()"
                style="display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 0.7rem; font-weight: 600;">
            {{ stream.status() }}
          </span>
        </div>

        @if (currentThreadId()) {
          <div style="font-size: 0.75rem; margin-top: 0.75rem;">
            <div style="color: var(--chat-text-muted, #777); margin-bottom: 2px;">Thread ID</div>
            <div style="font-family: monospace; color: var(--chat-text, #e0e0e0); word-break: break-all;">
              {{ currentThreadId() }}
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
      this.currentThreadId.set(id);
    },
  });

  protected readonly apiUrl = environment.langGraphApiUrl;
  protected readonly assistantId = environment.deploymentRuntimeAssistantId;
  protected readonly currentThreadId = signal('');

  send(text: string): void {
    this.stream.submit({ messages: [{ role: 'human', content: text }] });
  }

  statusBadgeBackground(): string {
    const status = this.stream.status();
    if (status === 'loading') return 'var(--chat-success-bg, rgba(0,160,80,0.12))';
    if (status === 'error') return 'var(--chat-error-bg, rgba(200,40,40,0.1))';
    return 'var(--chat-accent-bg, rgba(0,64,144,0.08))';
  }

  statusBadgeColor(): string {
    const status = this.stream.status();
    if (status === 'loading') return 'var(--chat-success-text, #4ade80)';
    if (status === 'error') return 'var(--chat-error-text, #f87171)';
    return 'var(--chat-accent, #60a5fa)';
  }
}
