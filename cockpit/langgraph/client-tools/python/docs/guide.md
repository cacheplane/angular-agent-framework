# Browser-Executed Client Tools with LangGraph

<Summary>
The LangGraph-direct twin of the AG-UI client-tools example. Tools are declared
in the Angular app with `tools()`, `action()`, `view()`, and `ask()` from
`@threadplane/chat`; the `@threadplane/langgraph` adapter ships the catalog to
the backend as `input.client_tools` on every run submission. The LangGraph graph
declares a `client_tools` channel, binds the client stubs with
`bind_client_tools` from `threadplane.client_tools` (no server implementation),
and routes to `END` so the browser executes the tool and re-submits a
`ToolMessage` the model then summarizes. The three behaviors (`action` async
function, `view` inline component, `ask` HITL component) are identical to the
AG-UI example — only the transport and backend wiring differ.
</Summary>

<Prompt>
Declare client tools in the Angular app using `tools()`, `action()`, `view()`,
and `ask()` from `@threadplane/chat`, with schemas authored in `zod/v4`. Pass
the registry to `<chat [clientTools]="...">`. Configure `provideAgent` from
`@threadplane/langgraph` with `apiUrl` and `assistantId`. On the backend,
declare a `client_tools` channel in your LangGraph `State`, call
`bind_client_tools(llm, [], state)` from `threadplane.client_tools`, route
unconditionally to `END`, and compile the graph **without** a checkpointer —
the LangGraph platform provides one.
</Prompt>

<Steps>
<Step title="Configure the LangGraph provider (frontend)">

Use `provideAgent` from `@threadplane/langgraph` with an `apiUrl` pointing at
your LangGraph deployment and an `assistantId` that matches the graph id in
`langgraph.json`:

```typescript
// app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideAgent } from '@threadplane/langgraph';
import { provideChat } from '@threadplane/chat';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAgent({
      apiUrl: environment.langGraphApiUrl,
      assistantId: environment.clientToolsAssistantId,
    }),
    provideChat({}),
  ],
};
```

The `assistantId` value (`'client-tools'`) corresponds to the key in
`langgraph.json`:

```json
{
  "graphs": {
    "client-tools": "./src/graph.py:graph"
  }
}
```

</Step>
<Step title="Declare the client tool registry (frontend)">

The registry is identical to the AG-UI example — `tools()` from
`@threadplane/chat`, each entry an `action`, `view`, or `ask`. Pass it to
`<chat>` via `[clientTools]`:

```typescript
// client-tools.component.ts
import { ChatComponent, tools, action, view, ask } from '@threadplane/chat';
import { injectAgent } from '@threadplane/langgraph';
import { z } from 'zod/v4';
import { WeatherCardComponent } from './weather-card.component';
import { ConfirmBookingComponent } from './confirm-booking.component';

const clientTools = tools({
  get_weather: action(
    'Look up the current weather for a location.',
    z.object({ location: z.string() }),
    async ({ location }) => ({ location, temperatureF: 68, conditions: 'Sunny', humidity: 55, windMph: 8 }),
  ),
  weather_card: view(
    'Display a weather card for a location with the given readings.',
    z.object({
      location: z.string(),
      temperatureF: z.number(),
      conditions: z.string(),
      humidity: z.number(),
      windMph: z.number(),
    }),
    WeatherCardComponent,
  ),
  confirm_booking: ask(
    'Ask the user to confirm a booking before finalizing it.',
    z.object({ summary: z.string() }),
    ConfirmBookingComponent,
  ),
});

// In the component template:
// <chat main [agent]="agent" [clientTools]="clientTools" />
```

The only frontend difference from the AG-UI example is the import of
`injectAgent` — it comes from `@threadplane/langgraph` here, not
`@threadplane/ag-ui`.

</Step>
<Step title="How the LangGraph adapter ships the catalog">

The `@threadplane/langgraph` adapter delivers the client tool catalog
differently from the AG-UI adapter:

- **On every `submit`**, the adapter includes the full catalog in the run's
  `input` field: `{ messages: [...], client_tools: [...] }`. LangGraph's
  `add_messages` reducer appends the new message; the `client_tools` channel
  is overwritten with the latest catalog each turn.
- **On `resolve`** (after an `ask` returns a value), the adapter issues a new
  run on the same thread with `input: { messages: [<ToolMessage>], client_tools: [...] }`.
  The ToolMessage is appended; the catalog is re-delivered so the model can
  call further client tools in the same conversation.

This is the key transport difference from AG-UI, where the catalog travels in
`RunAgentInput.tools` as a first-class AG-UI field and is merged into
`state['tools']` by the `ag-ui-langgraph` middleware.

</Step>
<Step title="Declare the State and bind client tools (backend)">

Declare a `client_tools` channel in `State` so the catalog survives across the
turn. Call `bind_client_tools(llm, [], state)` — it reads `state['tools']`
first, falling back to `state['client_tools']`, and binds the stubs onto the
model with no server-side implementation. Route unconditionally to `END`:

```python
# graph.py
from langchain_core.messages import SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from typing_extensions import Annotated, TypedDict

from threadplane.client_tools import bind_client_tools

class State(TypedDict):
    messages: Annotated[list, add_messages]
    # The @threadplane/langgraph adapter ships the client tool catalog here.
    client_tools: list

_base_llm = ChatOpenAI(model="gpt-4o-mini", streaming=True)

def build_client_tools_graph():
    async def agent(state: State) -> dict:
        # bind_client_tools reads state['tools'] then falls back to state['client_tools'].
        llm = bind_client_tools(_base_llm, [], state)
        system = (PROMPTS_DIR / "client-tools.md").read_text()
        response = await llm.ainvoke([SystemMessage(content=system)] + state["messages"])
        return {"messages": [response]}

    def route(state: State) -> str:
        return END  # no server tools: a client tool call ends the run

    graph = StateGraph(State)
    graph.add_node("agent", agent)
    graph.set_entry_point("agent")
    graph.add_conditional_edges("agent", route, {END: END})
    return graph.compile()  # no checkpointer — the platform provides one

graph = build_client_tools_graph()
```

Start the backend under `langgraph dev` (the platform runtime provides the
checkpointer and thread management):

```bash
uv run langgraph dev --port 5308
```

<Warning>
Do **not** pass `checkpointer=MemorySaver()` here. Under `langgraph dev` and
the LangGraph Cloud platform, the runtime injects its own checkpointer — if
you compile with one yourself, you get a double-checkpointer conflict that
breaks persistence. This is the opposite of the AG-UI example, which uses an
explicit `MemorySaver()` because the FastAPI server manages its own lifecycle.
</Warning>

</Step>
<Step title="Frozen ask cards after resolution">

The `confirm_booking` ask component freezes automatically after the user
responds. The adapter writes the emitted result back onto the stored tool call;
`chat-tool-views` spreads `{ ...args, ...result, status }` into the component's
inputs. The component declares a `confirmed` input that defaults to `undefined`
— when it becomes defined, the buttons disappear and a frozen line is rendered
instead.

See the [AG-UI client tools guide — ask step](/ag-ui/core-capabilities/client-tools/overview/python)
for the full component code and the `@if (confirmed() === undefined)` template
pattern. The `ConfirmBookingComponent` is **identical** in both the AG-UI and
LangGraph examples — no changes are needed when switching transports.

</Step>
</Steps>

<Tip>
Because the LangGraph adapter re-sends the full `client_tools` catalog on every
run, the catalog is always current even if the Angular component re-renders
between turns. This also means you can update the tool registry dynamically —
any change to the `tools()` call takes effect on the next submit without
restarting the backend.
</Tip>

<Related>
- [AG-UI Client Tools](/ag-ui/core-capabilities/client-tools/overview/python) — The same three behaviors over the AG-UI transport, with the full conceptual walkthrough of `action`, `view`, and `ask`
- [LangGraph Streaming](/langgraph/core-capabilities/streaming/overview/python) — Real-time token streaming with the LangGraph adapter
- [LangGraph Interrupts](/langgraph/core-capabilities/interrupts/overview/python) — Human-in-the-loop approval with `interrupt()` and `stream.submit({ resume })`
</Related>
