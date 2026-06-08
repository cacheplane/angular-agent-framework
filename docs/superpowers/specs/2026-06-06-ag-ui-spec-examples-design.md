# AG-UI Backend-Spec Examples (json-render + a2ui) — Design

**Date:** 2026-06-06
**Status:** Design — pending review
**Scope:** PR-B of the generative-UI effort. Two cockpit examples that demonstrate **backend-sent UI specs over AG-UI**: `ag-ui/json-render` (agent emits a json-render spec in message content) and `ag-ui/a2ui` (agent emits an A2UI envelope in message content). These are the AG-UI counterparts to the existing LangGraph examples `chat/generative-ui` and `chat/a2ui`, completing the trio started by `ag-ui/tool-views` (PR-A, shipped in #600).

**Delivery:** one spec (this document) → **two PRs**. PR-B1 = `ag-ui/json-render`; PR-B2 = `ag-ui/a2ui`. json-render lands first.

## Problem

The cockpit now has three AG-UI examples (`streaming`, `interrupts`, `tool-views`). PR-A demonstrated the **frontend-owned, tool-name-keyed** rendering pattern (`tool-views`). The two remaining canonical patterns are **backend-sent specs**, already demonstrated over the LangGraph runtime but not over AG-UI:

- **json-render:** the agent authors a render spec (`{ root, elements }`) and delivers it as the AI message's content; the chat lib's content classifier mounts `<chat-generative-ui>` against a `views` registry.
- **A2UI:** the agent emits an A2UI envelope (a `---a2ui_JSON---`-prefixed JSONL blob) as the AI message's content; the classifier mounts `<a2ui-surface>` against a catalog.

Demonstrating both over AG-UI completes the "same UI capability, AG-UI runtime instead of LangGraph" story the cockpit already tells for `streaming`.

## Key architectural finding (why this is example-only work)

**UI spec delivery** requires no changes; **dashboard data delivery for json-render** does (one small, runtime-neutral chat-lib enhancement). Verified during exploration + research:

1. **The content classifier is adapter-agnostic** (`libs/chat/src/lib/streaming/content-classifier.ts`). It classifies any AI message content string by its first non-whitespace character: `{` → `json-render`, the `---a2ui_JSON---` prefix → `a2ui`, otherwise `markdown`. It does not know or care which runtime produced the string.
2. **The AG-UI reducer preserves raw content intact** (`libs/ag-ui/src/lib/reducer.ts`): `TEXT_MESSAGE_CONTENT` accumulates the delta onto `message.content` verbatim, and `MESSAGES_SNAPSHOT` bridges `m.content` through unchanged. So a backend that emits spec JSON or an A2UI envelope as message content reaches the classifier exactly as sent.
3. **Both runtimes share the same `<chat>` composition** — `provideAgent({...})` selects the adapter; `provideChat({})` and the `[views]` input are identical.

So the **spec/envelope** travels fine over AG-UI with no changes. The catch is the json-render dashboard's **data** (the numbers bound into the spec's `$state` props). The LangGraph `chat/generative-ui` backend pushes that data via `get_stream_writer()` custom stream events — and a runtime test confirmed those **do not survive `ag-ui-langgraph`** (it consumes `astream_events`, where stream-writer payloads never appear; the data is silently dropped). A2UI is unaffected (its data model lives inside the `---a2ui_JSON---` envelope in message content).

The idiomatic AG-UI fix is to deliver dashboard data as **agent shared state**: AG-UI's first-class `STATE_SNAPSHOT` / `STATE_DELTA` events. `ag-ui-langgraph` auto-emits `STATE_SNAPSHOT` from the graph's state object (filtered to the graph's `output_schema` keys) at node boundaries, and the AG-UI reducer already maps `STATE_SNAPSHOT`/`STATE_DELTA` into the agent `state` signal (`reducer.ts:203-216`). The **one missing link** is that the `<chat>` composition does not currently feed `agent.state()` into the render store — it only feeds it from `events$` `state_update` custom events (`chat.component.ts:489-494`). So `ag-ui/json-render` adds a small, runtime-neutral effect that syncs the agent state signal into the render store. This makes `ag-ui/json-render` the cockpit's first demonstration of AG-UI's shared-state → generative-UI mechanism.

Net: `ag-ui/json-render` (PR-B1) = backend graph (data in state) + the small chat-lib state→store effect + Angular wiring + registry. `ag-ui/a2ui` (PR-B2) = purely example work (no lib change).

## Constraint

Per the repo owner: make **no reference or mention of the two external projects flagged during brainstorming** in code, docs, comments, or commits. Describe all patterns generically.

Per the repo's **standalone-examples** rule: duplicate the graph/views code from the `chat/*` siblings into each new example. Never import or share example code across examples.

## Non-goals

- Any `libs/ag-ui` adapter change (the reducer already supports `STATE_SNAPSHOT`/`STATE_DELTA`).
- Any chat-lib change beyond the single state→render-store sync effect needed by json-render.
- New rendering capabilities or new `views`/catalog primitives.
- Changing the existing LangGraph `chat/generative-ui` or `chat/a2ui` examples.
- Predictive/optimistic mid-run state (`STATE_DELTA` from streaming tool args) — out of scope; the backend emits authoritative state at node boundaries only.
- Fresh domains — the ports reuse the existing airline domains verbatim (decided).

---

## PR-B1: `ag-ui/json-render` (ports 4323 / 5323)

A port of `chat/generative-ui` onto the AG-UI runtime, with the data channel switched from custom stream events to **agent shared state** (the idiomatic AG-UI mechanism).

### Backend — `cockpit/ag-ui/json-render/python/`

Duplicate `cockpit/chat/generative-ui/python/src/` graph code, with one substantive change to the data channel:
- **Copied verbatim:** the `render_spec` tool (returns `{"elements": ..., "root": ...}` JSON), the four airline data-tools, the `wrap_spec_into_ai` post-processor (puts spec JSON in AI message content via the id-match reducer), the continuation loop (`agent ↔ tools → wrap_spec_into_ai → agent`), `finalize`, `respond`, and `generate_title` nodes, the system prompt, and the `dashboard_tools` module — copied into this example's `src/`.
- **Changed — `emit_state`:** instead of `get_stream_writer()({"name":"state_update","data":...})` (which `ag-ui-langgraph` silently drops), the node **returns the accumulated data into graph state** so `ag-ui-langgraph` auto-emits it as `STATE_SNAPSHOT`. This requires: (a) `DashboardState` declares explicit typed fields for the data the spec binds to (e.g. `on_time_trend`, `flights_by_airline`, `recent_disruptions`, and the KPI sections) rather than being bare `MessagesState`; (b) those fields are in the graph's **output schema** (ag-ui-langgraph's `get_state_snapshot` filters the snapshot to output-schema keys, so a field not in the schema is dropped from the wire); (c) `emit_state` returns a dict of those fields (a state update) instead of calling the stream writer. The render spec's `$state` bindings (`/on_time_trend`, `/kpis/...`, etc.) must match these state field paths — keep the prompt's binding convention and the state field layout aligned. No tool result shape changes; only where the accumulated data lands.

Swap the server: `server.py` uses
```python
from ag_ui_langgraph import LangGraphAgent, add_langgraph_fastapi_endpoint
from .graph import graph
agent = LangGraphAgent(name="json-render", graph=graph)
app = FastAPI(title="cockpit-ag-ui-json-render")
add_langgraph_fastapi_endpoint(app, agent, path="/agent")
```
Plus the standard `/ok` route, `pyproject.toml`, `requirements.txt` (generated via `uv export`), `tsconfig.json`, `.gitignore`, `src/__init__.py`, `src/index.ts` (capability module `agUiJsonRenderPythonModule`), `prompts/json-render.md`, `docs/guide.md`, and `project.json` (build + serve on 5323 + smoke + scope tags).

`generate_title` calls the LangGraph SDK against `LANGGRAPH_API_URL`. Under the ag-ui-langgraph runtime that env var is absent, and the existing node already swallows errors as a UX nicety — so title generation is a graceful no-op here. Keep the node for fidelity; no special handling needed.

### Chat-lib change — sync agent state into the render store

The `<chat>` composition currently feeds the render store only from `events$` `state_update` events (`chat.component.ts:489-494`); it never reads the agent `state` signal. Add one small, runtime-neutral effect to `ChatComponent`: when a render store is active (i.e. `resolvedStore()` is defined — which is the case whenever `views` is set) and the agent exposes a `state` signal, merge that state into the render store via `store.update(...)`. The agent `state` signal is on the neutral `Agent` contract and is populated by both adapters (the LangGraph adapter's neutral state projection and the AG-UI reducer's `STATE_SNAPSHOT`/`STATE_DELTA` handlers), so this benefits both runtimes and closes a latent gap. Exclude `messages` from the merged slice (the snapshot carries the message list, which the render store has no use for and which would bloat it on every token). This is the only shared-library change in PR-B; it ships with a unit test (drive a mock agent's `state` signal → assert the render store updates and that the `events$` path still works).

### Frontend — `cockpit/ag-ui/json-render/angular/`

Mirror `ag-ui/tool-views/angular/` structure; duplicate the dashboard view components and registry from `chat/generative-ui/angular/`:
- `src/app/` view components: StatCard, Container, DashboardGrid, LineChart, BarChart, DataGrid (copied from the chat example).
- Root component `json-render.component.ts` (selector `app-json-render`): `injectAgent()`, `views({ stat_card: StatCardComponent, ... })`, template `<chat main [agent]="agent" [views]="views" />` inside `<example-chat-layout>`.
- `app.config.ts`: `provideAgent({ url: '/agent' })` + `provideChat({})`.
- Standard boilerplate copied from `ag-ui/tool-views/angular/` (index.html, main.ts, main.cockpit.ts, environments, styles.css, tsconfig\*, package.json, vercel.json, proxy.conf.mjs routing `/agent` via `portsFor('cockpit-ag-ui-json-render-angular')`, `src/index.ts` capability module `agUiJsonRenderAngularModule`, project.json with build/serve/smoke/e2e).

### e2e — `cockpit/ag-ui/json-render/angular/e2e/`

Mirror the `ag-ui/tool-views` harness (`createAgUiGlobalSetup`, playwright.config, tsconfig). Port `chat/generative-ui`'s aimock fixtures into this example's `fixtures/json-render.json`, adapted to the AG-UI flow: the dashboard agent makes multiple LLM calls per turn (tool calls + `render_spec` + respond; structured-vs-text per call), so the fixture set must cover each — matching on `userMessage` + `responseFormat`/`hasToolResult` exactly as the chat example's fixtures do. The spec (`json-render.spec.ts`) submits the dashboard prompt and asserts the rendered dashboard surface shows a **state-bound value** (e.g. a known KPI number that arrives via `STATE_SNAPSHOT`, not just spec structure) — this is the gate that proves the full data path (spec content → classifier → render; data → graph state → `STATE_SNAPSHOT` → reducer → state-sync effect → render store) works end-to-end over AG-UI. Include a `manual/json-render.manual.ts` record harness documenting how to recapture fixtures against a live key.

---

## PR-B2: `ag-ui/a2ui` (ports 4324 / 5324)

A faithful port of `chat/a2ui` onto the AG-UI runtime.

### Backend — `cockpit/ag-ui/a2ui/python/`

Duplicate `cockpit/chat/a2ui/python/src/` graph code verbatim:
- The `A2UI_PREFIX` (`---a2ui_JSON---`) constant and `_wrap_envelopes(spec, root_id)` that emits the `dataModelUpdate` / `surfaceUpdate` / `beginRendering` JSONL blob into AI message content.
- The Pydantic surface schemas (BookingForm, FlightResults, Confirmation) and `_emit_with_retry` structured-output helper (`method="function_calling"`, retry on ValidationError).
- The multi-node flow (`build_form` → `search_flights` → `confirm_booking`), each node returning `{"messages": [AIMessage(content=_wrap_envelopes(spec))]}` — copied as-is.

Swap the server to `LangGraphAgent(name="a2ui", graph=graph)` + `add_langgraph_fastapi_endpoint(app, agent, "/agent")`, plus the standard scaffolding (pyproject/requirements/tsconfig/__init__/index.ts `agUiA2uiPythonModule`/prompts/docs/project.json on 5324).

### Frontend — `cockpit/ag-ui/a2ui/angular/`

Mirror `ag-ui/tool-views/angular/`; root component `a2ui.component.ts` (selector `app-a2ui`) passes the stock catalog: `views = a2uiBasicCatalog()`, template `<chat main [agent]="agent" [views]="views" />`. `app.config.ts` = `provideAgent({ url: '/agent' })` + `provideChat({})`. Standard boilerplate + `src/index.ts` capability module `agUiA2uiAngularModule` + proxy via `portsFor('cockpit-ag-ui-a2ui-angular')`.

### e2e — `cockpit/ag-ui/a2ui/angular/e2e/`

Mirror the harness; port `chat/a2ui`'s fixtures to `fixtures/a2ui.json` (structured-output entries match on `responseFormat: "json_schema"` + the booking userMessage, returning the JSON surface content). The spec (`a2ui.spec.ts`) submits a booking prompt and asserts the rendered A2UI surface (e.g. a known field/label from the booking form) appears. Include `manual/a2ui.manual.ts`.

---

## Wiring (per PR)

Each PR adds, for its example:
- `cockpit/ports.mjs`: `cockpit-ag-ui-json-render-angular: { angular: 4323, langgraph: 5323 }` (B1); `cockpit-ag-ui-a2ui-angular: { angular: 4324, langgraph: 5324 }` (B2).
- `apps/cockpit/scripts/capability-registry.ts`: `{ id: 'ag-ui-json-render', product: 'ag-ui', topic: 'json-render', angularProject: 'cockpit-ag-ui-json-render-angular', port: 4323, pythonPort: 5323, pythonDir: 'cockpit/ag-ui/json-render/python' }` (B1); analogous `ag-ui-a2ui` at 4324/5324 (B2). No `graphName` (ag-ui convention).
- `apps/cockpit/src/lib/route-resolution.ts`: import + register `agUiJsonRenderPythonModule` (B1) / `agUiA2uiPythonModule` (B2) in `capabilityModules`.
- `libs/cockpit-registry/src/lib/manifest.ts`: append to the ag-ui core-capabilities list — `[…, 'tool-views', 'json-render']` (B1), then `[…, 'json-render', 'a2ui']` (B2). Update `manifest.spec.ts` expected-topic list + capability count accordingly.
- The Railway `deployments/ag-ui-dev/` generator picks new ag-ui caps from the registry automatically — no manual prod-deploy wiring.

## Error handling

- Backend emits malformed spec/envelope → the classifier falls back to rendering the content as markdown (existing behavior); the e2e fixtures are deterministic so this path isn't exercised in CI.
- `generate_title` (json-render) with no `LANGGRAPH_API_URL` → graceful no-op (existing error-swallowing node).
- A2UI structured-output validation failure → `_emit_with_retry` retries up to its cap (copied behavior); fixtures return valid specs.

## Testing

Per example:
- **smoke**: module-shape check (`agUi{JsonRender,A2ui}{Python,Angular}Module` id + title), `scope:cockpit-smoke` tag on python.
- **e2e**: Playwright via `createAgUiGlobalSetup` (uvicorn under aimock replay + Angular dev server), asserting the rendered surface (and, for json-render, a state-bound data value). Fixtures ported from the corresponding `chat/*` example and adapted to AG-UI's per-LLM-call matching.
- **manual record harness** per example for fixture recapture.
- **chat-lib unit test (PR-B1 only)**: a vitest spec for the new state→render-store sync effect — drive a mock agent's `state` signal (with and without a render store / `views`), assert the render store receives the merged state (minus `messages`) and that the existing `events$` `state_update` path is unaffected.
- A2UI (PR-B2): no new lib unit tests (the content-classifier + envelope path is already covered and verified over AG-UI).

## Risks

- **State-path correctness (json-render)** is the chief risk and the reason for Approach STATE: the dashboard data must (a) land in graph state fields that are (b) included in the graph's **output schema** (else `ag-ui-langgraph`'s `get_state_snapshot` filters them out), and (c) match the spec's `$state` binding paths, then (d) reach the render store via the new sync effect. A mismatch at any step renders an empty dashboard. The implementation plan front-loads a thin end-to-end vertical slice (minimal state field → STATE_SNAPSHOT → one stat card) before porting all six view components, so this path is proven early. The e2e asserts a state-bound value, not just spec structure.
- **Render-store merge hygiene**: the state snapshot includes `messages`; the sync effect must exclude it so the render store isn't bloated per-token. Covered by the chat-lib unit test.
- **Fixture surface**: the full generative-ui agent makes several LLM calls per turn (tool loop + `render_spec` + respond + title) and a2ui uses structured output with retry, so the aimock fixture set is non-trivial. Porting the existing `chat/*` fixtures plus the manual record harness mitigates this; splitting into two PRs keeps each fixture surface reviewable.
- **Standalone duplication drift**: the ported graphs duplicate the `chat/*` graphs. Intentional per the repo rule; the two copies can diverge over time. Acceptable — the examples are illustrative snapshots, not shared infrastructure.
- **Title-node env coupling** (json-render): relies on the existing node swallowing the missing-`LANGGRAPH_API_URL` error. Verified by reading the node; the e2e confirms the turn still completes.
