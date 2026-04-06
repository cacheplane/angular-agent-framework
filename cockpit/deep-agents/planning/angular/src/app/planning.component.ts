// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component, computed } from '@angular/core';
import { ChatDebugComponent } from '@cacheplane/chat';
import { streamResource } from '@cacheplane/stream-resource';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-planning',
  standalone: true,
  imports: [ChatDebugComponent],
  template: `
    <div class="flex h-screen">
      <chat-debug [ref]="stream" class="flex-1 min-w-0" />
      <aside class="w-72 shrink-0 border-l overflow-y-auto p-4 space-y-2"
             style="border-color: var(--chat-border, #333); background: var(--chat-bg, #171717); color: var(--chat-text, #e0e0e0);">
        <h3 class="text-xs font-semibold uppercase tracking-wide mb-3"
            style="color: var(--chat-text-muted, #777);">Plan Steps</h3>
        @if (planSteps().length === 0) {
          <p class="text-sm italic" style="color: var(--chat-text-muted, #777);">No plan steps yet. Ask the agent to plan something.</p>
        }
        @for (step of planSteps(); track $index) {
          <div class="flex items-start gap-2 text-sm py-1">
            <span class="shrink-0 mt-0.5"
                  [style.color]="step.status === 'complete' ? 'var(--chat-accent, #4ade80)' : 'var(--chat-text-muted, #777)'">
              {{ step.status === 'complete' ? '✓' : '○' }}
            </span>
            <span [style.text-decoration]="step.status === 'complete' ? 'line-through' : 'none'"
                  style="color: var(--chat-text, #e0e0e0);">
              {{ step.title }}
            </span>
          </div>
        }
      </aside>
    </div>
  `,
})
export class PlanningComponent {
  protected readonly stream = streamResource({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
  });

  protected readonly planSteps = computed(() => {
    const val = this.stream.value() as Record<string, unknown>;
    const plan = val?.['plan'];
    return Array.isArray(plan) ? plan as { title: string; status: string }[] : [];
  });
}
