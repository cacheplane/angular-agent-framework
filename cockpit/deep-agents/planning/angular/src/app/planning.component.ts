import { Component, computed } from '@angular/core';
import { ChatComponent } from '@cacheplane/chat';
import { streamResource } from '@cacheplane/stream-resource';
import { environment } from '../environments/environment';

interface PlanStep {
  title: string;
  status: 'pending' | 'running' | 'complete';
}

/**
 * PlanningComponent demonstrates agent task decomposition.
 *
 * The agent receives a complex task, breaks it into ordered steps,
 * and executes them. The sidebar shows each step's status in real time.
 *
 * Key integration points:
 * - `stream.value()` contains the plan state with step list
 * - `computed()` derives the plan steps for the sidebar
 * - Steps update reactively as the agent works through them
 */
@Component({
  selector: 'app-planning',
  standalone: true,
  imports: [ChatComponent],
  template: `
    <cp-chat
      [messages]="stream.messages()"
      [isLoading]="stream.isLoading()"
      [error]="stream.error()"
      (sendMessage)="send($event)">
      <ng-template #sidebar>
        <h3 style="font-size: 0.8rem; font-weight: 600; margin-bottom: 0.75rem; color: #1a1a2e;">Task Plan</h3>
        @for (step of planSteps(); track $index) {
          <div style="display: flex; align-items: center; gap: 8px; padding: 6px 0; font-size: 0.8rem;">
            <span style="width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;"
                  [style.background]="step.status === 'complete' ? '#10b981' : step.status === 'running' ? '#004090' : '#d1d5db'"></span>
            <span [style.color]="step.status === 'complete' ? '#555770' : '#1a1a2e'"
                  [style.textDecoration]="step.status === 'complete' ? 'line-through' : 'none'">
              {{ step.title }}
            </span>
          </div>
        }
        @empty {
          <p style="color: #8b8fa3; font-size: 0.8rem;">Ask a complex question to see the plan.</p>
        }
      </ng-template>
    </cp-chat>
  `,
})
export class PlanningComponent {
  protected readonly stream = streamResource({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
  });

  planSteps = computed(() => {
    const val = this.stream.value() as { plan?: PlanStep[] } | undefined;
    return val?.plan ?? [];
  });

  send(text: string): void {
    this.stream.submit({ messages: [{ role: 'human', content: text }] });
  }
}
