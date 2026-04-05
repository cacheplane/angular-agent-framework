# Nested Agent Delegation with Subgraphs and stream-resource

<Summary>
Build a chat interface that visualizes nested agent delegation using `streamResource()` from
`@cacheplane/stream-resource`. A parent orchestrator dispatches research tasks to a child
subgraph, and the sidebar tracks each subagent's status in real time using `stream.subagents()`.
</Summary>

<Prompt>
Add a subgraph-powered orchestrator to this Angular component using `streamResource()` from `@cacheplane/stream-resource`. Use `stream.subagents()` to track active child subgraph executions, and derive a `subagentEntries` signal with `computed()` for template iteration. Bind `stream.messages()` via the `<cp-chat>` component from `@cacheplane/chat`.
</Prompt>

<Steps>
<Step title="Configure the provider">

Set up `provideStreamResource()` in your app config with the LangGraph API URL:

```typescript
// app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideStreamResource } from '@cacheplane/stream-resource';

export const appConfig: ApplicationConfig = {
  providers: [
    provideStreamResource({
      apiUrl: 'https://your-deployment.langgraph.app',
    }),
  ],
};
```

</Step>
<Step title="Create the streaming resource">

In your component, call `streamResource()` with the assistant ID pointing to your subgraphs graph:

```typescript
// subgraphs.component.ts
import { Component, computed } from '@angular/core';
import { streamResource } from '@cacheplane/stream-resource';

export class SubgraphsComponent {
  protected readonly stream = streamResource({
    assistantId: 'subgraphs',
  });

  subagentEntries = computed(() => Array.from(this.stream.subagents().entries()));
}
```

`stream.subagents()` is a `Signal<Map<string, SubagentStreamRef>>`. Each entry holds a run ID and a `status()` signal that updates as the child subgraph runs.

</Step>
<Step title="Build the template with subagent sidebar">

Use `<cp-chat>` from `@cacheplane/chat` and project a sidebar via `ng-template`:

```html
<cp-chat
  [messages]="stream.messages()"
  [isLoading]="stream.isLoading()"
  [error]="stream.error()"
  (sendMessage)="send($event)">
  <ng-template #sidebar>
    <h3>Subagents</h3>
    @for (entry of subagentEntries(); track entry[0]) {
      <div>{{ entry[0].substring(0, 8) }}: {{ entry[1].status() }}</div>
    }
    @empty {
      <p>No active subagents</p>
    }
  </ng-template>
</cp-chat>
```

The `@empty` block renders when no subagents are active. Each entry shows a truncated run ID and the current status (`'running'`, `'done'`, or `'error'`).

<Tip>
Use `computed()` to derive `subagentEntries` from the Map. This ensures Angular's change detection picks up updates when subagents are added or their status changes.
</Tip>

</Step>
<Step title="The LangGraph backend with parent-child subgraphs">

The backend uses a parent orchestrator that delegates to a compiled child subgraph:

```python
# graph.py
from langgraph.graph import StateGraph, MessagesState, END
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(model="gpt-4o-mini", streaming=True)

# Child: research subgraph
async def research_node(state: MessagesState) -> dict:
    response = await llm.ainvoke(state["messages"])
    return {"messages": [response]}

research_graph = StateGraph(MessagesState)
research_graph.add_node("research", research_node)
research_graph.set_entry_point("research")
research_graph.add_edge("research", END)

# Parent: orchestrator
async def orchestrate_node(state: MessagesState) -> dict:
    response = await llm.ainvoke(state["messages"])
    return {"messages": [response]}

parent_graph = StateGraph(MessagesState)
parent_graph.add_node("orchestrate", orchestrate_node)
parent_graph.add_node("research", research_graph.compile())
parent_graph.add_edge("orchestrate", "research")
parent_graph.add_edge("research", END)
graph = parent_graph.compile()
```

The child subgraph is compiled and passed as a node to the parent graph. LangGraph streams subgraph events separately, which `stream-resource` captures and exposes through `stream.subagents()`.

<Tip>
Child subgraphs can have their own state, checkpointers, and tools. This pattern is ideal for multi-agent systems where specialized agents handle distinct concerns.
</Tip>

</Step>
</Steps>

<Tip>
The `<cp-chat>` component handles message rendering, input, loading states, and error display. Focus your component on subagent tracking logic.
</Tip>

<Warning>
Never expose your LangSmith API key in client-side code. Use server-side environment variables or a proxy.
</Warning>
