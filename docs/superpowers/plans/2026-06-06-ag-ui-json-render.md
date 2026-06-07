# AG-UI json-render Example (PR-B1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the `ag-ui/json-render` cockpit example — a port of `chat/generative-ui` (airline KPI dashboard) onto the AG-UI runtime, with dashboard data delivered via AG-UI **shared state** (`STATE_SNAPSHOT`/`STATE_DELTA`) instead of custom stream events.

**Architecture:** The render spec (`{root, elements}`) is emitted in AI message content (unchanged from the LangGraph example; the content classifier mounts `<chat-generative-ui>`). The dashboard **data** is stored in the LangGraph graph state object; `ag-ui-langgraph` auto-emits it as `STATE_SNAPSHOT`; the AG-UI reducer writes it to the agent `state` signal; and a new (small, runtime-neutral) effect in `ChatComponent` syncs that state into the render store, where the spec's `$state` bindings resolve it. This is the cockpit's first AG-UI shared-state → generative-UI demo.

**Tech Stack:** Angular 20 (standalone, signals), `@threadplane/chat`, `@threadplane/render` (`@json-render/core`), `@threadplane/ag-ui`, Python LangGraph + `ag-ui-langgraph` (FastAPI/uvicorn/SSE), Nx, Vitest, Playwright + aimock fixtures.

**Branch:** `claude/ag-ui-spec-examples`. **Spec:** `docs/superpowers/specs/2026-06-06-ag-ui-spec-examples-design.md`.

**Constraint:** Make NO reference or mention of the two external projects flagged during brainstorming in code, docs, comments, or commits. Per the repo's standalone-examples rule, duplicate graph/view code into this example; never import across examples.

**Ports:** angular 4323, langgraph (backend) 5323.

---

## Key mechanism (read before starting)

- **State shape:** the render spec binds `{"$state": "/on_time/value"}`, `/on_time_trend`, etc. `signalStateStore.update(updates)` (`libs/render/src/lib/signal-state-store.ts`) treats each **key as a JSON pointer** (`parsePointer` requires a leading `/`; a key without one resolves to the root and replaces the whole store). So:
  - The backend stores data **nested** in graph state under top-level fields: `on_time: {value, delta}`, `flights_today: {...}`, `avg_delay: {...}`, `load_factor: {...}`, `on_time_trend: [...]`, `flights_by_airline: [...]`, `recent_disruptions: [...]`. (`query_airline_kpis` already returns the four `*_card` sections nested; the original `emit_state` flattened them to pointer keys — we keep them nested instead.)
  - The new chat-lib effect maps each top-level state key `k` (except `messages`) to `'/' + k` and calls `store.update({ ['/'+k]: value })`, so `/on_time/value` resolves to `state.on_time.value`.
- **output schema:** `ag-ui-langgraph`'s `get_state_snapshot` filters the snapshot to the graph's output-schema keys. `StateGraph(DashboardState)` with no explicit output schema uses the full state schema as output, so all `DashboardState` fields are included. Declare every data field on `DashboardState`.
- **`get_stream_writer` does NOT work over AG-UI** (confirmed by runtime test) — do not use it; use graph state.

## File Structure

**Chat lib (Task 1):**
- Modify: `libs/chat/src/lib/compositions/chat/chat.component.ts` — add the state→render-store sync effect.
- Create: `libs/chat/src/lib/compositions/chat/chat-state-sync.spec.ts` — unit test for the effect.

**Example backend `cockpit/ag-ui/json-render/python/`:** `.gitignore`, `src/__init__.py`, `pyproject.toml`, `requirements.txt`, `tsconfig.json`, `project.json`, `src/server.py`, `src/graph.py`, `src/dashboard_tools.py`, `src/index.ts`, `prompts/json-render.md`, `docs/guide.md`.

**Example frontend `cockpit/ag-ui/json-render/angular/`:** standard app boilerplate (mirror `ag-ui/tool-views/angular/`) + `src/app/app.config.ts`, `src/app/json-render.component.ts`, `src/app/views/{stat-card,container,dashboard-grid,line-chart,bar-chart,data-grid}.component.ts` + `views/skeleton.css`, `src/index.ts`, `e2e/...`.

**Wiring:** `cockpit/ports.mjs`, `apps/cockpit/scripts/capability-registry.ts`, `apps/cockpit/src/lib/route-resolution.ts`, `libs/cockpit-registry/src/lib/manifest.ts` (+ `manifest.spec.ts`).

---

## Task 1: Chat-lib — sync agent state into the render store (TDD)

**Files:**
- Modify: `libs/chat/src/lib/compositions/chat/chat.component.ts` (add an effect near the existing `events$` `state_update` effect at ~line 483-495)
- Create: `libs/chat/src/lib/compositions/chat/chat-state-sync.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `libs/chat/src/lib/compositions/chat/chat-state-sync.spec.ts`:

```ts
// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { views } from '@threadplane/render';
import { Component as NgComponent, input } from '@angular/core';
import { mockAgent, type MockAgent } from '../../testing/mock-agent';
import { ChatComponent } from './chat.component';
import { provideChat } from '../../provide-chat';

@NgComponent({ selector: 'x-stat', standalone: true, template: `{{ value() }}` })
class XStatComponent { readonly value = input<unknown>(); }

function mount(agent: MockAgent) {
  @Component({
    standalone: true,
    imports: [ChatComponent],
    template: `<chat [agent]="agent" [views]="reg" />`,
  })
  class Host {
    readonly agent = agent;
    readonly reg = views({ x_stat: XStatComponent });
  }
  TestBed.configureTestingModule({ providers: [provideChat({})] });
  const f = TestBed.createComponent(Host);
  f.detectChanges();
  return f;
}

describe('ChatComponent — agent state → render store sync', () => {
  it('merges agent.state() top-level keys (as JSON pointers) into the render store, excluding messages', () => {
    const agent = mockAgent({ state: {} });
    const f = mount(agent);
    const chat = f.debugElement.children[0].componentInstance.constructor; // not used; we assert via store
    // Drive a state snapshot.
    agent.state.set({ on_time: { value: 94.2, delta: '+1.1' }, messages: [{ id: 'm', role: 'assistant', content: '' }] } as Record<string, unknown>);
    f.detectChanges();
    const chatCmp = (f.nativeElement.querySelector('chat') ? f : f).componentInstance;
    // Read the resolved render store off the ChatComponent instance.
    const chatInstance = (f.debugElement.query((de) => de.componentInstance instanceof ChatComponent))?.componentInstance as ChatComponent;
    const store = (chatInstance as unknown as { resolvedStore: () => { get(p: string): unknown } }).resolvedStore();
    expect(store.get('/on_time/value')).toBe(94.2);
    expect(store.get('/on_time/delta')).toBe('+1.1');
    // messages must NOT be merged into the render store.
    expect(store.get('/messages')).toBeUndefined();
  });
});
```

NOTE to implementer: the exact handle for reading `resolvedStore()` off the component in a test may need adjusting to the repo's existing test conventions (see `chat-tool-views.component.spec.ts` for how it mounts `<chat>`-adjacent components and reads internals). If reading `resolvedStore()` directly is awkward, instead assert behaviorally: register a view bound via a spec to `/on_time/value` and assert the rendered DOM shows `94.2` after `agent.state.set(...)`. Prefer whichever is robust; the REQUIREMENT is: a state snapshot's top-level keys (except `messages`) become render-store data at `/key/...` paths.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx nx test chat -- --run chat-state-sync`
Expected: FAIL (state not synced into the store yet).

- [ ] **Step 3: Add the sync effect**

In `libs/chat/src/lib/compositions/chat/chat.component.ts`, immediately AFTER the existing effect that subscribes to `agent.events$` for `state_update` (ends ~line 495), add:

```ts
    // Sync the agent STATE signal into the render store. AG-UI delivers
    // backend state via STATE_SNAPSHOT/STATE_DELTA (the idiomatic shared-
    // state path); the reducer writes it to agent.state(). The render
    // store keys are JSON pointers, so map each top-level state key `k`
    // to `/k`. Exclude `messages` (carried in the snapshot but useless to
    // the render store and large). Runtime-neutral: any adapter exposing
    // a `state` signal benefits; no-op when no render store is active.
    effect(() => {
      let agentRef: ReturnType<typeof this.agent>;
      try { agentRef = this.agent(); } catch { return; }
      const stateFn = (agentRef as unknown as { state?: () => unknown }).state;
      if (typeof stateFn !== 'function') return;
      const state = stateFn.call(agentRef);
      const store = this.resolvedStore();
      if (!store || state == null || typeof state !== 'object' || Array.isArray(state)) return;
      const updates: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(state as Record<string, unknown>)) {
        if (k === 'messages') continue;
        updates['/' + k] = v;
      }
      if (Object.keys(updates).length > 0) store.update(updates);
    });
```

(`resolvedStore` and `effect` are already in scope/imported. Confirm `effect` is imported from `@angular/core` — it is, used by the surrounding effects.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx nx test chat -- --run chat-state-sync`
Expected: PASS.

- [ ] **Step 5: Run the full chat suite (no regression)**

Run: `npx nx test chat -- --run`
Expected: PASS (existing tests green, including the PR-A tool-views + events$ state_update path).

- [ ] **Step 6: Build**

Run: `npx nx build chat`
Expected: build succeeds.

- [ ] **Step 7: Commit**

```bash
git add libs/chat/src/lib/compositions/chat/chat.component.ts libs/chat/src/lib/compositions/chat/chat-state-sync.spec.ts
git commit -m "feat(chat): sync agent state signal into the render store

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Vertical slice — minimal `ag-ui/json-render` proving the STATE path end-to-end

Stand up the example with a MINIMAL graph and ONE view (StatCard), proving spec-in-content + data-in-state → STATE_SNAPSHOT → reducer → sync effect → render. Tasks 3-4 then replace the minimal graph with the full port and add the remaining views. This de-risks the novel data path before the bulk copy.

**Files (all Create unless noted):**
- `cockpit/ag-ui/json-render/python/{.gitignore, src/__init__.py, pyproject.toml, tsconfig.json, project.json, src/server.py, src/graph.py, src/index.ts, prompts/json-render.md}`
- `cockpit/ag-ui/json-render/angular/` full boilerplate (copy from `ag-ui/tool-views/angular/`) + `src/app/app.config.ts`, `src/app/json-render.component.ts`, `src/app/views/stat-card.component.ts`, `src/app/views/skeleton.css`, `src/index.ts`, `e2e/...`
- `cockpit/ports.mjs` (add entry), `apps/cockpit/scripts/capability-registry.ts` (add entry)

- [ ] **Step 1: Scaffold the python package + a MINIMAL graph**

`cockpit/ag-ui/json-render/python/.gitignore`:
```
__pycache__/
.venv/
```
`cockpit/ag-ui/json-render/python/src/__init__.py`:
```
# SPDX-License-Identifier: MIT
```
`cockpit/ag-ui/json-render/python/pyproject.toml` (copy from `cockpit/ag-ui/tool-views/python/pyproject.toml`, change `name = "cockpit-ag-ui-json-render"`; add `langgraph-sdk` is already transitive — keep deps identical to tool-views).
`cockpit/ag-ui/json-render/python/tsconfig.json`: copy verbatim from `cockpit/ag-ui/tool-views/python/tsconfig.json`.

`cockpit/ag-ui/json-render/python/src/graph.py` (MINIMAL slice — one render_spec emitting a single stat_card bound to `/demo/value`, and emit_state seeding `demo` into state):
```python
"""Minimal json-render slice: proves spec-in-content + data-in-state over AG-UI.

Replaced by the full dashboard port in a later task. The agent calls
render_spec once (a single stat card bound to /demo/value); wrap_spec_into_ai
puts the spec JSON into AI message content; emit_state returns the demo data
into graph state so ag-ui-langgraph emits STATE_SNAPSHOT.
"""
import json
from pathlib import Path
from typing import Optional
from typing_extensions import TypedDict, Annotated

from langchain_core.messages import AIMessage, SystemMessage, ToolMessage
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode

_PROMPT = (Path(__file__).parent.parent / "prompts" / "json-render.md").read_text()


class DashboardState(TypedDict):
    messages: Annotated[list, add_messages]
    demo: Optional[dict]


@tool
async def render_spec(elements: dict, root: str) -> str:
    """Render a dashboard layout. See system prompt for the catalog."""
    return json.dumps({"elements": elements, "root": root})


_TOOLS = [render_spec]
_llm = ChatOpenAI(model="gpt-5-mini", temperature=0, streaming=True).bind_tools(_TOOLS)


async def agent(state: DashboardState) -> dict:
    messages = [SystemMessage(content=_PROMPT)] + state["messages"]
    return {"messages": [await _llm.ainvoke(messages)]}


def route(state: DashboardState) -> str:
    last = state["messages"][-1]
    return "tools" if getattr(last, "tool_calls", None) else "emit_state"


async def wrap_spec_into_ai(state: DashboardState) -> dict:
    msgs = state["messages"]
    tool_msg = next((m for m in reversed(msgs)
                     if isinstance(m, ToolMessage) and m.name == "render_spec"), None)
    if tool_msg is None:
        return {}
    parent = next((m for m in reversed(msgs)
                   if isinstance(m, AIMessage) and m.tool_calls
                   and any(tc.get("id") == tool_msg.tool_call_id for tc in m.tool_calls)), None)
    if parent is None or (isinstance(parent.content, str) and parent.content.strip()):
        return {}
    payload = tool_msg.content if isinstance(tool_msg.content, str) else ""
    out = [
        ToolMessage(content="rendered", tool_call_id=tool_msg.tool_call_id, name="render_spec",
                    **({"id": tool_msg.id} if getattr(tool_msg, "id", None) else {})),
        AIMessage(content=payload.strip(), tool_calls=parent.tool_calls,
                  **({"id": parent.id} if getattr(parent, "id", None) else {})),
    ]
    return {"messages": out}


async def emit_state(state: DashboardState) -> dict:
    # Seed demo data into graph state → STATE_SNAPSHOT carries it to the client.
    return {"demo": {"value": 42, "delta": "+1.0"}}


_b = StateGraph(DashboardState)
_b.add_node("agent", agent)
_b.add_node("tools", ToolNode(_TOOLS))
_b.add_node("wrap_spec_into_ai", wrap_spec_into_ai)
_b.add_node("emit_state", emit_state)
_b.set_entry_point("agent")
_b.add_conditional_edges("agent", route, {"tools": "tools", "emit_state": "emit_state"})
_b.add_edge("tools", "wrap_spec_into_ai")
_b.add_edge("wrap_spec_into_ai", "agent")
_b.add_edge("emit_state", END)
graph = _b.compile()
```

`cockpit/ag-ui/json-render/python/prompts/json-render.md` (minimal slice prompt):
```markdown
# Dashboard Assistant (slice)

When the user asks for a dashboard, call `render_spec` ONCE with this exact layout and nothing else:

{"elements":{"root":{"type":"stat_card","props":{"label":"Demo","value":{"$state":"/demo/value"},"delta":{"$state":"/demo/delta"}}}},"root":"root"}

Do not output prose. Just call render_spec.
```

`cockpit/ag-ui/json-render/python/src/server.py`:
```python
# SPDX-License-Identifier: MIT
from fastapi import FastAPI
from ag_ui_langgraph import LangGraphAgent, add_langgraph_fastapi_endpoint
from .graph import graph

agent = LangGraphAgent(name="json-render", graph=graph)
app = FastAPI(title="cockpit-ag-ui-json-render")
add_langgraph_fastapi_endpoint(app, agent, path="/agent")


@app.get("/ok")
def ok() -> dict:
    return {"ok": True}
```

`cockpit/ag-ui/json-render/python/src/index.ts`: copy `cockpit/ag-ui/tool-views/python/src/index.ts` and change: topic `'json-render'`, id `'ag-ui-json-render-python'`, title `'AG-UI JSON Render (Python)'`, export name `agUiJsonRenderPythonModule`, docsPath `/docs/ag-ui/core-capabilities/json-render/overview/python`, runtimeUrl `ag-ui/json-render`, devPort 4323, asset paths under `cockpit/ag-ui/json-render/...`, codeAssetPaths pointing at `angular/src/app/json-render.component.ts` + `app.config.ts`.

`cockpit/ag-ui/json-render/python/project.json`: copy `cockpit/ag-ui/tool-views/python/project.json`, replace `tool-views`→`json-render`, port `5322`→`5323`, smoke command asserts `agUiJsonRenderPythonModule` id `ag-ui-json-render-python` + title `AG-UI JSON Render (Python)`.

Generate `requirements.txt`: `cd cockpit/ag-ui/json-render/python && uv lock && uv export --no-hashes -o requirements.txt && cd -` (fallback: copy from tool-views if uv unavailable; report which).

- [ ] **Step 2: Scaffold the Angular app (StatCard view only)**

Copy boilerplate from `cockpit/ag-ui/tool-views/angular/` (index.html, main.ts, main.cockpit.ts, styles.css, environments/*, tsconfig*, package.json, vercel.json, proxy.conf.mjs, project.json) into `cockpit/ag-ui/json-render/angular/`, swapping every `tool-views`→`json-render` and project name `cockpit-ag-ui-tool-views-angular`→`cockpit-ag-ui-json-render-angular`. In `main.ts`/`main.cockpit.ts` bootstrap `JsonRenderComponent`. `proxy.conf.mjs` uses `portsFor('cockpit-ag-ui-json-render-angular')`.

`src/app/app.config.ts`:
```ts
// SPDX-License-Identifier: MIT
import { ApplicationConfig } from '@angular/core';
import { provideAgent } from '@threadplane/ag-ui';
import { provideChat } from '@threadplane/chat';

export const appConfig: ApplicationConfig = {
  providers: [provideAgent({ url: '/agent' }), provideChat({})],
};
```

`src/app/views/stat-card.component.ts` + `src/app/views/skeleton.css`: copy VERBATIM from `cockpit/chat/generative-ui/angular/src/app/views/stat-card.component.ts` and `.../views/skeleton.css`.

`src/app/json-render.component.ts` (slice — StatCard only):
```ts
// SPDX-License-Identifier: MIT
import { Component } from '@angular/core';
import { ChatComponent, views } from '@threadplane/chat';
import { injectAgent } from '@threadplane/ag-ui';
import { ExampleChatLayoutComponent } from '@threadplane/example-layouts';
import { StatCardComponent } from './views/stat-card.component';

const dashboardViews = views({ stat_card: StatCardComponent });

@Component({
  selector: 'app-json-render',
  standalone: true,
  imports: [ChatComponent, ExampleChatLayoutComponent],
  template: `
    <example-chat-layout>
      <chat main [agent]="agent" [views]="dashboardViews" class="flex-1 min-w-0" />
    </example-chat-layout>
  `,
})
export class JsonRenderComponent {
  protected readonly agent = injectAgent();
  protected readonly dashboardViews = dashboardViews;
}
```

`src/index.ts`: copy `cockpit/ag-ui/tool-views/angular/src/index.ts`, change topic/id/title/paths to json-render, export `agUiJsonRenderAngularModule`, id `ag-ui-json-render-angular`, title `AG-UI JSON Render (Angular)`, codeAssetPaths → json-render.component.ts + app.config.ts.

- [ ] **Step 3: Ports + capability-registry entries (needed for proxy + e2e)**

In `cockpit/ports.mjs`, after the `cockpit-ag-ui-tool-views-angular` line add:
```js
  'cockpit-ag-ui-json-render-angular': { angular: 4323, langgraph: 5323 },
```
In `apps/cockpit/scripts/capability-registry.ts`, after the `ag-ui-tool-views` entry add:
```ts
  { id: 'ag-ui-json-render', product: 'ag-ui', topic: 'json-render', angularProject: 'cockpit-ag-ui-json-render-angular', port: 4323, pythonPort: 5323, pythonDir: 'cockpit/ag-ui/json-render/python' },
```

- [ ] **Step 4: e2e harness + slice fixture**

Copy `cockpit/ag-ui/tool-views/angular/e2e/{playwright.config.ts, global-setup-impl.ts, tsconfig.json}` into `cockpit/ag-ui/json-render/angular/e2e/`, swapping `tool-views`→`json-render`, project `cockpit-ag-ui-json-render-angular`, pythonCwd `cockpit/ag-ui/json-render/python`.

`cockpit/ag-ui/json-render/angular/e2e/fixtures/json-render.json` (slice — render_spec returning the one-stat-card spec):
```json
{
  "fixtures": [
    {
      "match": { "userMessage": "Show me a dashboard." },
      "response": {
        "toolCalls": [
          {
            "name": "render_spec",
            "arguments": "{\"elements\":{\"root\":{\"type\":\"stat_card\",\"props\":{\"label\":\"Demo\",\"value\":{\"$state\":\"/demo/value\"},\"delta\":{\"$state\":\"/demo/delta\"}}}},\"root\":\"root\"}"
          }
        ]
      }
    }
  ]
}
```

`cockpit/ag-ui/json-render/angular/e2e/json-render.spec.ts` (slice — proves the STATE-bound value renders):
```ts
// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';
import { submitAndWaitForResponse } from '@threadplane-internal/e2e-harness';

test('json-render: render spec mounts and the STATE_SNAPSHOT-bound value renders', async ({ page }) => {
  await submitAndWaitForResponse(page, 'Show me a dashboard.');
  // The render_spec content mounts <chat-generative-ui>; the /demo/value
  // binding (42) arrives via STATE_SNAPSHOT → agent.state() → render store.
  const card = page.locator('app-stat-card');
  await expect(card.first()).toBeVisible({ timeout: 30000 });
  await expect(card.first()).toContainText('42');
});
```

- [ ] **Step 5: Run the slice e2e — THE DE-RISK GATE**

Run: `npx nx e2e cockpit-ag-ui-json-render-angular`
Expected: PASS — `app-stat-card` renders and shows `42` (the state-bound value).

If it FAILS:
- Inspect `cockpit/ag-ui/json-render/angular/test-results/*/error-context.md` for the DOM.
- If the card mounts but shows skeleton (no `42`): the STATE path is broken. Capture the raw SSE (start backend under aimock + curl `/agent`) to see whether `STATE_SNAPSHOT` carries `demo`. Check: (a) `demo` is a `DashboardState` field (it is) and in the output schema (default schema = full state, OK); (b) the reducer set `store.state` (it does for STATE_SNAPSHOT); (c) the Task-1 sync effect ran (agent exposes `state()` — confirm the AG-UI adapter's neutral agent has a `state` signal). Report findings; do NOT paper over with a backend hack. If a genuine adapter gap surfaces (à la PR-A), STOP and report BLOCKED with the SSE capture.
- If the card does NOT mount at all: the spec content classification failed — verify `wrap_spec_into_ai` put the spec JSON into AI content (curl the SSE; the AI message content should start with `{`).

- [ ] **Step 6: smoke + build**

Run: `npx nx smoke cockpit-ag-ui-json-render-python cockpit-ag-ui-json-render-angular` and `npx nx build cockpit-ag-ui-json-render-angular`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add cockpit/ag-ui/json-render/ cockpit/ports.mjs apps/cockpit/scripts/capability-registry.ts
git commit -m "feat(cockpit): ag-ui/json-render vertical slice (state-bound render proof)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Port the full dashboard backend graph

Replace the minimal slice graph with the full `chat/generative-ui` graph, adapted so dashboard data lands in graph state (nested) instead of `get_stream_writer`.

**Files:**
- Create: `cockpit/ag-ui/json-render/python/src/dashboard_tools.py` (copy verbatim from `cockpit/chat/generative-ui/python/src/dashboard_tools.py`)
- Overwrite: `cockpit/ag-ui/json-render/python/src/graph.py`
- Overwrite: `cockpit/ag-ui/json-render/python/prompts/json-render.md` (copy from `cockpit/chat/generative-ui/python/prompts/generative-ui.md`)

- [ ] **Step 1: Copy the data tools + full prompt**

```bash
cp cockpit/chat/generative-ui/python/src/dashboard_tools.py cockpit/ag-ui/json-render/python/src/dashboard_tools.py
cp cockpit/chat/generative-ui/python/prompts/generative-ui.md cockpit/ag-ui/json-render/python/prompts/json-render.md
```
In `graph.py` the import must be `from src.dashboard_tools import ALL_TOOLS as _DATA_TOOLS` (matches the chat example's import style; confirm it resolves under the ag-ui-langgraph runtime — the tool-views example imports `from .graph import graph` in server.py, so relative imports work; if `from src.dashboard_tools` fails at runtime, use `from .dashboard_tools import ALL_TOOLS as _DATA_TOOLS`). Report which form you used.

- [ ] **Step 2: Overwrite `graph.py` with the full ported graph (data → state)**

Start from `cockpit/chat/generative-ui/python/src/graph.py` (copy it), then apply these changes:
1. Replace the `DashboardState` class with a TypedDict that declares the data fields (so they ride STATE_SNAPSHOT):
```python
from typing import Optional
from typing_extensions import TypedDict, Annotated
from langgraph.graph.message import add_messages

class DashboardState(TypedDict):
    messages: Annotated[list, add_messages]
    on_time: Optional[dict]
    flights_today: Optional[dict]
    avg_delay: Optional[dict]
    load_factor: Optional[dict]
    on_time_trend: Optional[list]
    flights_by_airline: Optional[list]
    recent_disruptions: Optional[dict]
```
(Note: `recent_disruptions` is a list in the spec binding but the filter tool returns an object; keep it `Optional[dict]` or `Optional[list]` to match what `query_recent_disruptions` returns — inspect `dashboard_tools.py` and match the tool's return type.)
2. Rewrite `emit_state` to RETURN nested data into state instead of `get_stream_writer`:
```python
async def emit_state(state: DashboardState) -> dict:
    """Accumulate this turn's tool results into graph state so
    ag-ui-langgraph emits them as STATE_SNAPSHOT. Walk messages in reverse
    to the most recent human turn; map each known data tool to its state
    field(s). query_airline_kpis returns the four nested *_card sections
    ({on_time, flights_today, avg_delay, load_factor}); merge them directly."""
    updates: dict = {}
    for msg in reversed(state["messages"]):
        if getattr(msg, "type", None) == "tool":
            try:
                data = json.loads(msg.content) if isinstance(msg.content, str) else msg.content
            except (json.JSONDecodeError, TypeError):
                continue
            if msg.name == "query_airline_kpis" and isinstance(data, dict):
                updates.update(data)  # {on_time:{...}, flights_today:{...}, avg_delay:{...}, load_factor:{...}}
            elif msg.name == "query_on_time_trend":
                updates["on_time_trend"] = data
            elif msg.name == "query_flights_by_airline":
                updates["flights_by_airline"] = data
            elif msg.name == "query_recent_disruptions":
                updates["recent_disruptions"] = data
        elif getattr(msg, "type", None) == "human":
            break
    return updates
```
Remove the `from langgraph.config import get_stream_writer` import and the writer call. Keep `render_spec`, `wrap_spec_into_ai`, `should_continue`, `finalize`, `respond`, `generate_title`, and the graph wiring identical to the chat example. (The `respond`/`generate_title` nodes stay; `generate_title` is a graceful no-op without `LANGGRAPH_API_URL`.)
3. Verify `query_airline_kpis` actually returns nested sections keyed `on_time`/`flights_today`/`avg_delay`/`load_factor` matching the spec's `$state` paths. Read `dashboard_tools.py` and confirm; if the keys differ, the `DashboardState` field names and the prompt's state-path table must agree with the tool output. Report any mismatch and align them (prefer matching the prompt's documented paths).

- [ ] **Step 3: Verify the backend imports + smoke**

Run: `npx nx smoke cockpit-ag-ui-json-render-python`
Expected: PASS (module shape).
If a python interpreter with deps is available: `cd cockpit/ag-ui/json-render/python && uv run python -c "from src.graph import graph; print('ok')"` → expect `ok`. If deps aren't synced, skip (smoke is the gate); report.

- [ ] **Step 4: Commit**

```bash
git add cockpit/ag-ui/json-render/python/
git commit -m "feat(cockpit): port full dashboard graph to ag-ui/json-render (data in state)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Port the remaining dashboard view components

Add the five remaining views and wire the full registry + welcome suggestions.

**Files (Create — copy verbatim from `cockpit/chat/generative-ui/angular/src/app/views/`):**
- `container.component.ts`, `dashboard-grid.component.ts`, `line-chart.component.ts`, `bar-chart.component.ts`, `data-grid.component.ts`
- Overwrite: `cockpit/ag-ui/json-render/angular/src/app/json-render.component.ts`

- [ ] **Step 1: Copy the five view components verbatim**

```bash
for v in container dashboard-grid line-chart bar-chart data-grid; do
  cp cockpit/chat/generative-ui/angular/src/app/views/$v.component.ts \
     cockpit/ag-ui/json-render/angular/src/app/views/$v.component.ts
done
```
(Do NOT copy the `.spec.ts` files — the chat example's view specs aren't needed here and would add lint/test surface. The components have no `@threadplane/langgraph` imports; verify with `grep -rn "langgraph" cockpit/ag-ui/json-render/angular/src/app/views` → expect none.)

- [ ] **Step 2: Wire the full views registry + welcome suggestions**

Overwrite `cockpit/ag-ui/json-render/angular/src/app/json-render.component.ts` with the full registry (mirror `cockpit/chat/generative-ui/angular/src/app/generative-ui.component.ts` but swap `injectAgent`/`provideAgent` source to `@threadplane/ag-ui` and selector to `app-json-render`):
```ts
// SPDX-License-Identifier: MIT
import { Component } from '@angular/core';
import { ChatComponent, ChatWelcomeSuggestionComponent, views } from '@threadplane/chat';
import { injectAgent } from '@threadplane/ag-ui';
import { ExampleChatLayoutComponent } from '@threadplane/example-layouts';
import { StatCardComponent } from './views/stat-card.component';
import { ContainerComponent } from './views/container.component';
import { DashboardGridComponent } from './views/dashboard-grid.component';
import { LineChartComponent } from './views/line-chart.component';
import { BarChartComponent } from './views/bar-chart.component';
import { DataGridComponent } from './views/data-grid.component';

const dashboardViews = views({
  stat_card: StatCardComponent,
  container: ContainerComponent,
  dashboard_grid: DashboardGridComponent,
  line_chart: LineChartComponent,
  bar_chart: BarChartComponent,
  data_grid: DataGridComponent,
});

const WELCOME_SUGGESTIONS = [
  { label: 'Airline operations dashboard', value: 'Show me a dashboard of airline operations.' },
  { label: 'Filter to cancelled flights',  value: 'Filter to only the cancelled flights.' },
] as const;

@Component({
  selector: 'app-json-render',
  standalone: true,
  imports: [ChatComponent, ChatWelcomeSuggestionComponent, ExampleChatLayoutComponent],
  template: `
    <example-chat-layout>
      <chat main [agent]="agent" [views]="dashboardViews" class="flex-1 min-w-0">
        <div chatWelcomeSuggestions>
          @for (s of suggestions; track s.value) {
            <chat-welcome-suggestion [label]="s.label" [value]="s.value" (selected)="send($event)" />
          }
        </div>
      </chat>
    </example-chat-layout>
  `,
})
export class JsonRenderComponent {
  protected readonly agent = injectAgent();
  protected readonly dashboardViews = dashboardViews;
  protected readonly suggestions = WELCOME_SUGGESTIONS;
  protected send(text: string): void { void this.agent.submit({ message: text }); }
}
```

- [ ] **Step 3: Build + verify no langgraph imports leaked**

Run: `grep -rn "@threadplane/langgraph" cockpit/ag-ui/json-render/angular/src` → expect NO matches.
Run: `npx nx build cockpit-ag-ui-json-render-angular` → expect PASS (within budget).

- [ ] **Step 4: Commit**

```bash
git add cockpit/ag-ui/json-render/angular/
git commit -m "feat(cockpit): full dashboard views for ag-ui/json-render

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Full e2e fixtures + assertion

Replace the slice fixture/spec with the full dashboard flow, asserting a state-bound KPI value renders.

**Files:**
- Overwrite: `cockpit/ag-ui/json-render/angular/e2e/fixtures/json-render.json`
- Overwrite: `cockpit/ag-ui/json-render/angular/e2e/json-render.spec.ts`
- Create: `cockpit/ag-ui/json-render/angular/e2e/manual/json-render.manual.ts`

- [ ] **Step 1: Port the dashboard fixtures**

Overwrite `fixtures/json-render.json` based on `cockpit/chat/generative-ui/angular/e2e/fixtures/c-generative-ui.json` (the `render_spec` tool-call fixture for "Show me a dashboard of airline operations." — copy its `arguments` spec JSON verbatim). The full agent loop also makes data-tool calls and a `respond` text call; add fixture entries so aimock can serve each LLM call in the turn. To determine the exact set, run the e2e once (Step 3); for each "no fixture matched" error, add an entry keyed on the reported `userMessage`/`responseFormat`/`hasToolResult`. Model the multi-call structure on the chat example's fixtures and the tool-views two-stage pattern (a `hasToolResult: true` text entry for the final `respond`).

- [ ] **Step 2: Write the full assertion spec**

Overwrite `e2e/json-render.spec.ts`:
```ts
// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';
import { submitAndWaitForResponse } from '@threadplane-internal/e2e-harness';

test('json-render: dashboard renders with STATE_SNAPSHOT-bound KPI values', async ({ page }) => {
  await submitAndWaitForResponse(page, 'Show me a dashboard of airline operations.');
  // Spec content mounts the GenUI tree; the KPI numbers arrive via
  // STATE_SNAPSHOT (graph state → agent.state() → render store).
  await expect(page.locator('chat-generative-ui').first()).toBeVisible({ timeout: 30000 });
  await expect(page.locator('chat-generative-ui')).not.toHaveCount(0);
  // At least one stat card shows a non-skeleton value (proves the data path).
  await expect(page.locator('app-stat-card .stat-card__value').first()).toBeVisible({ timeout: 30000 });
  await expect(page.locator('app-stat-card .stat-card__value').first()).not.toBeEmpty();
});
```

`e2e/manual/json-render.manual.ts`: copy `cockpit/ag-ui/tool-views/angular/e2e/manual/tool-views.manual.ts`, swap names/ports (5323/4323, selector `app-json-render`, prompt "Show me a dashboard of airline operations.").

- [ ] **Step 3: Run the full e2e**

Run: `npx nx e2e cockpit-ag-ui-json-render-angular`
Expected: PASS — the dashboard mounts and at least one stat card shows a non-empty (state-bound) value. Iterate the fixture set per Step 1 until green. If the cards mount but stay skeleton, the state path regressed — debug per Task 2 Step 5.

- [ ] **Step 4: Commit**

```bash
git add cockpit/ag-ui/json-render/angular/e2e/
git commit -m "test(cockpit): full ag-ui/json-render e2e (state-bound dashboard)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Complete registry/manifest wiring + final verification

**Files:**
- Modify: `apps/cockpit/src/lib/route-resolution.ts`
- Modify: `libs/cockpit-registry/src/lib/manifest.ts` (+ `manifest.spec.ts`)
- Add python `scope:cockpit-smoke` tag + smoke target already present (verify).

- [ ] **Step 1: route-resolution module registration**

In `apps/cockpit/src/lib/route-resolution.ts`, add after the `agUiToolViewsPythonModule` import:
```ts
import { agUiJsonRenderPythonModule } from '../../../../cockpit/ag-ui/json-render/python/src/index';
```
and add `agUiJsonRenderPythonModule,` after `agUiToolViewsPythonModule,` in the `capabilityModules` array.

- [ ] **Step 2: manifest topic + spec count**

In `libs/cockpit-registry/src/lib/manifest.ts`, change the ag-ui core-capabilities list to:
```ts
    'core-capabilities': ['streaming', 'interrupts', 'tool-views', 'json-render'],
```
In `libs/cockpit-registry/src/lib/manifest.spec.ts`, add `'json-render'` to the ag-ui expected-topics list and bump the total capability count by 1 (mirror the tool-views change from PR-A — find the `toHaveLength(N)` and `expectedTopics['ag-ui']` entries).

- [ ] **Step 3: Run all gates**

Run each and confirm green:
- `npx nx test cockpit -- --run cockpit-e2e-wiring route-resolution` → PASS (registry/ports/proxy aligned; new module resolves).
- `npx nx test cockpit-registry -- --run` → PASS (manifest valid; count matches).
- `npx nx test chat -- --run` → PASS (state-sync effect + existing).
- `npx nx run-many -t lint -p chat cockpit cockpit-registry cockpit-ag-ui-json-render-angular cockpit-ag-ui-json-render-python` → PASS.
- `npx nx run-many -t smoke -p cockpit-ag-ui-json-render-python cockpit-ag-ui-json-render-angular` → PASS.
- `npx nx e2e cockpit-ag-ui-json-render-angular` → PASS (final confirmation).

- [ ] **Step 4: Forbidden-reference scan**

Run a forbidden-reference scan for the two flagged external project names across the new artifacts (`cockpit/ag-ui/json-render`, the new chat-lib spec file, and this plan).
Expected: NO matches.

- [ ] **Step 5: Commit**

```bash
git add apps/cockpit/src/lib/route-resolution.ts libs/cockpit-registry/src/lib/manifest.ts libs/cockpit-registry/src/lib/manifest.spec.ts
git commit -m "feat(cockpit): register ag-ui/json-render capability (route, manifest)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- Data via AG-UI shared state (STATE_SNAPSHOT) → Task 3 (emit_state returns nested state) + Task 1 (sync effect). ✓
- Small runtime-neutral chat-lib effect + unit test → Task 1. ✓
- e2e asserts a state-bound value → Task 2 (slice: `42`) + Task 5 (full: non-empty stat value). ✓
- Vertical-slice-first de-risk → Task 2 (the gate). ✓
- Full port of generative-ui graph + 6 views + airline domain → Tasks 3-4. ✓
- Wiring (ports, capability-registry, route-resolution, manifest) → Tasks 2 (ports+registry) + 6 (route+manifest). ✓
- smoke + e2e + manual harness → Tasks 2/5/6. ✓

**Placeholder scan:** Verbatim copies are specified with exact source paths + edits (legitimate for duplication). The one judgement call — the exact fixture set for the multi-call full agent (Task 5 Step 1) — is handled by an explicit iterate-until-green loop keyed on aimock's "no fixture matched" errors, because the precise call sequence depends on the ported prompt's behavior under aimock and can't be enumerated blind.

**Type consistency:** `DashboardState` field names (`on_time`, `flights_today`, `avg_delay`, `load_factor`, `on_time_trend`, `flights_by_airline`, `recent_disruptions`) match the spec's `$state` paths (`/on_time/value`, …) and the sync effect's `/`-prefixing (Task 1). `emit_state` returns those exact keys (Task 3). The slice uses `demo`/`/demo/value` consistently across graph, prompt, fixture, and assertion (Task 2). Module export names (`agUiJsonRender{Python,Angular}Module`), ids (`ag-ui-json-render-{python,angular}`), and titles are consistent across index.ts, project.json smoke, capability-registry, and route-resolution.
