# App Mode on the LangChain Canonical Demo — Itinerary Cockpit (Design)

**Date:** 2026-07-06
**Status:** Approved design, pending spec review → implementation plan
**Owner:** Brian Love
**Branch:** `feat/langgraph-app-mode-itinerary`

## Goal

Bring the App-mode map cockpit — the travel-itinerary trip planner currently exclusive to `examples/ag-ui` — to the **langchain canonical demo** (`examples/chat`, backed by `@threadplane/langgraph`). This proves the langgraph adapter reaches App-mode feature parity with ag-ui, using a single shared agent.

The one deliberate architectural divergence from ag-ui: **the itinerary lives in the langgraph graph state (checkpointed per thread) alongside `messages`**, rather than in a frontend-only store. This showcases langgraph's durable per-thread state.

## Scope

**In scope (this effort — local parity):**
- Full App-mode cockpit in `examples/chat`: map background, floating itinerary overlay, `appMode` toggle, map-compatible routing (sidebar/popup), welcome suggestions, app-mode promo.
- Itinerary as first-class langgraph graph state, synced client-authoritatively (see State Design).
- Backend: extend the existing `chat` graph (bind client tools + inject itinerary context) — **no second agent/graph**.
- Google Maps key wired into `examples/chat` locally via the `inject-env` `GENERATED_KEYS` mechanism.
- Verification: unit tests at each seam + `examples/chat` e2e for the App-mode cockpit + a live Chrome-MCP smoke against the running langgraph stack (real LLM).

**Explicit non-goals (deferred / rejected):**
- **Deployment** — no Vercel Maps key, no update to the deployed langgraph graph, no prod smoke. Local-first; deploy is a follow-up.
- **Shared library extraction** — the itinerary/map surface is **duplicated** into `examples/chat`, not promoted to a lib. This follows the standalone-examples convention (examples own their code; never share across examples).
- **Server-side geocoding** — geocoding stays in the browser (Maps JS geocoder). No server Google Geocoding key.
- **Second agent / dedicated itinerary graph** — rejected; App mode is a pure layout over the single shared `chat` agent.

## Architecture Overview

App mode is a **presentational layer** over the same agent that powers plain chat. The single `chat` graph gains:
1. an `itinerary` key in its `State` (checkpointed per thread), and
2. the ability to bind frontend-declared client tools (`threadplane-middleware`'s `bind_client_tools`) and to see the current itinerary in the `generate` node's context.

The frontend keeps a live `ItineraryStore` (Angular signals) as the **working copy** driving the map/panel; the graph checkpoint is the **durable record**, synced from the client.

```
User / Agent edits ──▶ ItineraryStore (signals, live)
                          │  map + panel render from this instantly
                          ▼
        submit(): input.state.itinerary = store.stops()   ─┐  (turn start: model sees the trip)
        updateState({ itinerary }) after run / on edit     ─┴─▶ langgraph checkpoint (durable, per thread)
                          ▲
        thread switch ────┘  hydrate store from agent.values().itinerary
        new thread ───────── initialValues seed (Paris)
```

## State Design (the core decision)

### Graph state shape (`examples/chat/python/src/graph.py`)

The current `State` is extended with a flat itinerary list that mirrors the frontend `ItineraryStop` shape exactly (so the panel/map render logic ports 1:1):

```python
from typing_extensions import TypedDict, NotRequired
from typing import Annotated, Optional

class Stop(TypedDict):
    id: str
    day: int
    place: str
    note: NotRequired[str]
    lat: NotRequired[float]
    lng: NotRequired[float]

class State(TypedDict):
    messages: Annotated[list, add_messages]
    model: Optional[str]
    reasoning_effort: Optional[str]
    gen_ui_mode: Optional[str]
    itinerary: list[Stop]        # NEW — plain key = last-write-wins overwrite
```

- **Flat list, day-as-field.** Grouping-by-day stays a pure frontend view (`days()` computed). Matches the store's canonical shape.
- **Plain (non-`Annotated`) key → last-write-wins.** The client always sends the full list (via `input.state` and `updateState`), so an append-style reducer would only duplicate entries. Overwrite is correct for a single agent.
- **Seed** (3 Paris stops) moves server-side conceptually but is delivered through the frontend `initialValues` for a new thread; the graph tolerates an absent/empty `itinerary`.

### Ownership & mutation model: client tools + state sync

Mutations run in the **browser** (reusing the ag-ui client tools almost verbatim — browser geocoding, compute-next-stops), and the result is synced into the durable checkpoint:

1. **Turn start** — the shell's `submit` wrapper injects `state.itinerary = store.stops()` (the identical mechanism already used for `model`/`reasoning_effort`/`gen_ui_mode`). The `generate` node folds a compact summary into context, so the model always sees the current trip. **`get_itinerary` is removed** (no read round-trip).
2. **During a turn** — the model calls `add_stop` / `move_stop` / `clear_day` (client tools). The browser executes them: geocodes, updates the `ItineraryStore` (live map/panel), returns the result as the tool message.
3. **Sync to checkpoint** — after a run settles, the shell calls `agent.updateState({ itinerary: store.stops() })` to capture the agent's edits. Direct user panel edits (drag-reorder, add, clear) between runs call the same `updateState` immediately (no active run to conflict with).
4. **Hydration** — switching threads seeds the store from `agent.values().itinerary` (server truth). A brand-new thread uses `provideAgent`'s `initialValues` (the Paris seed).

**localStorage is dropped** — the checkpoint is now the durable store; `initialValues` covers first paint. Consequence: a brand-new thread always opens on the Paris seed (predictable for a demo), and the itinerary is **per thread** — switching threads swaps the map.

### Ephemeral UI state stays frontend

`recentlyChangedId` (agent-edit pulse) and `focusedStopId` (map focus) are transient view concerns — they remain frontend signals and are **not** persisted to graph state.

### Verified enabling APIs (`@threadplane/langgraph`)

- `agent.values(): Signal<T>` — current graph state values (the `values` stream mode is already enabled). Frontend renders the itinerary from `values().itinerary`.
- `agent.updateState(values, signal, { asNode })` — writes a checkpoint as if a node produced the values. Used for the client → checkpoint sync.
- `provideAgent(..., { initialValues })` — first-paint seed before `values` streams.
- `mergeClientTools` / `createClientToolsCapability` (TS) + `threadplane.middleware.langgraph.bind_client_tools` (Python) — the frontend-client-tool binding path, already used by ag-ui.

## Backend Changes (`examples/chat/python`)

Additive to the existing `chat` graph — plain chat is unaffected when no client-tool catalog is sent.

- Add `threadplane-middleware>=0.0.1` to `pyproject.toml`.
- `State` gains the `itinerary: list[Stop]` key (above).
- `generate` node: when `state["itinerary"]` is non-empty, inject a compact JSON summary into the system context so the model reasons over the current trip.
- `generate` node: bind the frontend client-tool catalog via `bind_client_tools` (only affects runs where the App-mode frontend sends the catalog), composing with the existing server tools (`search_documents`, `request_approval`, `research`, `gen_ui_tool`).
- No new graph, no new `graph_id` in `langgraph.json`.

## Frontend Changes (`examples/chat/angular`)

### Duplicated surface (ported from `examples/ag-ui`, `@threadplane/ag-ui` → `@threadplane/langgraph`)

~1,300 LOC copied and re-wired (agent import, `submit` state field, `values`/`updateState` sync):
`map-canvas.component`, `itinerary-panel.component` (+spec), `itinerary-store` (localStorage removed; hydrate-from-values added), `map-bounds` (+spec), `geocoding.service` (+spec), `google-maps-loader`, `client-tools` (get_itinerary dropped; results sync to checkpoint), `day-card.component`, `clear-day-confirm.component`, plus `modes/app-mode-promo.component` and `modes/welcome-suggestions` App-mode variants.

### Shell reconciliation (`shell/demo-shell.component`) — layout ①

- Add an `appMode` toggle to the toolbar + `hasMapsKey` gate (from `environment.googleMapsApiKey`).
- **In App mode:** the thread sidenav auto-collapses to the hamburger drawer (demo-shell already has drawer mode + hamburger). The map renders full-bleed background, the itinerary floats as a left overlay, chat is the right rail (sidebar) / bubble (popup). Faithful to ag-ui's cockpit; reuses demo-shell's existing drawer machinery.
- Port ag-ui-shell's `appMode` param-sync effect (persist to URL; App mode valid in sidebar/popup; coerce `embed → sidebar` when App mode is on), coexisting with demo-shell's `<mode>/:threadId` route matcher.
- `submit` wrapper extended to inject `state.itinerary`; post-run hook calls `updateState`.

### Config

- `environment.ts` / `environment.development.ts`: add `googleMapsApiKey` + `googleMapsMapId` from `GENERATED_KEYS` (port the `inject-env` wiring from ag-ui). Local `.env` only.
- `app.config.ts`: `provideAgent(...)` gains `initialValues: { itinerary: SEED }`; wire the itinerary client-tools registry.

## Testing Strategy

- **Unit (vitest):** `itinerary-store` hydrate-from-values + no-localStorage; `map-bounds`; `geocoding.service`; the `submit`-wrapper injects `state.itinerary`; `updateState` called on run-settle and on user edit; App-mode routing coercion (`embed → sidebar`).
- **Backend (pytest):** `generate` binds client tools when catalog present and not otherwise; itinerary context injected when `state["itinerary"]` non-empty; plain-chat path unchanged.
- **e2e (`examples/chat` Playwright):** App-mode cockpit renders (map + overlay + right-rail chat); sidenav collapses to drawer in App mode; per-thread itinerary swaps on thread switch. (Map tiles gated on a local Maps key — assert DOM/layout, not tile pixels, per the Maps-canvas harness lesson.)
- **Live gate (Chrome MCP):** against the running `:4200` + `:2024` stack with a real LLM — drive "add the Eiffel Tower to day 2", confirm the pin + panel update live, reload mid-thread and confirm the trip restores from the checkpoint.

## Risks & Mitigations

- **Client-tool payload key alignment** (TS `client_tools` vs Python `bind_client_tools` reading `state["tools"]`): de-risk with a tiny spike early — send the itinerary catalog from `examples/chat` and confirm the model can call `add_stop`. The mechanism is proven in ag-ui; only the langgraph-adapter payload shape needs confirming.
- **`updateState` vs active run**: only call post-run (run settled) for agent edits; user edits occur between runs. Never call during an active run.
- **Shell coexistence**: the appMode param-sync effect and the `<mode>/:threadId` matcher both navigate — port ag-ui's `untracked(mode)` + absolute-`/sidebar` discipline to avoid the bootstrap `→ /embed` bounce.
- **Maps key footgun** (worktree has no local `.env`): symlink the main-checkout `.env` into the worktree root before serving (per the established runbook).

## Open Questions

None blocking. Deploy wiring, lib extraction, and server geocoding are explicit non-goals for this effort.
