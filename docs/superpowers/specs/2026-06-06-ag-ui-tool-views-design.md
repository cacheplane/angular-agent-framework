# AG-UI Tool Views — Design

**Date:** 2026-06-06
**Status:** Design — pending review
**Scope:** PR-A of a two-PR effort. This spec covers (1) a chat-lib **tool-views** capability that reuses the existing `views` input and (2) the first AG-UI example that exercises it: `ag-ui/tool-views`. PR-B (the `ag-ui/json-render` + `ag-ui/a2ui` backend-spec examples) is a separate spec.

## Problem

The cockpit has two AG-UI examples (`streaming`, `interrupts`). The AG-UI adapter (`libs/ag-ui`) already reduces `TOOL_CALL_START/ARGS/END/RESULT` into a `toolCalls` signal (`{ id, name, args, status: 'running' | 'complete', result }`), but **nothing renders a custom UI component for a tool call**. Today a tool call either shows the default tool card (`ChatToolCallsComponent`) or — for the backend-spec "generative UI" path — the agent wraps a render spec into message content and the classifier renders it generically (`chat/generative-ui`).

The missing, canonical pattern is **tool-driven view rendering**: the agent simply **calls a tool by name and returns plain data**, and the **frontend owns a component** keyed by that tool name, rendering it live from the call's `args` (as they stream) / `result` (on completion) / `status`. No UI spec crosses the wire. This puts the component in the consumer's hands and is the most direct use of AG-UI tool-call events.

## Goals

- Let `ChatComponent` render a frontend component for a tool call **by reusing the existing `views` input** — when a tool call's `name` matches a `views` registry key, render that registered component inline in the transcript.
- Progressive + status-aware rendering: partial `args` while running, merged `result` on completion, `status` available to the component.
- Ship one AG-UI example (`ag-ui/tool-views`) where the agent calls a typed tool returning plain JSON and the Angular app renders a registered view component — a thin consumer of the capability.
- **One registry, one mental model**: the same `views` map already used for backend-sent specs (`chat/generative-ui`, `chat/a2ui`) now also keys tool-driven rendering. Components are reusable across both paths.

## Non-goals (this PR)

- json-render and A2UI examples (PR-B) — those are backend-sent-spec patterns on existing render infra.
- A new, separate `toolViews` input or a bespoke per-view input contract. We deliberately reuse `views`.
- Frontend-executed tools / client-side tool handlers (a separate "frontend tools" scenario).
- Changing the AG-UI adapter or the existing `genuiToolNames` / message-content classifier path.

## Design

### 1. Chat-lib capability: bridge tool calls into `views` via a synthetic spec

The render pipeline already maps a **spec element type → component** through `views` (`ViewRegistry`), converted to an `AngularRegistry` via `toRenderRegistry(views())` and rendered by `RenderSpecComponent` → `RenderElementComponent`. The key insight: **a tool name and a spec element type are the same kind of identifier — a registry key.** So we render a tool call by synthesizing a one-element spec whose element `type` is the tool name, and feeding it through the registry already built from `views`.

**Synthetic spec shape** (per matching tool call):

```ts
const spec: Spec = {
  root: toolCall.name,
  elements: {
    [toolCall.name]: {
      type: toolCall.name,                  // resolves against the views registry
      props: { ...toolCall.args, ...(toolCall.result ?? {}), status: toolCall.status },
    },
  },
};
```

- `props` merges live `args` (present while running) with `result` (on completion); `result` keys win on overlap. `status` is always present so a view component can declare a `status` input and show its own loading/empty/error states. `RenderElementComponent` already filters props down to the component's declared inputs, so extra keys are harmless.
- Rendering reuses the existing `<chat-generative-ui>` primitive (which wraps `<render-spec>`), passing `registry = toRenderRegistry(views())`, the resolved store, handlers, and `loading = toolCall.status === 'running'`. No change to `RenderSpecComponent`/`RenderElementComponent` is required — they already react to signal-input changes, so `args` accumulating and `result` arriving re-render automatically.

**New primitive `ChatToolViewsComponent`** (`libs/chat/src/lib/primitives/chat-tool-views/`):

- Inputs: `agent`, `message`, `views` (`ViewRegistry`), `store`, `handlers`.
- Resolves the message's tool calls exactly as `ChatToolCallsComponent` does (per-message scoping via `toolCallIds` / Anthropic `tool_use` blocks → `agent().toolCalls()`). This resolution logic is **extracted to a shared util** (`resolveMessageToolCalls(agent, message)`) and consumed by both primitives, keeping behavior identical.
- Filters resolved calls to those whose `name` is a key in `views()`.
- For each match, builds the synthetic spec above and renders it via `<chat-generative-ui>`.

**`ChatComponent` wiring** (no new input):

- Mount `<chat-tool-views [agent] [message] [views]="views()" [store]="resolvedStore()" [handlers]="handlers()">` in the per-message AI template, adjacent to `<chat-tool-calls>`.
- Compute view tool names once: `viewToolNames = computed(() => Object.keys(this.views() ?? {}))`.
- Exclude them from the default tool card: `<chat-tool-calls [excludeToolNames]="[...genuiToolNames(), ...viewToolNames()]">`. A tool with a registered view does **not** also show the default card.

**Why reuse `views` rather than add `toolViews`:** consumers register a component once and it works for both backend-sent specs and tool-driven rendering — one registry, one type, no decision about "which input does this component belong in." It also means the example's view components are immediately reusable in the PR-B json-render example.

### 2. Example: `ag-ui/tool-views` (ports 4322 / 5322)

**Python (ag-ui-langgraph backend).** A LangGraph graph whose agent calls a typed tool by name and returns **plain JSON data** (no spec):

```python
@tool
async def weather_card(location: str) -> dict:
    # deterministic demo data so e2e fixtures stay stable
    return {"location": location, "temperatureF": 68, "conditions": "Sunny",
            "humidity": 55, "windMph": 8}
```

Wired with `add_langgraph_fastapi_endpoint(app, LangGraphAgent(name="tool-views", graph=graph), path="/agent")`. The system prompt (`prompts/tool-views.md`) instructs the agent to answer weather questions by calling `weather_card`. (Domain is illustrative; weather makes the args→result progression obvious.) The tool **name matches the registered view key** — that pairing is the whole point of the example.

**Angular.** `provideAgent({ url: '/agent' })` (ag-ui adapter) + `provideChat({})`. A standalone `WeatherCardComponent` declares inputs (`location`, `temperatureF`, `conditions`, `humidity`, `windMph`, `status`) and renders: `location` immediately (from `args`), a loading affordance while `status === 'running'`, then the full result on completion. Wiring:

```ts
@Component({ /* main */ template: `<chat main [agent]="agent" [views]="views" />` })
class ToolViewsComponent {
  readonly agent = injectAgent();
  readonly views = views({ weather_card: WeatherCardComponent });
}
```

**Demonstrates:** AG-UI `TOOL_CALL_*` events driving a live, status-aware, frontend-owned component — keyed off the same `views` registry the render examples use, with zero UI spec sent from the backend.

### 3. Wiring checklist (the example)

Standard ag-ui topic files: `cockpit/ag-ui/tool-views/python/{pyproject.toml, src/graph.py, src/server.py, src/index.ts, prompts/tool-views.md, project.json (build + serve + smoke)}` and `.../angular/{src/app/tool-views.component.ts, src/app/weather-card.component.ts, src/app/app.config.ts, src/index.ts, project.json, vercel.json, proxy.conf.mjs, e2e/...}`. Plus:

- `cockpit/ports.mjs`: `cockpit-ag-ui-tool-views-angular: { angular: 4322, langgraph: 5322 }`.
- `apps/cockpit/scripts/capability-registry.ts`: `{ id: 'ag-ui-tool-views', product: 'ag-ui', topic: 'tool-views', angularProject: 'cockpit-ag-ui-tool-views-angular', port: 4322, pythonPort: 5322, pythonDir: 'cockpit/ag-ui/tool-views/python' }`.
- Route-resolution module registration (`agUiToolViewsPythonModule`).
- The Railway `deployments/ag-ui-dev/` generator picks the new ag-ui cap up from the registry automatically — no manual prod-deploy wiring.

## Error handling

- Tool call with a name **not** in `views` → falls through to the default `<chat-tool-calls>` card (unchanged behavior).
- Tool `status === 'complete'` with no `result` → the synthetic element's props carry only `args` + `status`; the view component renders its own empty/error state. The lib imposes no error UI.
- `views` undefined / empty → `viewToolNames()` is empty, `ChatToolViewsComponent` renders nothing, no exclusion is added, and default cards behave as today.
- Element-type collision: a `views` key is now meaningful as both a spec element type and a tool name. This is intended (unification), but consumers must avoid registering a view under a name that collides with an unrelated internal tool they want shown as a card. Documented in the input's doc comment.

## Testing

- **Lib (`ChatToolViewsComponent` + bridge)**: a vitest spec using `provideFakeAgent` (from `libs/ag-ui` testing) that drives a tool call through `running` (partial args) → `complete` (result). Assert: (a) the registered component mounts for the matching tool name, (b) it receives `args` while running and merged `result` on complete, (c) `status` is passed through, (d) a non-registered tool name does NOT mount a view and DOES show the default card, (e) registered names are excluded from `<chat-tool-calls>`.
- **Shared util (`resolveMessageToolCalls`)**: unit-covered via the existing `ChatToolCalls` tests (behavior must remain identical after extraction) plus a direct test for the new consumer.
- **Example python**: a `smoke` target (module-shape check matching the other ag-ui caps) + `scope:cockpit-smoke` tag.
- **Example e2e**: an aimock fixture per the existing ag-ui e2e pattern (deterministic `weather_card` result keeps the fixture stable); assert the weather card renders with the result values after the tool completes.

## Risks

- **Per-message tool-call resolution** currently lives inside `ChatToolCallsComponent`; extracting it to a shared util is a small refactor — keep behavior identical and covered by existing `ChatToolCalls` tests.
- **Progressive args**: the AG-UI reducer accumulates `args` during `TOOL_CALL_ARGS`; if a backend emits args only at completion, the progressive aspect degrades gracefully to result-only rendering (still correct).
- **`notReady` fallback semantics**: `RenderElementComponent` swaps to a registered fallback while any resolved prop is `undefined`. With the synthetic spec we only spread keys that exist, so a running-with-partial-args call mounts the real component (which reads `status` to show its own loading state) rather than the fallback. Verified by the lib test's "running" assertion.
- **Naming/registry overload**: reusing `views` for two rendering paths must be clearly documented so consumers understand a registered key now also matches tool names.
