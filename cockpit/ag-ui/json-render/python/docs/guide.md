# Backend-Driven Generative UI with AG-UI Shared State

<Summary>
Let the agent author a UI layout AND stream its data over AG-UI. The agent
sends a json-render spec as the assistant message — the chat lib mounts it
against your `views` registry — while the dashboard's numbers arrive as
**agent shared state** (AG-UI `STATE_SNAPSHOT` / `STATE_DELTA`). The spec's
`$state` bindings resolve against that state, so the same layout re-renders
as the backend updates the data.
</Summary>

<Prompt>
Render a backend-authored dashboard with `@threadplane/chat` over the AG-UI adapter. Register your view components in the `views` map and pass it to `<chat>`. Have the agent emit a json-render spec (with `$state` bindings) as the assistant message content, and put the data the spec binds to in the LangGraph graph state so `ag-ui-langgraph` emits it as a `STATE_SNAPSHOT`. The chat composition resolves the bindings automatically.
</Prompt>

<Steps>
<Step title="Register the view components">

Build a `views` registry keyed by the component types your spec will reference, and pass it to `<chat>`:

```typescript
// json-render.component.ts
import { ChatComponent, views } from '@threadplane/chat';
import { injectAgent } from '@threadplane/ag-ui';
import { StatCardComponent } from './views/stat-card.component';
import { DashboardGridComponent } from './views/dashboard-grid.component';
// …line-chart, bar-chart, data-grid, container

const dashboardViews = views({
  stat_card: StatCardComponent,
  dashboard_grid: DashboardGridComponent,
  // …
});
```

```html
<chat main [agent]="agent" [views]="dashboardViews" />
```

</Step>
<Step title="Configure the AG-UI provider">

```typescript
// app.config.ts
import { provideAgent } from '@threadplane/ag-ui';
import { provideChat } from '@threadplane/chat';

export const appConfig: ApplicationConfig = {
  providers: [provideAgent({ url: '/agent' }), provideChat({})],
};
```

</Step>
<Step title="Emit the layout spec from the agent">

The agent authors the layout once and returns it as JSON. A post-process node
moves that payload into the assistant message content, where the chat lib's
content classifier detects the leading `{` and mounts the render surface. Each
data prop uses a `$state` binding rather than a literal:

```json
{
  "elements": {
    "on_time_card": {
      "type": "stat_card",
      "props": { "label": "On-time %", "value": { "$state": "/on_time/value" } }
    }
  },
  "root": "..."
}
```

</Step>
<Step title="Deliver the data as agent shared state">

This is the AG-UI-native part. Instead of pushing data through a side channel,
put it in the **graph state** — `ag-ui-langgraph` emits the state object as a
`STATE_SNAPSHOT`, the adapter writes it to the agent's `state` signal, and the
chat composition syncs it into the render store where the `$state` bindings
resolve:

```python
# graph.py — emit_state returns the accumulated tool data into state
async def emit_state(state: DashboardState) -> dict:
    updates: dict = {}
    for msg in reversed(state["messages"]):
        if getattr(msg, "type", None) == "tool" and msg.name == "query_airline_kpis":
            updates.update(json.loads(msg.content))  # {on_time: {value, delta}, …}
        # …other data tools
    return updates  # becomes top-level state fields → STATE_SNAPSHOT
```

The spec binding `/on_time/value` resolves to `state.on_time.value`. Run the
backend with:

```bash
uv run uvicorn src.server:app --port 5323
```

<Warning>
A field is only visible to the frontend if it is in the graph's **output
schema** — `ag-ui-langgraph` filters the snapshot to output-schema keys.
Declare every bound field on `DashboardState` (a plain `StateGraph(State)` uses
its state schema as the output schema). Also: `ag-ui-langgraph` requires a
checkpointer — the graph uses `MemorySaver` for development.
</Warning>

</Step>
</Steps>

<Tip>
The same `views` registry powers tool-driven rendering too — a component you
register here is reusable for the tool-views pattern with no changes. The only
difference is where the layout and data come from: a backend spec + shared
state here, versus a tool call's args/result there.
</Tip>

<Related>
- [AG-UI Tool Views](/ag-ui/core-capabilities/tool-views/overview/python) — Frontend component keyed by tool name (no spec on the wire)
- [AG-UI A2UI](/ag-ui/core-capabilities/a2ui/overview/python) — Backend-authored A2UI surfaces in message content
- [AG-UI Streaming](/ag-ui/core-capabilities/streaming/overview/python) — Real-time token streaming with the AG-UI adapter
</Related>
