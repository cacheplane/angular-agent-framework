# Durable Execution with angular

<Summary>
Build a fault-tolerant chat interface using `agent()` from
`@ngaf/langgraph`. The backend graph checkpoints state after
each node, enabling resume-on-failure. The sidebar monitors execution
status in real time and exposes a "Retry" button when errors occur.
</Summary>

<Prompt>
Add a durable multi-step execution workflow to this Angular component using `agent()` from `@ngaf/langgraph`. Display `stream.status()` as a colour-coded badge, show a `stream.hasValue()` indicator, and render a "Retry" button that calls `stream.reload()` when `stream.error()` is set. Bind `stream.messages()` in the template via the `<cp-chat>` component from `@ngaf/chat`.
</Prompt>

<Steps>
<Step title="Configure the provider">

Set up `provideAgent()` in your app config with the LangGraph API URL:

```typescript
// app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideAgent } from '@ngaf/langgraph';

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

In your component, call `agent()` with the `assistantId` pointing to your durable-execution graph:

```typescript
// durable-execution.component.ts
import { agent } from '@ngaf/langgraph';

export class DurableExecutionComponent {
  protected readonly stream = agent({
    assistantId: 'durable-execution',
  });

  send(text: string): void {
    this.stream.submit({ messages: [{ role: 'human', content: text }] });
  }
}
```

</Step>
<Step title="Monitor status with a badge">

Use `stream.status()` to display real-time execution state. The signal returns `'idle'`, `'loading'`, `'resolved'`, or `'error'`:

```html
<span [style.background]="statusBadgeColor()">
  {{ stream.status() }}
</span>
```

```typescript
statusBadgeColor(): string {
  switch (this.stream.status()) {
    case 'loading':
    case 'reloading': return '#2563eb';
    case 'resolved':  return '#16a34a';
    case 'error':     return '#dc2626';
    default:          return '#6b7280';
  }
}
```

</Step>
<Step title="Show a data-received indicator">

Use `stream.hasValue()` to indicate whether the graph has returned any data yet:

```html
<span [style.background]="stream.hasValue() ? '#22c55e' : '#d1d5db'"
      style="display: inline-block; width: 10px; height: 10px; border-radius: 50%;">
</span>
<span>{{ stream.hasValue() ? 'Yes' : 'No' }}</span>
```

`hasValue()` becomes `true` as soon as the first value or message arrives from the stream.

</Step>
<Step title="Add retry logic">

Render a "Retry" button when `stream.error()` is set. Call `stream.reload()` to re-submit the last input:

```html
@if (stream.error()) {
  <button (click)="stream.reload()">Retry</button>
}
```

`reload()` re-submits the previous input without requiring the user to retype their message. Because the graph checkpoints after each node, a retry resumes from the last successful checkpoint rather than restarting the whole run.

<Warning>
`stream.reload()` is a no-op if there is no previous submission. Guard against calling it on an idle stream.
</Warning>

</Step>
<Step title="The LangGraph backend — multi-node graph">

The backend uses a three-node graph with `MemorySaver` checkpointing:

```python
# graph.py
from typing import TypedDict
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

class DurableState(TypedDict):
    messages: list
    step: str  # Current execution step name

checkpointer = MemorySaver()

def build_durable_execution_graph():
    llm = ChatOpenAI(model="gpt-4o-mini", streaming=True)

    async def analyze(state): ...   # Node 1
    async def plan(state):   ...   # Node 2
    async def generate(state): ... # Node 3

    graph = StateGraph(DurableState)
    graph.add_node("analyze", analyze)
    graph.add_node("plan", plan)
    graph.add_node("generate", generate)
    graph.set_entry_point("analyze")
    graph.add_edge("analyze", "plan")
    graph.add_edge("plan", "generate")
    graph.add_edge("generate", END)
    return graph.compile(checkpointer=checkpointer)
```

Each node updates `state.step` so the UI (or LangSmith traces) can show which stage the graph is currently in.

<Tip>
For production, replace `MemorySaver` with `PostgresCheckpointer` for durable persistence across server restarts.
</Tip>

</Step>
</Steps>

<Tip>
The `<cp-chat>` component handles message rendering, input, loading states, and error display. Keep your component focused on status monitoring and retry logic.
</Tip>

<Warning>
Never expose your LangSmith API key in client-side code. Use server-side environment variables or a proxy.
</Warning>
