# Human-in-the-Loop Interrupts with angular

<Summary>
Build a chat interface with human-in-the-loop approval using `agent()` from
`@ngaf/langgraph`. The LangGraph backend pauses execution for approval,
and the frontend resumes it with `stream.submit()`.
</Summary>

<Prompt>
Add human-in-the-loop approval to this Angular component using `agent()` from `@ngaf/langgraph`. Use `stream.interrupt()` to display pending approvals, `stream.submit(null)` to approve and resume execution, and `stream.submit({ resume: false })` to reject. Bind `stream.messages()` in the template via the `<cp-chat>` component from `@ngaf/chat`.
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

In your component, call `agent()` with the assistant ID that maps to your interrupts graph:

```typescript
// interrupts.component.ts
import { agent } from '@ngaf/langgraph';

export class InterruptsComponent {
  protected readonly stream = agent({
    assistantId: 'interrupts',
  });
}
```

The resource automatically handles streaming, interrupt detection, and state management.

</Step>
<Step title="Handle interrupts in the template">

Use `stream.interrupt()` to conditionally show a pending approval in the sidebar:

```html
<cp-chat
  [messages]="stream.messages()"
  [isLoading]="stream.isLoading()"
  [error]="stream.error()"
  (sendMessage)="send($event)">
  <ng-template #sidebar>
    @if (stream.interrupt()) {
      <div>
        <p>{{ stream.interrupt() }}</p>
        <button (click)="approve()">Approve</button>
        <button (click)="reject()">Reject</button>
      </div>
    } @else {
      <p>No pending approvals</p>
    }
  </ng-template>
</cp-chat>
```

When the graph pauses, `stream.interrupt()` returns the interrupt payload. When no interrupt is active, it returns a falsy value.

</Step>
<Step title="Implement approve and reject logic">

Add methods that resume graph execution with the user's decision:

```typescript
approve(): void {
  this.stream.submit(null);
}

reject(): void {
  this.stream.submit({ resume: false });
}
```

Submitting `null` is the LangGraph convention for continuing past an interrupt. Submitting `{ resume: false }` signals rejection so the graph can handle it accordingly.

<Tip>
You can extend this pattern to pass structured data back to the graph. For example, `stream.submit({ resume: true, edits: { ... } })` lets the user modify the response before approving.
</Tip>

</Step>
<Step title="The LangGraph backend with interrupt()">

The backend uses `interrupt()` from `langgraph.types` to pause execution for human approval:

```python
# graph.py
from langgraph.graph import StateGraph, MessagesState, END
from langgraph.checkpoint.memory import MemorySaver
from langgraph.types import interrupt

checkpointer = MemorySaver()

def build_interrupts_graph():
    llm = ChatOpenAI(model="gpt-5-mini", streaming=True)

    async def generate(state: MessagesState) -> dict:
        response = await llm.ainvoke(state["messages"])
        return {"messages": [response]}

    async def check_approval(state: MessagesState) -> dict:
        last_msg = state["messages"][-1]
        interrupt(f"The assistant wants to respond: {last_msg.content[:100]}...")
        return state

    graph = StateGraph(MessagesState)
    graph.add_node("generate", generate)
    graph.add_node("check_approval", check_approval)
    graph.set_entry_point("generate")
    graph.add_edge("generate", "check_approval")
    graph.add_edge("check_approval", END)
    return graph.compile(checkpointer=checkpointer)
```

The `interrupt()` call pauses the graph and sends the message string to the client. Execution resumes when the client calls `stream.submit()`.

<Warning>
A checkpointer is required for interrupts to work. Without it, the graph cannot save its state while paused. Use `MemorySaver` for development and `PostgresCheckpointer` for production.
</Warning>

</Step>
</Steps>

<Tip>
The `<cp-chat>` component handles message rendering, input, loading states, and error display. Focus your component on interrupt handling logic.
</Tip>

<Warning>
Never expose your LangSmith API key in client-side code. Use server-side environment variables or a proxy.
</Warning>

<Related>
- [Chat Interrupts](/chat/core-capabilities/interrupts/overview/python) — Learn how ChatInterruptsComponent handles human-in-the-loop approval flows
</Related>
