# Thread Persistence with angular

<Summary>
Build a chat interface with thread persistence using `agent()` from
`@cacheplane/langgraph`. Conversations survive browser refreshes and
can be resumed using `stream.switchThread(id)`.
</Summary>

<Prompt>
Add thread persistence to this Angular component using `agent()` from `@cacheplane/langgraph`. Use the `onThreadId` callback to capture thread IDs, `stream.switchThread(id)` to resume conversations, and `stream.switchThread(null)` to start fresh. Bind `stream.messages()` in the template via the `<cp-chat>` component from `@cacheplane/chat`.
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
<Step title="Create the streaming resource with onThreadId">

In your component, call `agent()` with the `onThreadId` callback to capture new thread IDs:

```typescript
// persistence.component.ts
import { agent } from '@cacheplane/langgraph';

export class PersistenceComponent {
  protected readonly stream = agent({
    assistantId: 'persistence',
    onThreadId: (id: string) => {
      this.currentThreadId = id;
      if (!this.threadIds.includes(id)) this.threadIds.push(id);
    },
  });

  threadIds: string[] = [];
  currentThreadId = '';
}
```

The `onThreadId` callback fires whenever a new thread is created by the backend. Store the IDs to build a thread picker UI.

<Tip>
Store thread IDs in `localStorage` to survive full page reloads. On app init, read them back and call `stream.switchThread(id)` to restore the last active thread.
</Tip>

</Step>
<Step title="Build the template with thread sidebar">

Use the `<cp-chat>` component from `@cacheplane/chat` and project a sidebar via `ng-template`:

```html
<cp-chat
  [messages]="stream.messages()"
  [isLoading]="stream.isLoading()"
  [error]="stream.error()"
  (sendMessage)="send($event)">
  <ng-template #sidebar>
    <h3>Threads</h3>
    @for (id of threadIds; track id) {
      <button (click)="selectThread(id)">
        {{ id.substring(0, 12) }}...
      </button>
    }
    <button (click)="newThread()">+ New Thread</button>
  </ng-template>
</cp-chat>
```

The `#sidebar` template is projected into the chat layout, giving you a thread picker alongside the conversation.

</Step>
<Step title="Implement thread switching">

Add methods to switch between threads and start new conversations:

```typescript
selectThread(id: string): void {
  this.currentThreadId = id;
  this.stream.switchThread(id);
}

newThread(): void {
  this.currentThreadId = '';
  this.stream.switchThread(null);
}
```

Calling `switchThread(id)` loads the full message history for that thread. Calling `switchThread(null)` clears the conversation and starts fresh.

<Warning>
Thread IDs are assigned by the backend. Never generate them client-side. Always use the ID provided by the `onThreadId` callback.
</Warning>

</Step>
<Step title="The LangGraph backend with checkpointer">

The backend uses `MemorySaver` to persist thread state in memory during development:

```python
# graph.py
from langgraph.graph import StateGraph, MessagesState, END
from langgraph.checkpoint.memory import MemorySaver

checkpointer = MemorySaver()

def build_persistence_graph():
    llm = ChatOpenAI(model="gpt-4o-mini", streaming=True)

    async def generate(state: MessagesState) -> dict:
        response = await llm.ainvoke(state["messages"])
        return {"messages": [response]}

    graph = StateGraph(MessagesState)
    graph.add_node("generate", generate)
    graph.set_entry_point("generate")
    graph.add_edge("generate", END)
    return graph.compile(checkpointer=checkpointer)
```

The `checkpointer` argument on `graph.compile()` enables persistence. Each thread's conversation is stored and can be resumed with the same `thread_id`.

<Tip>
For production, replace `MemorySaver` with `PostgresCheckpointer` for durable persistence across server restarts.
</Tip>

</Step>
</Steps>

<Tip>
The `<cp-chat>` component handles message rendering, input, loading states, and error display. Focus your component on thread management logic.
</Tip>

<Warning>
Never expose your LangSmith API key in client-side code. Use server-side environment variables or a proxy.
</Warning>

<Related>
- [Chat Threads](/chat/core-capabilities/threads/overview/python) — Learn how ChatThreadsComponent manages conversation threads
- [Chat Timeline](/chat/core-capabilities/timeline/overview/python) — Explore ChatTimelineComponent for visualizing thread history
</Related>
