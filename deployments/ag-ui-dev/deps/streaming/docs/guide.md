# Real-Time Streaming with AG-UI and Angular

<Summary>
Build a real-time streaming chat interface using `provideAgent()` and
`injectAgent()` from `@threadplane/ag-ui` connected to a LangGraph backend
served locally via the AG-UI adapter.
</Summary>

<Prompt>
Add real-time LLM streaming to this Angular component using `@threadplane/ag-ui`. Configure `provideAgent({ url })` in the app config, call `injectAgent()` in the component, then call `stream.submit()` to send messages. Bind `stream.messages()` in the template via the `<chat>` component from `@threadplane/chat` — all Signals, no subscriptions needed.
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
      url: 'http://localhost:5321/agent',
    }),
  ],
};
```

This makes the configured agent available to all `injectAgent()` calls in your app.

</Step>
<Step title="Create the streaming resource">

In your component, call `injectAgent()` to retrieve the configured streaming agent:

```typescript
// streaming.component.ts
import { injectAgent } from '@threadplane/ag-ui';

export class StreamingComponent {
  protected readonly stream = injectAgent();
}
```

The resource automatically handles streaming, connection lifecycle, and state management.

</Step>
<Step title="Bind the template">

Use the `<chat>` component to render messages reactively:

```html
<chat [agent]="stream" />
```

The template re-renders automatically as tokens arrive — no manual subscriptions or change detection needed.

</Step>
<Step title="Submit messages">

Call `stream.submit()` with a message payload:

```typescript
// streaming.component.ts
send(): void {
  const text = this.prompt().trim();
  if (!text || this.stream.isLoading()) return;
  this.prompt.set('');
  void this.stream.submit({ message: text });
}
```

The submit call opens a streaming connection to the AG-UI backend. As tokens arrive, `stream.messages()` updates reactively.

</Step>
<Step title="The AG-UI backend with ag-ui-langgraph">

The backend wraps the LangGraph `graph` in a FastAPI app using `ag-ui-langgraph`. The AG-UI adapter translates LangGraph streaming events into the AG-UI protocol, which the `@threadplane/ag-ui` adapter consumes directly.

```python
# server.py
from fastapi import FastAPI
from ag_ui_langgraph import LangGraphAgent, add_langgraph_fastapi_endpoint
from .graph import graph

agent = LangGraphAgent(name="streaming", graph=graph)
app = FastAPI(title="cockpit-ag-ui-streaming")
add_langgraph_fastapi_endpoint(app, agent, path="/agent")

@app.get("/ok")
def ok() -> dict:
    return {"ok": True}
```

Run the backend with:

```bash
uv run uvicorn src.server:app --port 5321
```

<Warning>
A checkpointer is required for `ag-ui-langgraph` to work. Without it, the library cannot call `graph.aget_state()`. The graph in `src/graph.py` uses `MemorySaver` for development.
</Warning>

</Step>
</Steps>

<Tip>
The `<chat>` component handles message rendering, input, loading states, and error display. Focus your component on the `provideAgent()` configuration and any application-specific logic.
</Tip>

<Warning>
Never expose your LangSmith API key in client-side code. Use server-side environment variables or a proxy.
</Warning>

<Related>
- [LangGraph Streaming](/langgraph/core-capabilities/streaming/overview/python) — The LangGraph variant of this pattern using the LangGraph SDK and LangSmith Cloud directly
- [AG-UI Interrupts](/ag-ui/core-capabilities/interrupts/overview/python) — Human-in-the-loop approval using the AG-UI adapter
</Related>
