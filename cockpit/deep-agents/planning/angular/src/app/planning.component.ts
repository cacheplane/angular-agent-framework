import { Component, computed } from '@angular/core';
import { ChatComponent, views } from '@threadplane/chat';
import { ExampleChatLayoutComponent } from '@threadplane/example-layouts';
import { injectAgent } from '@threadplane/langgraph';
import { signalStateStore } from '@threadplane/render';
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
    <example-chat-layout sidebarWidth="18rem">
      <chat main [agent]="agent" [views]="ui" [store]="uiStore" class="flex-1 min-w-0" />
      <div sidebar class="panel">
        <h3 class="cap">Plan</h3>
        @if (planSteps().length === 0) {
          <p class="empty">No plan yet</p>
        }
        @for (step of planSteps(); track step.title) {
          <div class="plan-row">
            <span class="plan-icon">
              @if (step.status === 'complete') {
                <span class="plan-icon--complete">&#10003;</span>
              } @else if (step.status === 'in_progress') {
                <span class="plan-icon--active">&#9696;</span>
              } @else {
                <span>&#9675;</span>
              }
            </span>
            <span class="plan-title">{{ step.title }}</span>
          </div>
        }
      </div>
    </example-chat-layout>
  `,
  styles: [`
    .panel {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding: 1rem;
      background: var(--tplane-chat-bg);
      color: var(--tplane-chat-text);
    }

    .cap {
      margin: 0;
      font-size: var(--tplane-chat-font-size-xs);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--tplane-chat-text-muted);
    }

    .empty {
      margin: 0;
      font-size: var(--tplane-chat-font-size-sm);
      font-style: italic;
      color: var(--tplane-chat-text-muted);
    }

    .plan-row {
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
      padding: 0.375rem 0.5rem;
      border-radius: var(--tplane-chat-radius-card);
      background: var(--tplane-chat-surface-alt);
      font-size: var(--tplane-chat-font-size-sm);
    }

    .plan-icon {
      flex: 0 0 auto;
      margin-top: 0.125rem;
      color: var(--tplane-chat-separator);
      font-size: 1rem;
      line-height: 1;
    }

    .plan-icon--complete {
      color: var(--tplane-chat-success);
    }

    .plan-icon--active {
      display: inline-block;
      color: var(--tplane-chat-text-muted);
      animation: spin 1s linear infinite;
    }

    .plan-title {
      color: var(--tplane-chat-text);
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
  `],
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
  protected readonly agent = injectAgent();

  /**
   * Reactive list of plan steps derived from the graph state.
   *
   * The Python graph stores the plan as `state.plan` — an array of objects
   * with `title` and `status` fields. This signal re-computes whenever
   * the stream state changes.
   */
  protected readonly planSteps = computed<PlanStep[]>(() => {
    const val = this.agent.value() as Record<string, unknown>;
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
