# Task Decomposition with angular

<Summary>
Build a chat interface that shows real-time task decomposition using `agent()` from
`@cacheplane/angular`. The agent breaks complex requests into ordered steps, and the
sidebar displays each step's status as the agent works through them.
</Summary>

<Prompt>
Add a task planning sidebar to this Angular component using `agent()` from `@cacheplane/angular`. Use `stream.value()` to access the agent's plan state, derive `planSteps` with `computed()`, and bind them to the sidebar via the `<cp-chat>` component from `@cacheplane/chat`.
</Prompt>

<Steps>
<Step title="Configure the provider">

Set up `provideAgent()` in your app config with the LangGraph API URL:

```typescript
// app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideAgent } from '@cacheplane/angular';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAgent({
      apiUrl: 'https://your-deployment.langgraph.app',
    }),
  ],
};
```

This makes the API URL available to all `agent()` calls in your app.

</Step>
<Step title="Create the streaming resource">

In your component, call `agent()` with the `assistantId` pointing to your planning graph:

```typescript
// planning.component.ts
import { agent } from '@cacheplane/angular';

export class PlanningComponent {
  protected readonly stream = agent({
    assistantId: 'planning',
  });
}
```

The resource manages the connection, message history, loading state, and errors automatically.

</Step>
<Step title="Derive plan steps with computed()">

Use Angular's `computed()` to reactively derive the plan steps from `stream.value()`:

```typescript
import { computed } from '@angular/core';

interface PlanStep {
  title: string;
  status: 'pending' | 'running' | 'complete';
}

export class PlanningComponent {
  protected readonly stream = agent({ assistantId: 'planning' });

  planSteps = computed(() => {
    const val = this.stream.value() as { plan?: PlanStep[] } | undefined;
    return val?.plan ?? [];
  });
}
```

`stream.value()` contains the latest graph state. The planning graph stores steps under a `plan` key, updating statuses as each step is completed.

<Tip>
`stream.value()` is a signal that updates reactively as new state arrives from the server. `computed()` recalculates `planSteps` automatically whenever the stream updates.
</Tip>

</Step>
<Step title="Build the template with plan sidebar">

Use the `<cp-chat>` component and project a sidebar via `ng-template`:

```html
<cp-chat
  [messages]="stream.messages()"
  [isLoading]="stream.isLoading()"
  [error]="stream.error()"
  (sendMessage)="send($event)">
  <ng-template #sidebar>
    <h3>Task Plan</h3>
    @for (step of planSteps(); track $index) {
      <div>
        <span [style.background]="step.status === 'complete' ? '#10b981' : '#d1d5db'"></span>
        <span [style.textDecoration]="step.status === 'complete' ? 'line-through' : 'none'">
          {{ step.title }}
        </span>
      </div>
    }
    @empty {
      <p>Ask a complex question to see the plan.</p>
    }
  </ng-template>
</cp-chat>
```

The `#sidebar` template is projected into the chat layout. Steps render reactively as the agent updates the plan state.

</Step>
<Step title="The LangGraph planning backend">

The backend uses a two-node graph: one to decompose the task into steps, another to execute them:

```python
# graph.py
from langgraph.graph import StateGraph, END

def build_planning_graph():
    async def create_plan(state: PlanningState) -> dict:
        """Decompose the task into ordered steps."""
        # LLM returns a JSON array of steps
        plan = [{"title": "Step 1", "status": "pending"}, ...]
        return {"plan": plan, "messages": [response]}

    async def execute_plan(state: PlanningState) -> dict:
        """Execute the plan and mark steps complete."""
        plan = [dict(s, status="complete") for s in state["plan"]]
        return {"plan": plan, "messages": [response]}

    graph = StateGraph(PlanningState)
    graph.add_node("create_plan", create_plan)
    graph.add_node("execute_plan", execute_plan)
    graph.set_entry_point("create_plan")
    graph.add_edge("create_plan", "execute_plan")
    graph.add_edge("execute_plan", END)
    return graph.compile()
```

Each node updates the `plan` list in state. The frontend sees these updates via `stream.value()` as the graph executes.

<Tip>
For real step-by-step execution, add one node per step and update the step's `status` field to `"running"` at the start and `"complete"` at the end. The frontend will show progress in real time.
</Tip>

</Step>
</Steps>

<Tip>
The `@empty` block in `@for` renders when the plan array is empty — a clean way to show a placeholder before the user submits their first complex question.
</Tip>
