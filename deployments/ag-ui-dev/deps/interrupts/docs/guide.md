# Human-in-the-Loop Interrupts with AG-UI and Angular

<Summary>
Build a chat interface with human-in-the-loop approval using `provideAgent()` and
`injectAgent()` from `@threadplane/ag-ui`. The LangGraph backend pauses execution for approval
and emits an AG-UI `CUSTOM` `on_interrupt` event; the frontend resumes it with `stream.submit()`.
</Summary>

<Prompt>
Add human-in-the-loop approval to this Angular component using `provideAgent()` and `injectAgent()` from `@threadplane/ag-ui`. Use `stream.interrupt()` to display pending approvals, `stream.submit({ resume: true })` to approve and resume execution, and `stream.submit({ resume: false })` to reject. Bind `stream.messages()` in the template via the `<chat>` component from `@threadplane/chat`.
</Prompt>

<Steps>
<Step title="Configure the provider">

Set up `provideAgent()` in your app config with the AG-UI backend URL:

```typescript
// app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideAgent } from '@threadplane/ag-ui';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAgent({
      url: 'http://localhost:5320/agent',
    }),
  ],
};
```

This makes the configured agent available to all `injectAgent()` calls in your app.

</Step>
<Step title="Create the streaming resource">

In your component, call `injectAgent()` to retrieve the configured interrupts agent:

```typescript
// interrupts.component.ts
import { injectAgent } from '@threadplane/ag-ui';

export class InterruptsComponent {
  protected readonly stream = injectAgent();
}
```

The resource automatically handles streaming, interrupt detection, and state management.

</Step>
<Step title="Handle interrupts in the template">

Use `stream.interrupt()` to conditionally show a pending approval in the sidebar:

```html
<chat [agent]="stream" />

@if (stream.interrupt(); as interrupt) {
  <aside>
    <p>{{ interrupt.value | json }}</p>
    <button (click)="approve()">Approve</button>
    <button (click)="reject()">Reject</button>
  </aside>
} @else {
  <p>No pending approvals</p>
}
```

When the graph pauses, `stream.interrupt()` returns the interrupt payload. When no interrupt is active, it returns a falsy value.

</Step>
<Step title="Implement approve and reject logic">

Add methods that resume graph execution with the user's decision:

```typescript
approve(): void {
  this.stream.submit({ resume: true });
}

reject(): void {
  this.stream.submit({ resume: false });
}
```

Submitting a `resume` payload continues past an interrupt. Submitting `{ resume: false }` signals rejection so the graph can handle it accordingly.

<Tip>
You can extend this pattern to pass structured data back to the graph. For example, `stream.submit({ resume: true, edits: { ... } })` lets the user modify the response before approving.
</Tip>

</Step>
<Step title="The AG-UI backend with ag-ui-langgraph">

The backend wraps the LangGraph `graph` (which uses `interrupt()` from `langgraph.types`) in a
FastAPI app using `ag-ui-langgraph`. When `interrupt()` fires, the package emits an AG-UI `CUSTOM`
`on_interrupt` event that the `@threadplane/ag-ui` adapter surfaces as `stream.interrupt()`.

```python
# server.py
from fastapi import FastAPI
from ag_ui_langgraph import LangGraphAgent, add_langgraph_fastapi_endpoint
from .graph import graph

agent = LangGraphAgent(name="interrupts", graph=graph)
app = FastAPI(title="cockpit-ag-ui-interrupts")
add_langgraph_fastapi_endpoint(app, agent, path="/agent")

@app.get("/ok")
def ok() -> dict:
    return {"ok": True}
```

Run the backend with:

```bash
uv run uvicorn src.server:app --port 5320
```

<Warning>
A checkpointer is required for interrupts to work. Without it, the graph cannot save its state
while paused. The graph in `src/graph.py` uses `MemorySaver` for development.
</Warning>

</Step>
</Steps>

<Tip>
The `<chat>` component handles message rendering, input, loading states, and error display. Focus your component on interrupt handling logic.
</Tip>

<Warning>
Never expose your LangSmith API key in client-side code. Use server-side environment variables or a proxy.
</Warning>

<Related>
- [LangGraph Interrupts](/langgraph/core-capabilities/interrupts/overview/python) — The LangGraph variant of this pattern using the LangGraph SDK directly
- [AG-UI Streaming](/ag-ui/core-capabilities/streaming/overview/python) — Basic streaming without interrupts using the AG-UI adapter
</Related>
