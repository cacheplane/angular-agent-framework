# Browser-Executed Client Tools with AG-UI

<Summary>
Declare tools in the Angular app — with a description, a Zod schema, and a
handler — and have the **model** call them while the **browser** executes them.
Three behaviors are supported: `action` (async function whose return becomes the
tool result), `view` (Angular component the model fills with props, rendered
inline and auto-acknowledged), and `ask` (interactive HITL component whose
emitted value resumes the run). The catalog is shipped to the model via the
AG-UI adapter's native `RunAgentInput.tools` field; the LangGraph backend binds
the client stubs with no server implementation and ends the turn so the browser
runs the tool and re-submits with a `ToolMessage`, which the model then
summarizes.
</Summary>

<Prompt>
Declare client tools in the Angular app using `tools()`, `action()`, `view()`,
and `ask()` from `@threadplane/chat`, with schemas authored in `zod/v4`. Pass
the registry to `<chat [clientTools]="...">`. On the backend, declare a `tools`
channel in your LangGraph `State`, call `bind_client_tools(llm, [], state)` from
`threadplane.middleware.langgraph`, and route unconditionally to `END` — there are no
server-side tool implementations.
</Prompt>

<Steps>
<Step title="Declare the client tool registry (frontend)">

Build a registry with `tools()` from `@threadplane/chat`. Each entry is one of
three behaviors — `action`, `view`, or `ask` — all keyed by the tool name the
model will call. Schemas are authored with `zod/v4`; the AG-UI adapter derives
the JSON Schema the model sees using `zod/v4`'s `toJSONSchema`.

```typescript
// client-tools.component.ts
import { ChatComponent, tools, action, view, ask } from '@threadplane/chat';
import { injectAgent } from '@threadplane/ag-ui';
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
```

Pass the registry to `<chat>` via the `[clientTools]` input:

```html
<chat main [agent]="agent" [clientTools]="clientTools" />
```

</Step>
<Step title="Understand the three behaviors">

**`action` — async function.** When the model calls `get_weather`, the handler
runs in the browser. Its resolved return value becomes the `ToolMessage` content
that re-enters the model:

```typescript
get_weather: action(
  'Look up the current weather for a location.',
  z.object({ location: z.string() }),
  async ({ location }) => ({ location, temperatureF: 68, conditions: 'Sunny', humidity: 55, windMph: 8 }),
),
```

**`view` — inline component, auto-acknowledged.** When the model calls
`weather_card`, the chat lib mounts `WeatherCardComponent` directly in the
message thread. The component receives the tool call's arguments as Angular
`input()` signals (plus a `status` signal of `'running' | 'complete'`). The
result is acknowledged automatically — no user interaction required:

```typescript
// weather-card.component.ts
export class WeatherCardComponent {
  readonly location = input<string>();
  readonly temperatureF = input<number>();
  readonly conditions = input<string>();
  readonly humidity = input<number>();
  readonly windMph = input<number>();
  readonly status = input<'running' | 'complete'>();

  readonly pending = computed(() => this.status() !== 'complete' || this.temperatureF() === undefined);
}
```

**`ask` — interactive HITL component.** When the model calls `confirm_booking`,
`ConfirmBookingComponent` is mounted. The model fills the `summary` input; the
user responds by clicking Confirm or Cancel. The component calls
`injectRenderHost().result(value)` — that value becomes the `ToolMessage`
content that resumes the run.

Once the ask resolves, the adapter writes the emitted result back onto the local
tool call; `chat-tool-views` then spreads `{ ...args, ...result, status }` back
into the component's inputs. The component declares an optional `confirmed`
input (defaulting to `undefined`) and uses it to decide whether to render the
interactive card or a frozen, button-less resolved state:

```typescript
// confirm-booking.component.ts
import { input } from '@angular/core';
import { injectRenderHost } from '@threadplane/render';

export class ConfirmBookingComponent {
  readonly summary = input<string>();
  /** Spread back onto props after the ask resolves (undefined while interactive). */
  readonly confirmed = input<boolean | undefined>(undefined);
  private readonly host = injectRenderHost();

  protected respond(confirmed: boolean): void {
    this.host.result({ confirmed });
  }
}
```

The template branches on `confirmed()` to freeze the card once resolved:

```html
@if (confirmed() === undefined) {
  <div class="cb">
    <p class="cb__summary">{{ summary() }}</p>
    <div class="cb__actions">
      <button type="button" (click)="respond(true)">Confirm</button>
      <button type="button" (click)="respond(false)">Cancel</button>
    </div>
  </div>
} @else if (confirmed() === true) {
  <div class="cb cb--resolved">
    <p class="cb__summary">Booking confirmed ✓</p>
  </div>
} @else {
  <div class="cb cb--resolved">
    <p class="cb__summary">Booking cancelled</p>
  </div>
}
```

<Tip>
The `confirmed` input is `undefined` for the entire interactive lifetime of the
card — buttons are live. The moment the user clicks, `host.result({ confirmed })`
is called, the adapter resolves the tool call and writes the emitted value back
onto the stored tool call, and `chat-tool-views` re-renders the component with
`confirmed` set to the user's choice. Declare the input with a default of
`undefined` (not `required`) so Angular does not throw when it is absent on the
first render.
</Tip>

</Step>
<Step title="Declare the State and bind client tools (backend)">

The backend graph must declare a `tools` channel in its `State` so that
`ag-ui-langgraph`'s merged client catalog is retained across the turn. The
`agent` node calls `bind_client_tools(llm, [], state)` from
`threadplane.middleware.langgraph`, which binds the client stubs (no server
implementation) onto the model for this invocation:

```python
# graph.py
from langchain_core.messages import SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langgraph.checkpoint.memory import MemorySaver
from typing_extensions import Annotated, TypedDict

from threadplane.middleware.langgraph import bind_client_tools

class State(TypedDict):
    # `tools` holds the client tool catalog ag-ui-langgraph merges in from
    # RunAgentInput.tools — declared as a channel so the graph retains it.
    messages: Annotated[list, add_messages]
    tools: list

_base_llm = ChatOpenAI(model="gpt-4o-mini", streaming=True)

async def agent(state: State) -> dict:
    llm = bind_client_tools(_base_llm, [], state)
    system = (PROMPTS_DIR / "client-tools.md").read_text()
    response = await llm.ainvoke([SystemMessage(content=system)] + state["messages"])
    return {"messages": [response]}
```

Because there are no server tools, there is no tool loop. The `route` function
returns `END` unconditionally — a client tool call ends the turn, the browser
executes the tool, and the re-submitted `ToolMessage` starts a new turn that the
model summarizes:

```python
def route(state: State) -> str:
    return END

graph = StateGraph(State)
graph.add_node("agent", agent)
graph.set_entry_point("agent")
graph.add_conditional_edges("agent", route, {END: END})
graph = graph.compile(checkpointer=MemorySaver())
```

Start the backend with:

```bash
uv run uvicorn src.server:app --port 5325
```

<Warning>
Three requirements must all be met or the feature silently breaks:

1. **The `State` must declare a `tools` channel.** `ag-ui-langgraph` merges the
   client catalog into `state["tools"]`; if the field is absent the catalog is
   dropped and `bind_client_tools` has nothing to bind — the model will not see
   any tools.

2. **Schemas must be authored with `zod/v4`.** The AG-UI adapter derives the
   JSON Schema the model receives using `zod/v4`'s `toJSONSchema`. Schemas from
   `zod` (v3) produce a different derivation and may not round-trip correctly.

3. **`ag-ui-langgraph` requires a checkpointer.** The graph must be compiled
   with `checkpointer=MemorySaver()` (or an equivalent persistent checkpointer)
   or the adapter cannot maintain per-thread state across the action/ask turns.
</Warning>

</Step>
</Steps>

<Tip>
A component registered as an `ask` or `view` client tool uses the same render
contract as a backend tool-view component — `input()` signals for props and
`injectRenderHost()` for result emission. This means the same Angular component
can serve double duty: register it in the `views` registry for backend tool-view
rendering and in the client `tools` registry for client-side ask/view calls, with
no changes to the component itself. Mixing server tools and client tools in the
same graph is also supported: pass the server tool list as the second argument to
`bind_client_tools(llm, server_tools, state)` and add the standard server-tool
routing alongside the client-tool END branch.
</Tip>

<Related>
- [AG-UI Tool Views](/ag-ui/core-capabilities/tool-views/overview/python) — Backend tool call rendered as a frontend component
- [AG-UI JSON Render](/ag-ui/core-capabilities/json-render/overview/python) — Backend shared-state generative UI with `$state` bindings
- [AG-UI A2UI](/ag-ui/core-capabilities/a2ui/overview/python) — Backend-authored A2UI surfaces in message content
</Related>
