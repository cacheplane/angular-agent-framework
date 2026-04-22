# Persistent Agent Memory with angular

<Summary>
Build a chat interface where the agent remembers facts about the user across turns using `agent()` from `@cacheplane/langgraph`. The agent stores learned facts in `agent_memory` state, and the sidebar displays them in real time.
</Summary>

<Prompt>
Add a memory sidebar to this Angular component using `agent()` from `@cacheplane/langgraph`. Use `stream.value()` to access the agent's `agent_memory` state, derive `memoryEntries` with `computed()`, and bind them to the sidebar via the `<cp-chat>` component from `@cacheplane/chat`.
</Prompt>

<Steps>
<Step title="Configure the provider">

Set up `provideAgent()` in your app config with the LangGraph API URL:

```typescript
// app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideAgent } from '@cacheplane/langgraph';

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

In your component, call `agent()` with the `assistantId` pointing to your memory graph:

```typescript
// memory.component.ts
import { agent } from '@cacheplane/langgraph';

export class MemoryComponent {
  protected readonly stream = agent({
    assistantId: 'da-memory',
  });
}
```

The resource manages the connection, message history, loading state, and errors automatically.

</Step>
<Step title="Derive memory entries with computed()">

Use Angular's `computed()` to reactively derive the memory key/value pairs from `stream.value()`:

```typescript
import { computed } from '@angular/core';

export class MemoryComponent {
  protected readonly stream = agent({ assistantId: 'da-memory' });

  memoryEntries = computed(() => {
    const val = this.stream.value() as { agent_memory?: Record<string, string> } | undefined;
    return Object.entries(val?.agent_memory ?? {});
  });
}
```

`stream.value()` contains the latest graph state. The memory graph stores learned facts under `agent_memory`, updating the dict as the agent extracts new information.

<Tip>
`stream.value()` is a signal that updates reactively as new state arrives from the server. `computed()` recalculates `memoryEntries` automatically whenever the stream updates.
</Tip>

</Step>
<Step title="Build the template with memory sidebar">

Use the `<cp-chat>` component and project a sidebar via `ng-template`:

```html
<cp-chat
  [messages]="stream.messages()"
  [isLoading]="stream.isLoading()"
  [error]="stream.error()"
  (sendMessage)="send($event)">
  <ng-template #sidebar>
    <h3>Learned Facts</h3>
    @for (entry of memoryEntries(); track entry[0]) {
      <div>
        <div style="font-weight: 600;">{{ entry[0] }}</div>
        <div>{{ entry[1] }}</div>
      </div>
    }
    @empty {
      <p>Tell the agent something about yourself to see it remember.</p>
    }
  </ng-template>
</cp-chat>
```

The `#sidebar` template is projected into the chat layout. Memory entries render reactively as the agent learns new facts.

</Step>
<Step title="The LangGraph memory backend">

The backend uses a two-node graph: one to generate a response, another to extract new facts:

```python
# graph.py
from langgraph.graph import StateGraph, END

def build_memory_graph():
    async def generate(state: MemoryState) -> dict:
        """Generate a response, using remembered facts in the prompt."""
        memory = state.get("agent_memory", {})
        # Inject memory into system prompt...
        response = await llm.ainvoke(messages)
        return {"messages": [response]}

    async def extract_facts(state: MemoryState) -> dict:
        """Extract new facts from the conversation and update agent_memory."""
        new_facts = {}  # LLM returns JSON dict of facts
        current_memory = dict(state.get("agent_memory", {}))
        current_memory.update(new_facts)
        return {"agent_memory": current_memory}

    graph = StateGraph(MemoryState)
    graph.add_node("generate", generate)
    graph.add_node("extract_facts", extract_facts)
    graph.set_entry_point("generate")
    graph.add_edge("generate", "extract_facts")
    graph.add_edge("extract_facts", END)
    return graph.compile()
```

Each turn, `generate` uses existing memory to personalize its response, then `extract_facts` updates `agent_memory` with anything new the user shared. The frontend sees these updates via `stream.value()`.

<Tip>
Because LangGraph persists state across turns in a thread, `agent_memory` accumulates facts over the entire session. The agent becomes progressively more personalized as the conversation continues.
</Tip>

</Step>
</Steps>

<Tip>
The `@empty` block in `@for` renders when the memory dict is empty — a clean way to show a placeholder before the user shares any personal information.
</Tip>

<Related>
- [Chat Threads](/chat/core-capabilities/threads/overview/python) — Learn how ChatThreadsComponent manages conversation threads
</Related>
