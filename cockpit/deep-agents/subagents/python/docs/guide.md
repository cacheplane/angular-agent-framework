# Child Agent Delegation with angular

<Summary>
Build a chat interface that shows real-time subagent activity using `agent()` from
`@cacheplane/angular`. An orchestrator agent delegates subtasks to specialist child
agents, and the sidebar displays each subagent's status and message count as they stream.
</Summary>

<Prompt>
Add a subagent activity sidebar to this Angular component using `agent()` from `@cacheplane/angular`. Use `stream.subagents()` to access the live Map of child agent streams, derive `subagentEntries` with `computed()`, and render them in the `<cp-chat>` sidebar.
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

In your component, call `agent()` with the `assistantId` pointing to your subagents graph:

```typescript
// subagents.component.ts
import { agent } from '@cacheplane/angular';

export class SubagentsComponent {
  protected readonly stream = agent({
    assistantId: 'subagents',
  });
}
```

The resource manages the connection, message history, loading state, and all subagent streams automatically.

</Step>
<Step title="Derive subagent entries with computed()">

Use Angular's `computed()` to convert the subagents Map into a renderable array:

```typescript
import { computed } from '@angular/core';

export class SubagentsComponent {
  protected readonly stream = agent({ assistantId: 'subagents' });

  subagentEntries = computed(() => Array.from(this.stream.subagents().entries()));
}
```

`stream.subagents()` returns a `Map<string, SubagentStreamRef>` keyed by tool call ID. Each `SubagentStreamRef` exposes `status`, `messages`, and `values` as Angular Signals.

<Tip>
`stream.subagents()` is a signal that updates whenever a new subagent is spawned or an existing one changes status. `computed()` recalculates `subagentEntries` automatically on each update.
</Tip>

</Step>
<Step title="Build the template with subagent sidebar">

Use the `<cp-chat>` component and project a sidebar via `ng-template`:

```html
<cp-chat
  [messages]="stream.messages()"
  [isLoading]="stream.isLoading()"
  [error]="stream.error()"
  (sendMessage)="send($event)">
  <ng-template #sidebar>
    <h3>Subagents</h3>
    @for (entry of subagentEntries(); track entry[0]) {
      <div>
        <span>{{ entry[1].status() }}</span>
        <span>{{ entry[0].slice(0, 8) }}…</span>
        <div>{{ entry[1].messages().length }} messages</div>
      </div>
    }
    @empty {
      <p>Ask a question to see subagent activity.</p>
    }
  </ng-template>
</cp-chat>
```

Each `entry` is a `[toolCallId, SubagentStreamRef]` tuple. The tool call ID identifies which specialist was invoked; the ref's signals update in real time.

</Step>
<Step title="The LangGraph orchestrator backend">

The backend uses an orchestrator node that binds specialist tools and a conditional edge to run them:

```python
# graph.py
from langgraph.graph import StateGraph, END
from langchain_core.tools import tool

@tool
async def research_agent(topic: str) -> str:
    """Spawn a research subagent to gather information on a topic."""
    # Delegate to a specialist LLM
    ...

@tool
async def analysis_agent(content: str) -> str:
    """Spawn an analysis subagent to analyze and synthesize information."""
    ...

def build_subagents_graph():
    orchestrator_llm = llm.bind_tools([research_agent, analysis_agent, summary_agent])

    async def orchestrate(state):
        response = await orchestrator_llm.ainvoke(messages)
        return {"messages": [response]}

    def should_continue(state):
        last = state["messages"][-1]
        if last.tool_calls:
            return "run_subagents"
        return END

    graph = StateGraph(SubagentsState)
    graph.add_node("orchestrate", orchestrate)
    graph.add_node("run_subagents", run_subagents)
    graph.add_conditional_edges("orchestrate", should_continue, ...)
    graph.add_edge("run_subagents", "respond")
    return graph.compile()
```

Each tool call emits a `ToolMessage` that the frontend tracks as a subagent stream entry.

<Tip>
For real parallel subagent execution, use `asyncio.gather()` inside `run_subagents` to invoke all tools concurrently. The frontend's `stream.subagents()` will show multiple subagents running simultaneously.
</Tip>

</Step>
</Steps>

<Tip>
The `@empty` block in `@for` renders when no subagents have been spawned yet — a clean placeholder before the first message is submitted.
</Tip>

<Related>
- [Chat Subagents](/chat/core-capabilities/subagents/overview/python) — Learn how ChatSubagentsComponent visualizes nested agent delegation
</Related>
