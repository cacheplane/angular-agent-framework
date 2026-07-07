# App Mode on the LangChain Canonical Demo — Itinerary Cockpit — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the App-mode map/itinerary cockpit from `examples/ag-ui` to the langchain canonical demo (`examples/chat`, `@threadplane/langgraph`), storing the itinerary in the langgraph graph state alongside `messages`, with a single shared agent and no seed data.

**Architecture:** App mode is a presentational layer over the existing `chat` graph. The graph gains an `itinerary` state channel (per-thread checkpoint) plus frontend-client-tool binding. The Angular `ItineraryStore` is the live working copy (signals → map/panel); the checkpoint is the durable record, synced client-authoritatively via `state.itinerary` on `submit` + `agent.updateState({ itinerary })` after a run and on user edits. The agent recommends places AND populates app state via client tools; the demo starts empty and the user prompts a plan.

**Tech Stack:** Angular (zoneless, signals), `@threadplane/langgraph` + `@threadplane/chat`, `@angular/google-maps`, LangGraph (Python) + `threadplane-middleware`, Vitest, Playwright, pytest.

**Design spec:** `docs/superpowers/specs/2026-07-06-langgraph-canonical-app-mode-itinerary-design.md`

**Execution context:** Work on branch `feat/langgraph-app-mode-itinerary` in the **main checkout** (not a worktree) — the running dev servers (`:4200` examples-chat-angular, `:2024` langgraph `chat` graph) already serve it, which the Chrome-MCP live gate (Task 16) depends on. Leave the pre-existing unrelated dirty files (`libs/chat/.../markdown-table*`) untouched; never `git add` them.

**Source of truth to copy from:** `examples/ag-ui/angular/src/app/` and `examples/ag-ui/python/`. **Target:** `examples/chat/angular/src/app/` and `examples/chat/python/`.

**Conventions:** SPDX header `// SPDX-License-Identifier: MIT` on new TS files (match neighbors). Commit after each task. Run unit tests from the repo root.

---

## Phase 0 — De-risk the client-tool round trip

### Task 1: Spike — prove the langgraph client-tool payload reaches the graph

**Goal:** Determine which state key the langgraph run payload lands the frontend client-tool catalog in, wire the backend minimally, and prove the model can call a frontend tool that routes away from the server `ToolNode`.

**Files:**
- Read: `packages/threadplane-middleware/src/threadplane/middleware/langgraph/` (all `.py`)
- Modify: `examples/chat/python/pyproject.toml`
- Modify: `examples/chat/python/src/graph.py`
- Test: `examples/chat/python/tests/test_client_tools_spike.py` (create)

- [ ] **Step 1: Read the middleware to find the state key + names contract**

Read every `.py` under `packages/threadplane-middleware/src/threadplane/middleware/langgraph/`. Determine:
- the exact signature of `bind_client_tools(llm, server_tools, state)` and **which `state[...]` key** it reads the client catalog from (candidates: `state["client_tools"]` or `state["tools"]`);
- the exact signature and return of `client_tool_names(state)`.

Record the key name — call it `<CATALOG_KEY>` below. (ag-ui populates `state["tools"]` via `ag-ui-langgraph`; the langgraph adapter's TS `mergeClientTools` sets `client_tools` in the run payload, so the langgraph server merges it into state under whatever key matches the graph's `State` channel. The channel name in `State` MUST match the payload key the SDK sends: `client_tools`.)

- [ ] **Step 2: Add the middleware dependency**

In `examples/chat/python/pyproject.toml`, add to `[project].dependencies`:

```toml
    "threadplane-middleware>=0.0.1",
```

Then install: `cd examples/chat/python && uv sync` — Expected: resolves `threadplane-middleware` from the workspace.

- [ ] **Step 3: Write a failing test for client-tool routing**

Create `examples/chat/python/tests/test_client_tools_spike.py`:

```python
import pytest


@pytest.mark.smoke
def test_state_has_client_tools_channel():
    from src.graph import State
    ann = State.__annotations__
    assert "client_tools" in ann, "State must carry the frontend client-tool catalog channel"


@pytest.mark.smoke
def test_all_client_tool_turn_routes_away_from_server_tools():
    # A turn whose only tool_calls are client tools must NOT route to the
    # server ToolNode (which has no implementation for them); the browser
    # executes them, so the graph terminates the server loop.
    from langchain_core.messages import AIMessage
    from src.graph import should_continue

    state = {
        "messages": [AIMessage(content="", tool_calls=[
            {"name": "add_stop", "args": {"day": 1, "place": "Louvre"}, "id": "t1"},
        ])],
        "client_tools": [{"name": "add_stop"}],
    }
    assert should_continue(state) != "tools"
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `cd examples/chat/python && uv run pytest tests/test_client_tools_spike.py -v`
Expected: FAIL — `State` has no `client_tools` and/or `should_continue` routes to `tools`.

- [ ] **Step 5: Add the `client_tools` channel to `State` and bind client tools**

In `examples/chat/python/src/graph.py`, extend `State` (currently lines 365-369) so it retains the catalog across the graph:

```python
class State(TypedDict):
    messages: Annotated[list, add_messages]
    model: Optional[str]
    reasoning_effort: Optional[str]
    gen_ui_mode: Optional[str]
    client_tools: Optional[list]   # frontend client-tool catalog (langgraph run payload)
    itinerary: list                # NEW — see Task 2 (declared here so the channel exists)
```

Add the import near the other `threadplane`/langgraph imports at the top of the file:

```python
from threadplane.middleware.langgraph import bind_client_tools, client_tool_names
```

Replace the `bind_tools` call (lines 405-407) so the frontend catalog is appended when present:

```python
    llm = bind_client_tools(
        ChatOpenAI(**kwargs),
        [search_documents, request_approval, research, gen_ui_tool],
        state,
    )
```

> If Step 1 found the middleware reads a key other than `client_tools`, name the `State` channel to match what the middleware reads AND what the SDK sends. If they differ, add a tiny normalization at the top of `generate`: `state = {**state, "<middleware_key>": state.get("client_tools") or state.get("<middleware_key>") or []}` and document it in a comment. Prefer a single key end-to-end.

- [ ] **Step 6: Update `should_continue` to route all-client-tool turns away from the server ToolNode**

Find `should_continue` in `examples/chat/python/src/graph.py` (the router after `generate`). Mirror the ag-ui pattern:

```python
def should_continue(state: State) -> Literal["tools", "attach_citations"]:
    last = state["messages"][-1]
    if not (isinstance(last, AIMessage) and last.tool_calls):
        return "attach_citations"
    client = client_tool_names(state)
    if all(tc["name"] in client for tc in last.tool_calls):
        # Every call is a frontend client tool → the browser executes them;
        # the server tool loop terminates.
        return "attach_citations"
    return "tools"
```

Keep the existing terminal target name if the chat graph uses something other than `attach_citations` (e.g. the node that precedes `generate_title`/`END`). Match the existing return literals exactly.

- [ ] **Step 7: Run the test to verify it passes**

Run: `cd examples/chat/python && uv run pytest tests/test_client_tools_spike.py -v`
Expected: PASS (both tests).

- [ ] **Step 8: Live round-trip proof against the running graph**

With `langgraph dev` on `:2024`, send a run that includes a client-tool catalog and a planning prompt, and confirm the model emits an `add_stop` tool call:

```bash
cd examples/chat/python
uv run python - <<'PY'
import asyncio, json
from langgraph_sdk import get_client

async def main():
    client = get_client(url="http://localhost:2024")
    thread = await client.threads.create()
    catalog = [{"name": "add_stop",
                "description": "Add a stop to a day of the trip itinerary.",
                "parameters": {"type": "object",
                    "properties": {"day": {"type": "integer"}, "place": {"type": "string"}},
                    "required": ["day", "place"]}}]
    saw_add_stop = False
    async for chunk in client.runs.stream(
        thread["thread_id"], "chat",
        input={"messages": [{"role": "user", "content": "Plan 2 days in Paris. Add stops."}],
               "client_tools": catalog, "itinerary": []},
        stream_mode=["messages-tuple", "values"],
    ):
        if "add_stop" in json.dumps(chunk.data):
            saw_add_stop = True
    print("SAW add_stop tool call:", saw_add_stop)
    assert saw_add_stop, "model did not call the frontend client tool — payload key mismatch"

asyncio.run(main())
PY
```

Expected: `SAW add_stop tool call: True`. If False, the catalog key is not reaching the model — revisit Step 1/Step 5 (key alignment) before proceeding. This is the gate for the whole approach.

- [ ] **Step 9: Commit**

```bash
git add examples/chat/python/pyproject.toml examples/chat/python/uv.lock examples/chat/python/src/graph.py examples/chat/python/tests/test_client_tools_spike.py
git commit -m "feat(chat-graph): spike client-tool binding + client-tool-aware routing (#itinerary)"
```

---

## Phase 1 — Backend: itinerary state, context injection, planner framing

### Task 2: Itinerary state channel + `Stop` shape

**Files:**
- Modify: `examples/chat/python/src/graph.py`
- Test: `examples/chat/python/tests/test_itinerary_state.py` (create)

- [ ] **Step 1: Write the failing test**

Create `examples/chat/python/tests/test_itinerary_state.py`:

```python
import pytest


@pytest.mark.smoke
def test_state_declares_itinerary_channel():
    from src.graph import State
    assert "itinerary" in State.__annotations__


@pytest.mark.smoke
def test_stop_shape():
    from src.graph import Stop
    ann = Stop.__annotations__
    for key in ("id", "day", "place"):
        assert key in ann, f"Stop must declare {key}"
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd examples/chat/python && uv run pytest tests/test_itinerary_state.py -v`
Expected: FAIL — `Stop` not defined.

- [ ] **Step 3: Define `Stop` and confirm the `itinerary` channel**

In `examples/chat/python/src/graph.py`, ensure `NotRequired` is imported (`from typing_extensions import TypedDict, NotRequired`) and add above `State`:

```python
class Stop(TypedDict):
    id: str
    day: int
    place: str
    note: NotRequired[str]
    lat: NotRequired[float]
    lng: NotRequired[float]
```

Change the `itinerary` channel added in Task 1 to the typed shape:

```python
    itinerary: list[Stop]   # per-thread checkpoint; last-write-wins (plain key)
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd examples/chat/python && uv run pytest tests/test_itinerary_state.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add examples/chat/python/src/graph.py examples/chat/python/tests/test_itinerary_state.py
git commit -m "feat(chat-graph): add itinerary Stop state channel"
```

### Task 3: Inject itinerary context + planner framing into `generate`

**Files:**
- Modify: `examples/chat/python/src/graph.py`
- Test: `examples/chat/python/tests/test_planner_framing.py` (create)

- [ ] **Step 1: Write the failing test**

Create `examples/chat/python/tests/test_planner_framing.py`:

```python
import pytest
from src.graph import build_system_prompt  # helper introduced in Step 3


@pytest.mark.smoke
def test_planner_framing_only_when_client_tools_present():
    plain = build_system_prompt(gen_ui_mode="json-render", client_tools=[], itinerary=[])
    assert "trip-planning" not in plain.lower()

    app = build_system_prompt(
        gen_ui_mode="json-render",
        client_tools=[{"name": "add_stop"}],
        itinerary=[],
    )
    assert "trip-planning" in app.lower()
    assert "add_stop" in app  # instructs the model to populate state via the tool


@pytest.mark.smoke
def test_current_itinerary_is_injected_when_present():
    app = build_system_prompt(
        gen_ui_mode="json-render",
        client_tools=[{"name": "add_stop"}],
        itinerary=[{"id": "a", "day": 1, "place": "Louvre"}],
    )
    assert "Louvre" in app
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd examples/chat/python && uv run pytest tests/test_planner_framing.py -v`
Expected: FAIL — `build_system_prompt` not defined.

- [ ] **Step 3: Extract `build_system_prompt` and call it from `generate`**

In `examples/chat/python/src/graph.py`, add a module-level constant and helper (place the constant near `SYSTEM_PROMPT`, the helper just above `generate`):

```python
_PLANNER_FRAMING = (
    "\n\n--- APP MODE: TRIP PLANNER ---\n"
    "You are a trip-planning assistant driving a live map cockpit. When the user "
    "asks for a plan, RECOMMEND concrete places (a short note each) grouped into "
    "days, and POPULATE the itinerary by calling `add_stop` for each recommendation "
    "(then `day_card` to recap a day). Revise with `move_stop`/`reorder_stop`/`clear_day`. "
    "Do NOT just describe the plan in prose — call the tools so the map and panel update. "
    "Only add stops that are not already present."
)


def build_system_prompt(gen_ui_mode: str, client_tools: list, itinerary: list) -> str:
    system = SYSTEM_PROMPT
    if gen_ui_mode == "a2ui":
        system = system + "\n\n--- A2UI v1 SCHEMA ---\n" + A2UI_V1_SCHEMA_PROMPT + (
            "\n\nWhen rendering UI in a2ui mode, emit envelopes in this order: "
            "surfaceUpdate FIRST, then beginRendering, then any dataModelUpdate entries."
        )
    if client_tools:
        system = system + _PLANNER_FRAMING
        if itinerary:
            import json as _json
            system = system + (
                "\n\nCURRENT ITINERARY (do not re-add existing stops):\n"
                + _json.dumps(itinerary, ensure_ascii=False)
            )
    return system
```

In `generate`, replace the inline system assembly (lines ~408-417) with:

```python
    system = build_system_prompt(
        gen_ui_mode=gen_ui_mode,
        client_tools=state.get("client_tools") or [],
        itinerary=state.get("itinerary") or [],
    )
    messages = [SystemMessage(content=system)] + state["messages"]
```

Preserve the existing a2ui partial-handler wiring that follows.

- [ ] **Step 4: Run to verify it passes**

Run: `cd examples/chat/python && uv run pytest tests/test_planner_framing.py -v`
Expected: PASS.

- [ ] **Step 5: Full backend smoke + graph import**

Run: `cd examples/chat/python && uv run pytest tests/ -m smoke -v`
Expected: PASS (existing smokes + the new ones; `src.graph.graph` still imports).

- [ ] **Step 6: Commit**

```bash
git add examples/chat/python/src/graph.py examples/chat/python/tests/test_planner_framing.py
git commit -m "feat(chat-graph): planner framing + itinerary context injection when client tools present"
```

---

## Phase 2 — Frontend: Maps key plumbing + ported services/store

### Task 4: Google Maps key env + inject-env for examples/chat

**Files:**
- Create: `examples/chat/angular/scripts/inject-env.mjs`
- Create: `examples/chat/angular/src/environments/generated-keys.ts`
- Modify: `examples/chat/angular/src/environments/environment.ts`
- Modify: `examples/chat/angular/src/environments/environment.development.ts`
- Modify: `examples/chat/angular/project.json`
- Modify: `examples/chat/angular/.gitignore` (or repo root `.gitignore`)

- [ ] **Step 1: Copy the inject-env script**

```bash
mkdir -p examples/chat/angular/scripts
cp examples/ag-ui/angular/scripts/inject-env.mjs examples/chat/angular/scripts/inject-env.mjs
```

Open the copy and confirm `repoRoot = resolve(__dirname, '../../../..')` still resolves to the repo root from `examples/chat/angular/scripts/` (same depth as ag-ui — it does). No edit needed.

- [ ] **Step 2: Add the committed stub**

Create `examples/chat/angular/src/environments/generated-keys.ts`:

```typescript
// SPDX-License-Identifier: MIT
// Committed stub. Regenerated as generated-keys.local.ts at build time by
// scripts/inject-env.mjs and swapped in via project.json fileReplacements.
// Ships empty (CI has no key); local/preview builds get the real value.
export const GENERATED_KEYS = {
  googleMaps: '',
  googleMapsMapId: '',
} as const;
```

- [ ] **Step 3: Add the Maps fields to both environments**

In `examples/chat/angular/src/environments/environment.ts` add the import at top and the two fields to the object:

```typescript
import { GENERATED_KEYS } from './generated-keys';
```
```typescript
  googleMapsApiKey: GENERATED_KEYS.googleMaps,
  googleMapsMapId: GENERATED_KEYS.googleMapsMapId,
```

Repeat the identical import + two fields in `environment.development.ts`.

- [ ] **Step 4: Wire the project.json target + fileReplacements**

In `examples/chat/angular/project.json`, mirror ag-ui:
- Add an `inject-env` target that runs `node examples/chat/angular/scripts/inject-env.mjs`.
- Add `"inject-env"` to `dependsOn` of both `build` and `serve`.
- In build `configurations.production.fileReplacements` and `configurations.development.fileReplacements`, add:

```json
{ "replace": "examples/chat/angular/src/environments/generated-keys.ts",
  "with": "examples/chat/angular/src/environments/generated-keys.local.ts" }
```

Copy the exact target/option shapes from `examples/ag-ui/angular/project.json` (targets `inject-env`, `build`, `serve`) so option names match this repo's Nx executors.

- [ ] **Step 5: Gitignore the generated file**

Ensure `examples/chat/angular/src/environments/generated-keys.local.ts` is gitignored (add the path to the repo-root `.gitignore` if a glob doesn't already cover `generated-keys.local.ts`). Verify: `git check-ignore examples/chat/angular/src/environments/generated-keys.local.ts` prints the path.

- [ ] **Step 6: Generate + typecheck**

```bash
GOOGLE_MAPS_API_KEY=$(grep -E '^GOOGLE_MAPS_API_KEY=' .env | head -1 | cut -d= -f2- | tr -d '"')
GOOGLE_MAPS_MAP_ID=86d464ea7d5306034fe2a254 \
  node examples/chat/angular/scripts/inject-env.mjs
grep -oE 'googleMaps:\s*"[^"]*"' examples/chat/angular/src/environments/generated-keys.local.ts
```
Expected: prints `googleMaps: "<key>"` with non-empty length.

- [ ] **Step 7: Commit**

```bash
git add examples/chat/angular/scripts/inject-env.mjs examples/chat/angular/src/environments/generated-keys.ts examples/chat/angular/src/environments/environment.ts examples/chat/angular/src/environments/environment.development.ts examples/chat/angular/project.json .gitignore
git commit -m "feat(examples-chat): wire Google Maps key via inject-env (local only)"
```

### Task 5: Port map utilities + services (no behavior change)

**Files:**
- Create (copy): `examples/chat/angular/src/app/{map-bounds.ts,map-bounds.spec.ts,geocoding.service.ts,geocoding.service.spec.ts,google-maps-loader.ts}`
- Test: the copied specs

- [ ] **Step 1: Copy the standalone files verbatim**

```bash
cd examples/chat/angular/src/app
cp ../../../../ag-ui/angular/src/app/map-bounds.ts .
cp ../../../../ag-ui/angular/src/app/map-bounds.spec.ts .
cp ../../../../ag-ui/angular/src/app/geocoding.service.ts .
cp ../../../../ag-ui/angular/src/app/geocoding.service.spec.ts .
cp ../../../../ag-ui/angular/src/app/google-maps-loader.ts .
```

These have no `@threadplane/ag-ui` imports (only `@angular/core`, `../environments/environment`, `google.maps` types) — no edits needed. `google-maps-loader.ts` imports `../environments/environment`, which now carries `googleMapsApiKey` (Task 4).

- [ ] **Step 2: Run the copied unit tests**

Run: `npx nx test examples-chat-angular -- map-bounds geocoding`
(If the project uses a direct vitest invocation, run from `examples/chat/angular`: `npx vitest run src/app/map-bounds.spec.ts src/app/geocoding.service.spec.ts`.)
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add examples/chat/angular/src/app/map-bounds.ts examples/chat/angular/src/app/map-bounds.spec.ts examples/chat/angular/src/app/geocoding.service.ts examples/chat/angular/src/app/geocoding.service.spec.ts examples/chat/angular/src/app/google-maps-loader.ts
git commit -m "feat(examples-chat): port map-bounds, geocoding, google-maps-loader"
```

### Task 6: Port `ItineraryStore` — drop SEED + localStorage, add value hydration

**Files:**
- Create (copy + edit): `examples/chat/angular/src/app/itinerary-store.ts`
- Create (copy + edit): `examples/chat/angular/src/app/itinerary-store.spec.ts`

- [ ] **Step 1: Copy the store + spec**

```bash
cd examples/chat/angular/src/app
cp ../../../../ag-ui/angular/src/app/itinerary-store.ts .
cp ../../../../ag-ui/angular/src/app/itinerary-store.spec.ts .
```

- [ ] **Step 2: Write failing tests for empty-start + hydration**

Replace any seed/localStorage assertions in `itinerary-store.spec.ts` and add:

```typescript
import { ItineraryStore } from './itinerary-store';

describe('ItineraryStore — server-state model', () => {
  it('starts empty (no seed)', () => {
    const store = new ItineraryStore();
    expect(store.stops()).toEqual([]);
    expect(store.days()).toEqual([]);
  });

  it('hydrates from a server itinerary snapshot', () => {
    const store = new ItineraryStore();
    store.hydrate([{ id: 'x', day: 1, place: 'Louvre' }]);
    expect(store.stops().map((s) => s.place)).toEqual(['Louvre']);
  });

  it('does not touch localStorage on update', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem');
    const store = new ItineraryStore();
    store.add(1, 'Eiffel Tower');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
```

(Keep the existing add/move/reorder/clearDay behavior tests — those still pass unchanged.)

- [ ] **Step 3: Run to verify it fails**

Run from `examples/chat/angular`: `npx vitest run src/app/itinerary-store.spec.ts`
Expected: FAIL — store seeds from SEED / calls localStorage / no `hydrate`.

- [ ] **Step 4: Edit the store**

In `examples/chat/angular/src/app/itinerary-store.ts`:
- Delete the `SEED` constant (lines ~21-25) and the `ITINERARY_STORAGE_KEY` constant.
- Change the `stops` signal initializer from `signal<ItineraryStop[]>(this.hydrate())` to `signal<ItineraryStop[]>([])`.
- Replace the private `hydrate()` (localStorage read) and `update()` (localStorage write) with:

```typescript
  /** Replace the working copy from a server state snapshot (thread switch /
   *  values stream). Public — the shell calls it when agent.values() changes. */
  hydrate(stops: ItineraryStop[]): void {
    this.stops.set(stops ?? []);
  }

  private update(next: ItineraryStop[]): void {
    this.stops.set(next);
  }
```
- In `reset()`, replace `this.update([...SEED])` with `this.update([])`.
- Remove the now-unused `try/catch`/`localStorage` code.

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run src/app/itinerary-store.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add examples/chat/angular/src/app/itinerary-store.ts examples/chat/angular/src/app/itinerary-store.spec.ts
git commit -m "feat(examples-chat): port ItineraryStore — empty start, value hydration, no localStorage"
```

### Task 7: Port itinerary UI components (day-card, clear-day-confirm, itinerary-panel, map-canvas)

**Files:**
- Create (copy verbatim): `day-card.component.ts`, `clear-day-confirm.component.ts`
- Create (copy + edit): `itinerary-panel.component.ts` (+ `.spec.ts`), `map-canvas.component.ts`

- [ ] **Step 1: Copy all four (+ panel spec)**

```bash
cd examples/chat/angular/src/app
cp ../../../../ag-ui/angular/src/app/day-card.component.ts .
cp ../../../../ag-ui/angular/src/app/clear-day-confirm.component.ts .
cp ../../../../ag-ui/angular/src/app/itinerary-panel.component.ts .
cp ../../../../ag-ui/angular/src/app/itinerary-panel.component.spec.ts .
cp ../../../../ag-ui/angular/src/app/map-canvas.component.ts .
```

`day-card.component.ts` (uses `@threadplane/chat` `ViewProps`) and `clear-day-confirm.component.ts` (uses `@threadplane/render`) need **no edits**. `map-canvas.component.ts` has no `@threadplane` imports — no edits.

- [ ] **Step 2: Swap the agent import in `itinerary-panel.component.ts`**

Change the import (line ~3):

```typescript
import { injectAgent } from '@threadplane/langgraph';
import { DEMO_AGENT_REF } from './shell/agent-ref';
```
(Remove the `import { ITINERARY_AGENT } from './client-tools';` line.) Then replace `injectAgent(ITINERARY_AGENT)` with `injectAgent(DEMO_AGENT_REF)`. If the panel used any `ItineraryState`-typed field off the agent, `DemoState` from `./shell/agent-ref` is the langgraph analogue — retype accordingly. Keep everything else (drag-drop, store binding) identical.

- [ ] **Step 3: Point the empty-state at "ask to plan"**

In `itinerary-panel.component.ts` template, the empty-state (rendered when `store.days().length === 0`) must read as a prompt-to-plan CTA. Ensure a block like:

```html
@if (store.days().length === 0) {
  <div class="itinerary-panel__empty">
    <p>No trip yet.</p>
    <p>Ask the assistant to plan one — try a suggestion in the chat.</p>
  </div>
}
```
If the ag-ui panel already has an empty state with different copy, update the copy to the above (no seed implies this is the default view users see first).

- [ ] **Step 4: Run the panel spec**

Run from `examples/chat/angular`: `npx vitest run src/app/itinerary-panel.component.spec.ts`
Expected: PASS (fix any `ITINERARY_AGENT`/provider references in the spec to `DEMO_AGENT_REF`; provide the agent via the same TestBed pattern the chat specs use — see `shell/demo-shell.component.spec.ts` for the langgraph agent test harness).

- [ ] **Step 5: Typecheck the app**

Run: `npx nx build examples-chat-angular --configuration development` (or `npx tsc -p examples/chat/angular/tsconfig.app.json --noEmit`).
Expected: no type errors from the ported components. (Components not yet referenced by routes/shell are fine; this just proves they compile.)

- [ ] **Step 6: Commit**

```bash
git add examples/chat/angular/src/app/day-card.component.ts examples/chat/angular/src/app/clear-day-confirm.component.ts examples/chat/angular/src/app/itinerary-panel.component.ts examples/chat/angular/src/app/itinerary-panel.component.spec.ts examples/chat/angular/src/app/map-canvas.component.ts
git commit -m "feat(examples-chat): port itinerary panel/map/day-card/clear-day UI (langgraph agent)"
```

### Task 8: Port client tools — drop `get_itinerary`, target the demo agent

**Files:**
- Create (copy + edit): `examples/chat/angular/src/app/client-tools.ts`
- Test: `examples/chat/angular/src/app/client-tools.spec.ts` (create)

- [ ] **Step 1: Copy client-tools**

```bash
cp examples/ag-ui/angular/src/app/client-tools.ts examples/chat/angular/src/app/client-tools.ts
```

- [ ] **Step 2: Edit for the chat/langgraph demo**

In `examples/chat/angular/src/app/client-tools.ts`:
- **Remove** the `ITINERARY_AGENT` export and the `ItineraryState` interface and the `createAgentRef` import — the chat demo already owns `DEMO_AGENT_REF`/`DemoState` in `./shell/agent-ref`. Keep imports: `tools, action, view, ask, type ClientToolRegistry` from `@threadplane/chat`.
- **Remove** the `get_itinerary` tool entirely (the model sees the itinerary via injected context now; no read round-trip).
- Keep `add_stop`, `move_stop`, `reorder_stop`, `clear_day`, `day_card` unchanged.
- Keep `CLEAR_DAY_SCHEMA` and `itineraryClientTools()`.

- [ ] **Step 3: Write a failing test**

Create `examples/chat/angular/src/app/client-tools.spec.ts`:

```typescript
import { TestBed } from '@angular/core/testing';
import { ItineraryStore } from './itinerary-store';
import { GeocodingService } from './geocoding.service';
import { itineraryClientTools } from './client-tools';

describe('itineraryClientTools (langgraph demo)', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [ItineraryStore, GeocodingService] }));

  it('exposes mutation tools but NOT get_itinerary', () => {
    const registry = TestBed.runInInjectionContext(() => itineraryClientTools());
    const names = Object.keys(registry as Record<string, unknown>);
    expect(names).toContain('add_stop');
    expect(names).toContain('clear_day');
    expect(names).not.toContain('get_itinerary');
  });
});
```

- [ ] **Step 4: Run — fail then pass**

Run: `npx vitest run src/app/client-tools.spec.ts` (from `examples/chat/angular`).
Expected: FAIL before the `get_itinerary` removal, PASS after. (If registry key introspection differs, adapt the assertion to the `ClientToolRegistry` shape observed in `libs/chat` client-tools tests.)

- [ ] **Step 5: Commit**

```bash
git add examples/chat/angular/src/app/client-tools.ts examples/chat/angular/src/app/client-tools.spec.ts
git commit -m "feat(examples-chat): port itinerary client tools (drop get_itinerary, use demo agent)"
```

---

## Phase 3 — Shell + agent wiring

### Task 9: App state sync — submit injects `state.itinerary`, `updateState` persists

**Files:**
- Modify: `examples/chat/angular/src/app/shell/demo-shell.component.ts`
- Test: `examples/chat/angular/src/app/shell/demo-shell.component.spec.ts`

- [ ] **Step 1: Write failing tests for the sync**

Add to `demo-shell.component.spec.ts` (follow the file's existing TestBed + agent-stub pattern):

```typescript
it('injects the current itinerary into submit state', async () => {
  // Arrange: store has one stop; spy on the underlying agent.submit.
  // Act: call shell.agent.submit({ messages: [...] })
  // Assert: the orig submit received input.state.itinerary === store.stops()
});

it('pushes the itinerary to the checkpoint after a run settles', () => {
  // Arrange: spy on agent.updateState.
  // Act: simulate run-end (the refreshOnRunEnd / running() → false transition).
  // Assert: updateState called with { itinerary: store.stops() }.
});
```

Fill these in against the concrete stub the spec already uses for `injectAgent(DEMO_AGENT_REF)`. If the spec stubs the agent via a provider, extend that stub with `submit` + `updateState` spies and a `running`/`values` signal.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/app/shell/demo-shell.component.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Extend the submit wrapper + add the sync effects**

In `demo-shell.component.ts`:
- Inject the store: add `protected readonly itinerary = inject(ItineraryStore);` (and provide `ItineraryStore` in the component `providers` array, or app-level — Task 12 sets app-level; component-level is fine here for the shell that owns it). Import `ItineraryStore` from `../itinerary-store`.
- In the `submit` wrapper (lines 393-424), add `itinerary: this.itinerary.stops(),` into the `state: { ... }` object alongside `model/reasoning_effort/gen_ui_mode`.
- After the wrapper, add sync effects:

```typescript
constructor() {
  // ...existing constructor body...

  // Hydrate the working copy from server state on thread switch / values stream.
  effect(() => {
    const v = this.agent.values() as { itinerary?: ItineraryStop[] } | null | undefined;
    if (v && Array.isArray(v.itinerary)) this.itinerary.hydrate(v.itinerary);
  });

  // Persist the working copy to the checkpoint when a run settles.
  let wasRunning = false;
  effect(() => {
    const running = this.agent.running();
    if (wasRunning && !running) {
      void this.agent.updateState?.({ itinerary: this.itinerary.stops() });
    }
    wasRunning = running;
  });
}
```

Import `ItineraryStop` from `../itinerary-store`. If `agent.running` isn't the exact signal name, use the run-state signal the chat agent exposes (check `libs/langgraph` agent type — `refreshOnRunEnd` is already imported by this shell, so an equivalent run-end hook exists; prefer wiring the `updateState` into that hook if cleaner).

- [ ] **Step 4: Add the user-edit sync**

Direct user edits (drag-reorder/add/clear in the panel) must also persist. In `itinerary-panel.component.ts`, after each user-initiated store mutation, call `this.agent.updateState?.({ itinerary: this.store.stops() })` (the panel already injects the agent from Task 7). Guard so it only fires for `source: 'user'` mutations (agent edits are captured by the run-settle effect). Add a focused panel spec asserting `updateState` is called on a user drag-drop.

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run src/app/shell/demo-shell.component.spec.ts src/app/itinerary-panel.component.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add examples/chat/angular/src/app/shell/demo-shell.component.ts examples/chat/angular/src/app/shell/demo-shell.component.spec.ts examples/chat/angular/src/app/itinerary-panel.component.ts examples/chat/angular/src/app/itinerary-panel.component.spec.ts
git commit -m "feat(examples-chat): sync itinerary — submit state + updateState on run-settle and user edit"
```

### Task 10: App-mode signal + toggle + map-compatible routing

**Files:**
- Modify: `examples/chat/angular/src/app/shell/demo-shell.component.ts` (+ `.html`/template, `.css`)
- Modify: `examples/chat/angular/src/app/shell/palette-persistence.service.ts` (reuse for appMode persistence — or the existing persistence service the shell uses)
- Test: `demo-shell.component.spec.ts`

- [ ] **Step 1: Write failing tests for appMode routing**

Add to `demo-shell.component.spec.ts` (port the ag-ui-shell semantics):

```typescript
it('coerces embed → sidebar when App mode turns on', () => {
  // set mode embed, call onAppModeChange('on'); expect navigation to /sidebar and appMode()==='on'
});
it('turning App mode off keeps the current route', () => {
  // mode sidebar + appMode on; onAppModeChange('off'); route stays /sidebar, appMode()==='off'
});
it('selecting embed while App mode is on turns App mode off', () => {
  // appMode on; onModeChange('embed'); expect appMode()==='off'
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/app/shell/demo-shell.component.spec.ts`
Expected: FAIL — no `appMode`.

- [ ] **Step 3: Port the appMode state + handlers from ag-ui-shell**

Into `demo-shell.component.ts`, port from `examples/ag-ui/angular/src/app/shell/ag-ui-shell.component.ts`:
- `readonly appMode = signal<'on' | 'off'>(this.initialAppMode());`
- `readonly hasMapsKey = (environment.googleMapsApiKey as string).length > 0;`
- `initialAppMode()`, `onAppModeChange(v)`, and the embed-coercion in `onModeChange` (see ag-ui-shell lines 100-104, 207-235).
- The knob param-sync effect's `appmode` entry (ag-ui-shell lines 191, 201-203): include `appmode` in the query object and coerce `embed → sidebar` when App mode is on. Adapt to demo-shell's existing router/effect (demo-shell parses URL via `urlState()`/`parseUrl()` and navigates via `onModeChange` — keep those; add the appMode coercion in the same navigate path).
- Persist appMode via the shell's persistence service (`write('appMode', ...)`, read in `initialAppMode`).

Import `environment` from `../../environments/environment`.

- [ ] **Step 4: Add the toggle to the toolbar template**

In the demo-shell template, add the App-mode toggle button between the segmented mode buttons and the model field (port markup from `ag-ui-shell.component.html` lines ~18-28), bound to `appMode()`/`hasMapsKey`/`onAppModeChange`. Add the toggle's CSS from `ag-ui-shell.component.css` (`.ag-ui-shell__app-toggle*`), renamed to the `demo-shell__` prefix.

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run src/app/shell/demo-shell.component.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add examples/chat/angular/src/app/shell/
git commit -m "feat(examples-chat): App-mode toggle + map-compatible routing (embed↔sidebar coercion)"
```

### Task 11: App-mode layout — map background + itinerary overlay + sidenav→drawer (layout ①)

**Files:**
- Modify: `examples/chat/angular/src/app/shell/demo-shell.component.html`
- Modify: `examples/chat/angular/src/app/shell/demo-shell.component.css`
- Modify: `examples/chat/angular/src/app/shell/demo-shell.component.ts`

- [ ] **Step 1: Force the thread sidenav to drawer in App mode**

In `demo-shell.component.ts`, make `sidenavMode` (computed, line ~274) return `'drawer'` when `this.appMode() === 'on'` (so the thread sidenav collapses to the hamburger drawer and the map owns the background):

```typescript
readonly sidenavMode = computed<ChatSidenavMode>(() => {
  if (this.appMode() === 'on') return 'drawer';
  if (this.viewportIsNarrow()) return 'drawer';       // keep existing narrow-viewport rule
  return this.storedDesktopMode();
});
```
(Preserve the existing viewport/preference logic; add the appMode branch first.)

- [ ] **Step 2: Add the app-body layout branch to the template**

In `demo-shell.component.html`, wrap the `.demo-shell__main` region with an appMode branch, porting `ag-ui-shell.component.html`'s `@if (appMode() === 'on')` block:

```html
@if (appMode() === 'on') {
  <div class="demo-shell__app-body">
    <app-map-canvas class="demo-shell__map" />
    <app-itinerary-panel class="demo-shell__itinerary-overlay" />
    <div class="demo-shell__main" [attr.data-sidenav-mode]="null">
      <router-outlet />
      @if (agent.interrupt && agent.interrupt()) {
        <div class="demo-shell__interrupt-panel" role="region" aria-label="Approval required">
          <chat-interrupt-panel [agent]="agent" (action)="onInterruptAction($event)" />
        </div>
      }
    </div>
  </div>
} @else {
  <!-- existing .demo-shell__main block unchanged -->
}
```
Add `MapCanvasComponent` and `ItineraryPanelComponent` to the component `imports` array. Keep the `<chat-sidenav>` / palette markup outside this branch (the sidenav is still present but in drawer mode).

- [ ] **Step 3: Port the app-body CSS**

Into `demo-shell.component.css`, port `.ag-ui-shell__app-body`, `.ag-ui-shell__map` (full-bleed background), `.ag-ui-shell__itinerary-overlay` (floating left overlay), renamed to `demo-shell__`. Ensure `.demo-shell__map` is `position:absolute; inset:0;` behind the overlay + chat rail, and the itinerary overlay floats above it (left, with a max-width). Chat renders as the right rail via the existing sidebar/popup mode components.

- [ ] **Step 4: Verify build + a rendering unit check**

Run: `npx nx build examples-chat-angular --configuration development`
Expected: builds. Add/extend a demo-shell spec asserting that with `appMode() === 'on'` the template renders `app-map-canvas` and forces `sidenavMode() === 'drawer'`.
Run: `npx vitest run src/app/shell/demo-shell.component.spec.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add examples/chat/angular/src/app/shell/
git commit -m "feat(examples-chat): App-mode cockpit layout (map bg + itinerary overlay + sidenav→drawer)"
```

### Task 12: Wire client tools + store into the app; mode components render the cockpit

**Files:**
- Modify: `examples/chat/angular/src/app/app.config.ts`
- Modify: `examples/chat/angular/src/app/shell/demo-shell.component.ts`
- Modify: `examples/chat/angular/src/app/modes/sidebar-mode.component.ts`, `popup-mode.component.ts`, `embed-mode.component.ts`
- Create (copy + edit): `examples/chat/angular/src/app/modes/app-mode-promo.component.ts` (+ spec), retune `welcome-suggestions*`

- [ ] **Step 1: Provide the store + maps loader in app.config**

In `examples/chat/angular/src/app/app.config.ts` add to `providers`:

```typescript
import { inject, provideEnvironmentInitializer } from '@angular/core';
import { ItineraryStore } from './itinerary-store';
import { GoogleMapsLoader } from './google-maps-loader';
// ...
    ItineraryStore,
    provideEnvironmentInitializer(() => inject(GoogleMapsLoader).ensureLoaded()),
```
Do **not** add a seed / `initialValues` — the demo starts empty. Keep the existing `LANGGRAPH_THREADS_CONFIG`/`provideChat` providers.

- [ ] **Step 2: Expose the client-tools registry on the shell**

In `demo-shell.component.ts` add:

```typescript
import { itineraryClientTools } from '../client-tools';
// field:
readonly clientTools = itineraryClientTools();   // built in injection context
```

- [ ] **Step 3: Bind the map/itinerary + clientTools in the mode components**

Port the ag-ui mode composition into the chat modes:
- `sidebar-mode.component.ts`: bind `[clientTools]="shell.clientTools"` on the `<chat-sidebar>` (inject the shell via `inject(DemoShell)`), and when `shell.appMode() === 'on'` render `<app-map-canvas>` in the sidebar content slot (see `examples/ag-ui/angular/src/app/modes/sidebar-mode.component.ts` for the exact slot/`@if` structure). Import `MapCanvasComponent`, `AppModePromoComponent`.
- `popup-mode.component.ts`: bind `[clientTools]` on `<chat-popup>`; the map renders as the shell background (Task 11), the popup floats over it.
- `embed-mode.component.ts`: bind `[clientTools]` (embed is not an App-mode layout, but the tools remain available so a user in embed can still ask for a plan — harmless; the itinerary just isn't visualized).

- [ ] **Step 4: Port the app-mode promo + retune welcome suggestions**

```bash
cp examples/ag-ui/angular/src/app/modes/app-mode-promo.component.ts examples/chat/angular/src/app/modes/app-mode-promo.component.ts
cp examples/ag-ui/angular/src/app/modes/app-mode-promo.component.spec.ts examples/chat/angular/src/app/modes/app-mode-promo.component.spec.ts 2>/dev/null || true
```
No `@threadplane/ag-ui` import there — no edit beyond confirming the promo image asset path resolves (copy any referenced asset from `examples/ag-ui/angular/src/assets` into `examples/chat/angular/src/assets` if missing).

Retune `examples/chat/angular/src/app/modes/welcome-suggestions.ts` to trip-planning starters:

```typescript
export const WELCOME_SUGGESTIONS = [
  'Plan a long weekend in Paris',
  '3 days in Tokyo with great food',
  'A week on the California coast',
] as const;
```
(Match the existing export name/shape in that file; only change the content to planning prompts. Update `welcome-suggestions.component.spec.ts` expectations accordingly.)

- [ ] **Step 5: Build + unit tests**

Run: `npx nx build examples-chat-angular --configuration development`
Run: `npx vitest run src/app/modes` (from `examples/chat/angular`)
Expected: builds; mode + promo + welcome specs PASS.

- [ ] **Step 6: Commit**

```bash
git add examples/chat/angular/src/app/app.config.ts examples/chat/angular/src/app/shell/demo-shell.component.ts examples/chat/angular/src/app/modes/ examples/chat/angular/src/assets
git commit -m "feat(examples-chat): wire client tools + cockpit into modes; planner welcome suggestions"
```

---

## Phase 4 — Verify

### Task 13: Cross-cutting gates (lint / typecheck / unit / build)

- [ ] **Step 1: Frontend gates**

```bash
npx nx lint examples-chat-angular
npx nx test examples-chat-angular
npx nx build examples-chat-angular --configuration development
```
Expected: lint clean (fix any aliased-input eslint-disable needs), all unit specs green, build succeeds.

- [ ] **Step 2: Backend gates**

```bash
cd examples/chat/python && uv run pytest tests/ -v
```
Expected: all pass (spike + itinerary-state + planner-framing + pre-existing).

- [ ] **Step 3: Commit any fixups**

```bash
git add -A -- examples/chat
git commit -m "chore(examples-chat): gate fixups (lint/typecheck/test)" --allow-empty
```

### Task 14: e2e — App-mode cockpit on examples/chat

**Files:**
- Create: `examples/chat/angular/e2e/app-mode-itinerary.spec.ts`

- [ ] **Step 1: Write the e2e spec**

Using the existing `examples/chat/angular/e2e/test-helpers.ts` (`openDemo`, `messageInput`, `sendButton`, `selectToolbarDropdown`), create `app-mode-itinerary.spec.ts` asserting (no reliance on map tiles — DOM/layout only, per the Maps-canvas harness lesson):

```typescript
import { test, expect } from '@playwright/test';
import { openDemo } from './test-helpers';

test('App mode shows the cockpit with an empty prompt-to-plan state', async ({ page }) => {
  await openDemo(page, '/sidebar?appmode=on');
  await expect(page.locator('app-map-canvas')).toBeVisible();
  await expect(page.locator('app-itinerary-panel')).toContainText(/plan/i);
  // sidenav collapsed to drawer in App mode → hamburger present, panel not pinned
  await expect(page.locator('.demo-shell__hamburger')).toBeVisible();
});

test('embed turns App mode off (coercion)', async ({ page }) => {
  await openDemo(page, '/sidebar?appmode=on');
  await page.getByRole('button', { name: 'Embed' }).click();
  await expect(page).toHaveURL(/\/embed/);
  await expect(page.locator('app-map-canvas')).toHaveCount(0);
});
```
(If `openDemo` can't pass query params, extend it to accept `/sidebar?appmode=on`, mirroring the ag-ui `openDemo(page, '/?appmode=on')` helper.)

- [ ] **Step 2: Run the e2e (kill stale servers first)**

Per the examples-chat e2e runbook, free `:4200`/`:2024` of stale listeners, then:
```bash
npx nx e2e examples-chat-angular -- --grep "App mode"
```
Expected: the two specs pass. (These run keyless-capable — the panel + layout render regardless of Maps tiles.)

- [ ] **Step 3: Commit**

```bash
git add examples/chat/angular/e2e/app-mode-itinerary.spec.ts examples/chat/angular/e2e/test-helpers.ts
git commit -m "test(examples-chat): e2e App-mode cockpit (empty state + embed coercion)"
```

### Task 15: Live Chrome-MCP gate — empty → planning prompt → populated → reload restores

**Manual/controller task (no file changes). Uses the running `:4200` + `:2024` stack + a real LLM (OPENAI_API_KEY in `.env`).**

- [ ] **Step 1:** Ensure the chat stack serves the fresh bundle with a Maps key: restart `examples-chat-angular` serve with `GOOGLE_MAPS_API_KEY` exported (and `GOOGLE_MAPS_MAP_ID=86d464ea7d5306034fe2a254`); confirm `generated-keys.local.ts` has a non-empty key. Symlink the root `.env` into the checkout if serving from a worktree.
- [ ] **Step 2:** In Chrome MCP, open `http://localhost:4200/sidebar?appmode=on`. Probe DOM (not screenshots) to confirm `app-map-canvas` + `app-itinerary-panel` mount and the panel shows the empty prompt-to-plan state.
- [ ] **Step 3:** Send "Plan 3 days in Tokyo with great food". Confirm via `ng.getComponent` / DOM that the agent issues multiple `add_stop` calls and the itinerary panel + map pins populate live across days.
- [ ] **Step 4:** Reload the page mid-thread; confirm the itinerary restores from the checkpoint (`agent.values().itinerary` hydrates the panel/map) — proving per-thread durable state.
- [ ] **Step 5:** Start a new thread; confirm it opens empty (no seed). Record findings; if any layer fails, root-cause before merge (systematic-debugging).

### Task 16: Final review + branch finish

- [ ] **Step 1:** Dispatch a final code-review subagent over the whole diff (spec compliance + code quality).
- [ ] **Step 2:** Confirm the standing no-persist constraint: scan `git diff origin/main...HEAD` for the excluded competitor product name (per the session rule) — it must return nothing.
- [ ] **Step 3:** Use superpowers:finishing-a-development-branch to open the PR (local parity; deploy is a follow-up noted in the PR body).

---

## Notes for the executor

- **DRY/YAGNI:** the ported components are near-verbatim; do not refactor them. Only the documented edits (agent import, empty-state, store hydration, client-tool trimming) are in scope.
- **Standalone-examples convention:** everything lives in `examples/chat`; never import across examples or extract to a lib.
- **No brand-name churn:** do not rename existing `@threadplane/*` imports beyond the `ag-ui → langgraph` swap in `itinerary-panel`.
- **Maps footgun:** a keyless bundle silently disables the map (no error). Verify `generated-keys.local.ts` before every live check.
- **If the spike (Task 1) fails the live proof:** stop and reconcile the client-tool payload key before building the frontend — the whole cockpit depends on it.
