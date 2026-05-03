# Cross-Thread Persistent Memory with angular

<Summary>
Build a chat interface where the agent actively learns and remembers facts about the user.
The LangGraph backend maintains a `memory` dict in graph state, updated by an `extract_memory`
node after each exchange. The Angular component reads the `memory` field from `stream.value()`
and displays it in a live sidebar.
</Summary>

<Prompt>
Add persistent agent memory to this Angular component using `agent()` from `@ngaf/langgraph`. Use `stream.value()` to access the `memory` field in graph state, derive a reactive `memoryEntries` signal with Angular's `computed()`, and render the facts in a sidebar panel via the `<cp-chat>` component from `@ngaf/chat`.
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

</Step>
<Step title="Create the streaming resource">

In your component, call `agent()` pointing at the `memory` assistant:

```typescript
// memory.component.ts
import { agent } from '@ngaf/langgraph';

export class MemoryComponent {
  protected readonly stream = agent({
    assistantId: 'memory',
  });
}
```

</Step>
<Step title="Derive the memory signal">

Use Angular's `computed()` to derive a reactive list of key-value pairs from the
`memory` field in the graph state returned by `stream.value()`:

```typescript
import { computed } from '@angular/core';

protected readonly memoryEntries = computed(() => {
  const state = this.stream.value() as { memory?: Record<string, unknown> } | null;
  const memory = state?.memory ?? {};
  return Object.entries(memory).map(([key, value]) => ({
    key,
    value: typeof value === 'string' ? value : JSON.stringify(value),
  }));
});
```

`stream.value()` exposes the full graph state on every update event, so `memoryEntries`
updates reactively as the agent learns new facts mid-conversation.

<Tip>
Cast the return type of `stream.value()` to your state shape to get proper type inference.
</Tip>

</Step>
<Step title="Build the template with memory sidebar">

Use the `<cp-chat>` component and project the memory panel via `ng-template`:

```html
<cp-chat
  [messages]="stream.messages()"
  [isLoading]="stream.isLoading()"
  [error]="stream.error()"
  (sendMessage)="send($event)">
  <ng-template #sidebar>
    <h3>Agent Memory</h3>
    @if (memoryEntries().length === 0) {
      <p>No facts learned yet. Start chatting!</p>
    }
    @for (entry of memoryEntries(); track entry.key) {
      <div>
        <strong>{{ entry.key }}</strong>
        <span>{{ entry.value }}</span>
      </div>
    }
  </ng-template>
</cp-chat>
```

Facts appear in the sidebar in real time as the agent learns them.

</Step>
<Step title="The LangGraph backend with extract_memory">

Define a custom `MemoryState` that extends messages with a `memory` dict, then
wire two nodes — `generate` and `extract_memory` — in sequence:

```python
# graph.py
from typing import TypedDict
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

class MemoryState(TypedDict):
    messages: list
    memory: dict  # {"user_name": "Alice", "location": "NYC", ...}

checkpointer = MemorySaver()

def build_memory_graph():
    llm = ChatOpenAI(model="gpt-5-mini", streaming=True)

    async def generate(state: MemoryState) -> dict:
        memory = state.get("memory", {})
        # Inject known facts into the system prompt
        ...
        response = await llm.ainvoke(messages)
        return {"messages": [response]}

    async def extract_memory(state: MemoryState) -> dict:
        # Ask the LLM to extract new facts as JSON
        ...
        return {"memory": updated_memory}

    graph = StateGraph(MemoryState)
    graph.add_node("generate", generate)
    graph.add_node("extract_memory", extract_memory)
    graph.set_entry_point("generate")
    graph.add_edge("generate", "extract_memory")
    graph.add_edge("extract_memory", END)
    return graph.compile(checkpointer=checkpointer)
```

The `extract_memory` node runs after every `generate` call, keeping the memory
dict fresh without adding latency to the user-facing reply.

<Tip>
For production, replace `MemorySaver` with `PostgresCheckpointer` so memory
survives server restarts and scales across workers.
</Tip>

</Step>
</Steps>

<Tip>
The `memory` dict is part of graph state and is streamed back to the client on
every state update. There is no separate API call needed — just read `stream.value()`.
</Tip>

<Warning>
Never expose your LangSmith API key in client-side code. Use server-side environment
variables or a proxy.
</Warning>

<Related>
- [Chat Messages](/chat/core-capabilities/messages/overview/python) — Learn how ChatMessagesComponent renders messages
- [Chat Threads](/chat/core-capabilities/threads/overview/python) — Learn how ChatThreadsComponent manages conversation threads
</Related>
