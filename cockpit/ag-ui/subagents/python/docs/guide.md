# Subagent Cards over AG-UI

<Summary>
Render live subagent cards in an Angular chat UI using `provideAgent()` and
`injectAgent()` from `@threadplane/ag-ui`. An orchestrator LangGraph agent
delegates focused subtasks to specialized subagents via a `task` tool; the
backend converts each subagent's streamed tokens into native AG-UI ACTIVITY
events, which the `@threadplane/ag-ui` reducer projects onto
`agent.subagents()` for the `<chat-subagents>` primitive to render.
</Summary>

<Prompt>
Add subagent cards to this Angular component using `@threadplane/ag-ui`. Configure `provideAgent({ url })` in the app config, call `injectAgent()` in the component, and pass the agent to the `<chat>` component from `@threadplane/chat`. The orchestrator graph dispatches subagents with a `task` tool and emits `subagent_activity` custom events; the backend's `ActivityEmittingAgent` converts those into native AG-UI ACTIVITY events so the chat composition renders a live card per subagent — all Signals, no subscriptions needed.
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
      url: 'http://localhost:5326/agent',
    }),
  ],
};
```

This makes the configured agent available to all `injectAgent()` calls in your app.

</Step>
<Step title="Host the chat composition">

In your component, call `injectAgent()` and pass it to `<chat>`. No
subagent-specific wiring is needed — `<chat>` renders `<chat-subagents>`
automatically once `agent.subagents()` populates:

```typescript
// subagents.component.ts
import { Component } from '@angular/core';
import { ChatComponent } from '@threadplane/chat';
import { injectAgent } from '@threadplane/ag-ui';

@Component({
  selector: 'app-subagents',
  standalone: true,
  imports: [ChatComponent],
  template: `<chat [agent]="agent" />`,
})
export class SubagentsComponent {
  protected readonly agent = injectAgent();
}
```

</Step>
<Step title="Dispatch subagents from the graph">

The orchestrator binds a `task` tool that dispatches a role-specific
subagent. Before running the subagent it emits a `started` activity; while
the subagent streams it forwards each token as a `message` activity (via
`SubagentStreamHandler`); after it emits a `finished` activity — all keyed
by the tool's own call id:

```python
# graph.py
from langchain_core.callbacks import adispatch_custom_event
from langchain_core.tools import tool, InjectedToolCallId
from src.streaming.subagent_stream_handler import SubagentStreamHandler

@tool
async def task(role, task_description, tool_call_id: Annotated[str, InjectedToolCallId]):
    await adispatch_custom_event(
        "subagent_activity",
        {"subagent_id": tool_call_id, "phase": "started", "name": role},
    )
    result = await _run_subagent(
        role, task_description,
        config={"callbacks": [SubagentStreamHandler(tool_call_id)]},
    )
    await adispatch_custom_event(
        "subagent_activity",
        {"subagent_id": tool_call_id, "phase": "finished", "status": "complete"},
    )
    return result
```

</Step>
<Step title="Convert custom events to native ACTIVITY events">

The backend wraps the LangGraph `graph` in a FastAPI app using
`ag-ui-langgraph`. `ActivityEmittingAgent` subclasses the bridge's
`LangGraphAgent` and converts each `subagent_activity` CUSTOM event into a
native AG-UI ACTIVITY event (snapshot/delta) at the bridge's 1:1 dispatch
point:

```python
# server.py
from fastapi import FastAPI
from ag_ui_langgraph import add_langgraph_fastapi_endpoint
from .graph import graph
from .streaming.activity_emitting_agent import ActivityEmittingAgent

app = FastAPI(title="cockpit-ag-ui-subagents")
add_langgraph_fastapi_endpoint(
    app, ActivityEmittingAgent(name="subagents", graph=graph), path="/agent"
)

@app.get("/ok")
def ok() -> dict:
    return {"ok": True}
```

Run the backend with:

```bash
uv run uvicorn src.server:app --port 5326
```

<Warning>
A checkpointer is required for `ag-ui-langgraph` to work. Without it, the library cannot call `graph.aget_state()`. The graph in `src/graph.py` uses `MemorySaver` for development.
</Warning>

</Step>
</Steps>

<Tip>
The `<chat>` component renders `<chat-subagents>` only while a subagent is in a running state. Under instant replay the run can settle within a single frame, so the live card transits below a render frame — assert on the durable `agent.subagents()` projection (or the tool-call card) rather than the live card element.
</Tip>

<Warning>
Never expose your LangSmith API key in client-side code. Use server-side environment variables or a proxy.
</Warning>

<Related>
- [Chat Subagents](/chat/core-capabilities/subagents/overview/python) — The LangGraph variant of this pattern using the chat-subagents primitive directly
- [AG-UI Streaming](/ag-ui/core-capabilities/streaming/overview/python) — The minimal streaming pattern using the AG-UI adapter
</Related>
