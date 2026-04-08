# Time Travel with angular

<Summary>
Build a chat interface with time travel using `agent()` from
`@cacheplane/angular`. Browse the checkpoint history via `stream.history()`,
see the active branch via `stream.branch()`, and fork the conversation from any
past state with `stream.setBranch(checkpointId)`.
</Summary>

<Prompt>
Add time travel to this Angular component using `agent()` from `@cacheplane/angular`. Display checkpoint history from `stream.history()` in the sidebar. Highlight the active branch using `stream.branch()`. Call `stream.setBranch(id)` when the user clicks a checkpoint to fork the conversation from that point.
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

</Step>
<Step title="Create the streaming resource">

In your component, call `agent()`. The history and branch signals are
available automatically — no extra config needed:

```typescript
// time-travel.component.ts
import { agent } from '@cacheplane/angular';

export class TimeTravelComponent {
  protected readonly stream = agent({
    assistantId: 'time-travel',
  });
}
```

</Step>
<Step title="Display checkpoint history in the sidebar">

Use `stream.history()` to render checkpoints and `stream.branch()` to highlight
the active one:

```html
<cp-chat
  [messages]="stream.messages()"
  [isLoading]="stream.isLoading()"
  [error]="stream.error()"
  (sendMessage)="send($event)">
  <ng-template #sidebar>
    <h3>History</h3>
    @for (state of stream.history(); track $index) {
      <button
        (click)="selectCheckpoint(state)"
        [style.background]="state.checkpoint_id === stream.branch() ? 'rgba(0,64,144,0.06)' : 'transparent'">
        {{ state.checkpoint_id?.substring(0, 8) }}...
      </button>
    }
  </ng-template>
</cp-chat>
```

Each entry in `stream.history()` is a `ThreadState` snapshot with a
`checkpoint_id` and `created_at` timestamp.

</Step>
<Step title="Branch from a checkpoint">

Call `stream.setBranch(checkpointId)` to set the active branch. The next
`stream.submit()` will fork the conversation from that checkpoint:

```typescript
selectCheckpoint(state: { checkpoint_id?: string }): void {
  if (state.checkpoint_id) {
    this.stream.setBranch(state.checkpoint_id);
  }
}

send(text: string): void {
  this.stream.submit({ messages: [{ role: 'human', content: text }] });
}
```

<Tip>
After branching, the conversation diverges from the selected checkpoint.
The original timeline remains accessible in the history sidebar.
</Tip>

</Step>
<Step title="The LangGraph backend with checkpointer">

The backend uses `MemorySaver` to persist checkpoint history. Time travel is a
client-side feature — the graph itself requires only the checkpointer:

```python
# graph.py
from langgraph.graph import StateGraph, MessagesState, END
from langgraph.checkpoint.memory import MemorySaver

checkpointer = MemorySaver()

def build_time_travel_graph():
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

<Tip>
For production, replace `MemorySaver` with `PostgresCheckpointer` for durable
checkpoint history across server restarts.
</Tip>

</Step>
</Steps>

<Tip>
The `stream.history()` signal updates after each successful submission.
The list grows as the conversation progresses, giving you a full audit trail.
</Tip>

<Warning>
`stream.setBranch()` sets a client-side branch pointer. The branch only takes
effect on the next `stream.submit()` call. Calling `setBranch` without
submitting does not modify the thread state.
</Warning>

<Related>
- [Chat Timeline](/chat/core-capabilities/timeline/overview/python) — Explore ChatTimelineComponent for visualizing thread history
- [Chat Debug](/chat/core-capabilities/debug/overview/python) — Learn how ChatDebugComponent aids in debugging agent behavior
</Related>
