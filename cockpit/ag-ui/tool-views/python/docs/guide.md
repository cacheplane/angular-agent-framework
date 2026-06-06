# Tool-Driven View Rendering with AG-UI and Angular

<Summary>
Render a frontend component for a tool call by reusing the `views` registry
from `@threadplane/chat`. The agent calls a tool by name and returns plain
data; the frontend owns a component keyed by that name and renders it live
from the call's arguments, result, and status — no UI spec crosses the wire.
</Summary>

<Prompt>
Render a custom component for a tool call using `@threadplane/chat`. Register the component in the `views` map keyed by the tool's name, pass `views` to the `<chat>` component, and call the matching tool by name from your LangGraph agent. The chat composition bridges the tool call into the render pipeline automatically.
</Prompt>

<Steps>
<Step title="Register a view keyed by the tool name">

Build a `views` registry whose key matches the tool the agent calls:

```typescript
// tool-views.component.ts
import { views } from '@threadplane/chat';
import { WeatherCardComponent } from './weather-card.component';

readonly views = views({ weather_card: WeatherCardComponent });
```

The key (`weather_card`) is both the registry key and the tool name the
agent calls — one identifier, one mental model.

</Step>
<Step title="Pass the registry to the chat component">

```html
<chat main [agent]="agent" [views]="views" />
```

When a tool call's name matches a `views` key, the chat composition renders
the registered component inline in the transcript instead of the default
tool card.

</Step>
<Step title="Author the view component">

The component declares an input per field it renders. It receives the live
arguments while the call streams and the merged result on completion, plus a
`status` of `'running'` or `'complete'`:

```typescript
// weather-card.component.ts (excerpt)
readonly location = input<string>();
readonly temperatureF = input<number>();
readonly status = input<'running' | 'complete'>();
```

</Step>
<Step title="Call the tool by name from the agent">

The LangGraph agent binds a tool whose name matches the registered view and
returns plain JSON. The tool call and result travel over AG-UI's
`TOOL_CALL_*` events:

```python
# graph.py
@tool
async def weather_card(location: str) -> dict:
    return {"location": location, "temperatureF": 68, "conditions": "Sunny",
            "humidity": 55, "windMph": 8}
```

Run the backend with:

```bash
uv run uvicorn src.server:app --port 5322
```

<Warning>
A checkpointer is required for `ag-ui-langgraph` to call `graph.aget_state()`.
The graph in `src/graph.py` uses `MemorySaver` for development.
</Warning>

</Step>
</Steps>

<Tip>
The same `views` registry powers backend-sent render specs too — a component
you register here is reusable across tool-driven rendering and spec rendering.
</Tip>

<Related>
- [AG-UI Streaming](/ag-ui/core-capabilities/streaming/overview/python) — Real-time token streaming with the AG-UI adapter
- [AG-UI Interrupts](/ag-ui/core-capabilities/interrupts/overview/python) — Human-in-the-loop approval using the AG-UI adapter
</Related>
