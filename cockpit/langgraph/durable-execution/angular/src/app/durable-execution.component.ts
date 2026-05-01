import { Component, computed } from '@angular/core';
import { ChatComponent, views } from '@ngaf/chat';
import { agent } from '@ngaf/langgraph';
import { signalStateStore } from '@ngaf/render';
import { ExampleChatLayoutComponent } from '@ngaf/example-layouts';
import { environment } from '../environments/environment';
import { StepPipelineComponent } from './views/step-pipeline.component';

/**
 * Pipeline step definition for the vertical progress indicator.
 */
interface PipelineStep {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'complete';
}

/** Ordered node names emitted by the Python graph's `state.step` field. */
const STEP_ORDER = ['analyze', 'plan', 'generate'] as const;

/** Human-readable labels for each pipeline step. */
const STEP_LABELS: Record<string, string> = {
  analyze: 'Analyze',
  plan: 'Plan',
  generate: 'Generate',
};

/**
 * DurableExecutionComponent demonstrates fault-tolerant multi-step execution
 * with `agent()`.
 *
 * This example shows how a graph checkpoints at each node, enabling it to
 * resume after failures. The backend processes each request through three
 * nodes: analyze, plan, generate. Each node updates `state.step` so the
 * UI can track progress via a vertical step indicator in the sidebar.
 */
@Component({
  selector: 'app-durable-execution',
  standalone: true,
  imports: [ChatComponent, ExampleChatLayoutComponent],
  template: `
    <example-chat-layout sidebarWidth="w-64">
      <chat main [agent]="agent" [views]="ui" [store]="uiStore" class="flex-1 min-w-0" />
      <div sidebar class="p-4"
           style="background: var(--chat-bg, #171717); color: var(--chat-text, #e0e0e0);">
        <h3 class="text-xs font-semibold uppercase tracking-wide mb-6"
            style="color: var(--chat-text-muted, #777);">Pipeline</h3>

        <div class="space-y-0">
          @for (step of steps(); track step.id; let last = $last) {
            <div class="flex items-start gap-3">
              <!-- Step indicator column -->
              <div class="flex flex-col items-center">
                <!-- Circle / icon -->
                @switch (step.status) {
                  @case ('complete') {
                    <div class="w-7 h-7 rounded-full bg-green-600 flex items-center justify-center">
                      <svg class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  }
                  @case ('active') {
                    <div class="w-7 h-7 rounded-full border-2 border-amber-500 flex items-center justify-center animate-spin"
                         style="animation-duration: 1.2s;">
                      <div class="w-2 h-2 rounded-full bg-amber-500"></div>
                    </div>
                  }
                  @default {
                    <div class="w-7 h-7 rounded-full border-2 flex items-center justify-center"
                         style="border-color: var(--chat-text-muted, #555);">
                      <div class="w-2 h-2 rounded-full" style="background: var(--chat-text-muted, #555);"></div>
                    </div>
                  }
                }
                <!-- Connecting line -->
                @if (!last) {
                  <div class="w-0.5 h-8"
                       [style.background]="step.status === 'complete' ? '#16a34a' : 'var(--chat-text-muted, #555)'">
                  </div>
                }
              </div>

              <!-- Label -->
              <span class="text-sm pt-1"
                    [class]="step.status === 'active' ? 'font-semibold text-amber-400' : step.status === 'complete' ? 'text-green-400' : ''"
                    [style.color]="step.status === 'pending' ? 'var(--chat-text-muted, #777)' : ''">
                {{ step.label }}
              </span>
            </div>
          }
        </div>
      </div>
    </example-chat-layout>
  `,
})
export class DurableExecutionComponent {
  readonly ui = views({ 'step-pipeline': StepPipelineComponent });
  readonly uiStore = signalStateStore({});

  protected readonly agent = agent({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
  });

  /**
   * Derives the 3-step pipeline status from the graph's `state.step` field.
   *
   * Steps before the current one are marked complete, the current step is
   * active, and subsequent steps remain pending.
   */
  protected readonly steps = computed<PipelineStep[]>(() => {
    const val = this.agent.value() as Record<string, unknown> | undefined;
    const currentStep = (val?.['step'] as string) ?? '';
    const activeIndex = STEP_ORDER.indexOf(currentStep as (typeof STEP_ORDER)[number]);

    return STEP_ORDER.map((id, i) => ({
      id,
      label: STEP_LABELS[id],
      status: activeIndex < 0 ? 'pending' : i < activeIndex ? 'complete' : i === activeIndex ? 'active' : 'pending',
    }));
  });
}
