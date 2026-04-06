// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
/**
 * DurableExecutionComponent demonstrates LangGraph's durable execution model.
 *
 * Unlike a stateless API call, a LangGraph graph persists its execution state
 * after every node. If the server restarts mid-run, the graph resumes from the
 * last completed node — this is "durable execution".
 *
 * This example visualises the pipeline steps (`analyze → plan → generate`) and
 * tracks which step the agent is currently executing via the `step` state key.
 * A retry button is shown when the stream enters an error state, demonstrating
 * how `stream.reload()` re-submits the last input to resume a failed run.
 */
import { Component, computed } from '@angular/core';
import { ChatComponent } from '@cacheplane/chat';
import { streamResource } from '@cacheplane/stream-resource';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-durable-execution',
  standalone: true,
  imports: [ChatComponent],
  template: `
    <div class="flex flex-col h-screen">
      <!-- Status bar -->
      <div class="flex items-center gap-4 px-5 py-3 border-b"
           style="border-color: var(--chat-border, #333); background: var(--chat-bg-alt, #222);">
        <!-- Step pipeline -->
        <div class="flex items-center gap-2 text-xs">
          @for (step of steps; track step) {
            <div class="flex items-center gap-1">
              <span class="w-2 h-2 rounded-full"
                    [style.background]="currentStep() === step ? 'var(--chat-warning-text, #fbbf24)' : isStepComplete(step) ? 'var(--chat-success, #4ade80)' : 'var(--chat-text-muted, #777)'">
              </span>
              <span [style.color]="currentStep() === step ? 'var(--chat-text, #e0e0e0)' : 'var(--chat-text-muted, #777)'"
                    [style.font-weight]="currentStep() === step ? '600' : '400'">
                {{ step }}
              </span>
            </div>
            @if (!$last) {
              <span style="color: var(--chat-text-muted, #777);">→</span>
            }
          }
        </div>

        <!-- Status badge -->
        <div class="ml-auto flex items-center gap-3 text-xs">
          <span class="px-2 py-0.5 rounded-full font-medium"
                [style.background]="statusColor()"
                style="color: white;">
            {{ stream.status() }}
          </span>
          @if (stream.error()) {
            <button class="px-2 py-1 rounded text-xs font-medium transition-colors"
                    style="background: var(--chat-error-bg, #2d1515); color: var(--chat-error-text, #f87171);"
                    (click)="stream.reload()">
              Retry
            </button>
          }
        </div>
      </div>

      <!-- Chat -->
      <chat [ref]="stream" class="flex-1 min-w-0" />
    </div>
  `,
})
export class DurableExecutionComponent {
  protected readonly steps = ['analyze', 'plan', 'generate'];

  protected readonly stream = streamResource({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
  });

  protected readonly currentStep = computed(() => {
    const val = this.stream.value() as Record<string, unknown>;
    return (val?.['step'] as string) ?? '';
  });

  protected isStepComplete(step: string): boolean {
    const idx = this.steps.indexOf(step);
    const currentIdx = this.steps.indexOf(this.currentStep());
    return currentIdx > idx;
  }

  protected statusColor(): string {
    switch (this.stream.status()) {
      case 'loading':
      case 'reloading':
        return '#2563eb';
      case 'resolved':
        return '#16a34a';
      case 'error':
        return '#dc2626';
      default:
        return '#6b7280';
    }
  }
}
