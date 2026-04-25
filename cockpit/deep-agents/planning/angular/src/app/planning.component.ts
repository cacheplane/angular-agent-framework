import { Component, computed } from '@angular/core';
import { ChatComponent, views } from '@cacheplane/chat';
import { ExampleChatLayoutComponent } from '@cacheplane/example-layouts';
import { agent, toAgent } from '@cacheplane/langgraph';
import { signalStateStore } from '@cacheplane/render';
import { environment } from '../environments/environment';
import { PlanChecklistComponent } from './views/plan-checklist.component';
import { CheckboxRowComponent } from './views/checkbox-row.component';

/**
 * Represents a single step in an agent-generated plan.
 */
interface PlanStep {
  title: string;
  status: 'pending' | 'in_progress' | 'complete';
}

/**
 * PlanningComponent demonstrates agent task decomposition.
 *
 * The agent receives a complex task, breaks it into ordered steps,
 * and executes them sequentially. The sidebar displays a live checklist
 * of plan steps derived from the `plan` array in the graph state.
 *
 * Key integration points:
 * - `stream.value()` exposes the full graph state, including the `plan` array
 * - `planSteps` is derived from `stream.value()` for reactive sidebar rendering
 * - Step status icons update in real time as the agent progresses
 */

@Component({
  selector: 'app-planning',
  standalone: true,
  imports: [ChatComponent, ExampleChatLayoutComponent],
  template: `
    <example-chat-layout sidebarWidth="w-72">
      <chat main [agent]="chatAgent" [views]="ui" [store]="uiStore" class="flex-1 min-w-0" />
      <div sidebar class="p-4 space-y-2" style="background: var(--chat-bg, #171717); color: var(--chat-text, #e0e0e0);">
        <h3 class="text-xs font-semibold uppercase tracking-wide"
            style="color: var(--chat-text-muted, #777);">Plan</h3>
        @if (planSteps().length === 0) {
          <p class="text-sm italic" style="color: var(--chat-text-muted, #777);">No plan yet</p>
        }
        @for (step of planSteps(); track step.title) {
          <div class="flex items-start gap-2 rounded-md px-2 py-1.5 text-sm"
               style="background: var(--chat-bg-hover, #222);">
            <span class="mt-0.5 shrink-0 text-base leading-none">
              @if (step.status === 'complete') {
                <span style="color: #22c55e;">&#10003;</span>
              } @else if (step.status === 'in_progress') {
                <span class="inline-block animate-spin" style="color: var(--chat-text-muted, #777);">&#9696;</span>
              } @else {
                <span style="color: var(--chat-border-light, #444);">&#9675;</span>
              }
            </span>
            <span style="color: var(--chat-text, #e0e0e0);">{{ step.title }}</span>
          </div>
        }
      </div>
    </example-chat-layout>
  `,
})
export class PlanningComponent {
  readonly ui = views({ 'plan-checklist': PlanChecklistComponent, 'checkbox-row': CheckboxRowComponent });
  readonly uiStore = signalStateStore({});

  /**
   * The streaming resource connected to the planning graph.
   *
   * The graph returns a `plan` array alongside messages in its state.
   * Each plan entry has a `title` and `status` that drive the sidebar checklist.
   */
  protected readonly stream = agent({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
  });
  protected readonly chatAgent = toAgent(this.stream);

  /**
   * Reactive list of plan steps derived from the graph state.
   *
   * The Python graph stores the plan as `state.plan` — an array of objects
   * with `title` and `status` fields. This signal re-computes whenever
   * the stream state changes.
   */
  protected readonly planSteps = computed<PlanStep[]>(() => {
    const val = this.stream.value() as Record<string, unknown>;
    const plan = val?.['plan'];
    if (!Array.isArray(plan)) return [];
    return plan.map((step: Record<string, unknown>) => ({
      title: String(step['title'] ?? ''),
      status: (['pending', 'in_progress', 'complete'].includes(step['status'] as string)
        ? step['status']
        : 'pending') as PlanStep['status'],
    }));
  });
}
