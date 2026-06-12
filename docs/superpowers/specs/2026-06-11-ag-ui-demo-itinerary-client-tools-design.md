# AG-UI Demo — Itinerary Client Tools + Capability Suggestions — Design

**Date:** 2026-06-11
**Status:** Draft for review
**Scope:** Give the public AG-UI demo (`examples/ag-ui`, deployed by the "ag-ui demo → Vercel" job) two things it lacks: (1) **client tools** demonstrated against *frontend-owned application state* — a visible trip-itinerary panel the user and the agent both read and write — and (2) **welcome suggestion chips** covering every capability the demo now showcases. Today the demo's welcome screen has no chips, and the demo has no client-tools wiring.

## Goal

Make the demo show the full current capability surface in one screen, with the client-tools story told the strongest way: the agent reaches into **live application state the user can see and touch**. The user edits the itinerary panel directly; the agent edits the *same* state through client tools; the panel updates either way. This is the deliberate inverse of the json-render example (backend-owned state → frontend): here the state is frontend-owned and the agent reaches in.

## Non-goals

- No changes to the chat lib, render lib, or adapters — the demo consumes published APIs (`tools`/`action`/`view`/`ask`, `[clientTools]`).
- No browser-context tools (`get_local_context` etc.) — considered and dropped; one coherent state story beats two competing ones. They remain a cockpit-example concern.
- No system-prompt coaching for the client tools. The catalog descriptions must carry the behavior — the demo dogfoods the feature's core promise.

## 1. Frontend-owned state: `ItineraryStore`

New `examples/ag-ui/angular/src/app/itinerary-store.ts` — an Angular-signals store:

```ts
interface ItineraryStop { id: string; day: number; place: string; note?: string; }
```

- `stops = signal<ItineraryStop[]>(seed)` with computed day-grouping.
- Mutations: `add(day, place, note?)`, `move(place, toDay)` (case-insensitive place match), `remove(id)`, `clearDay(day)`, `reset()`.
- **Persistence:** `localStorage` key `ag-ui-demo:itinerary`; hydrate on init, write-through on mutation.
- **Seed** (so the demo reads instantly): Paris trip — Day 1: Louvre ("book tickets"), Eiffel Tower; Day 2: Musée d'Orsay.

## 2. Itinerary panel UI

New `itinerary-panel.component.ts`: a compact panel beside the chat (`.ag-ui-demo` becomes a two-column layout on desktop, stacked on mobile). Day-grouped list; per-stop remove button; small "add stop" input (day select + place text); a "Reset demo data" affordance. Pure consumer of `ItineraryStore` — the agent's writes appear live because both write the same signals.

## 3. Client tools (new `client-tools.ts`, passed via `<chat … [clientTools]>`)

| Tool | Kind | Schema (zod/v4) | Behavior |
|---|---|---|---|
| `get_itinerary` | action | `{}` | returns `{ days: [{ day, stops: [{ id, place, note? }] }] }` |
| `add_stop` | action | `{ day: number, place: string, note?: string }` | `store.add(...)`; returns the added stop |
| `move_stop` | action | `{ place: string, toDay: number }` | `store.move(...)`; returns moved stop or a not-found error result |
| `clear_day` | **ask** | `{ day: number }` | `ClearDayConfirmComponent`: "Clear all N stops on day {day}?" Confirm → `store.clearDay(day)` + emit `{ cleared: true, day }`; Cancel → `{ cleared: false }` |
| `day_card` | view | `{ day: number, places: string[] }` | `DayCardComponent` recap card in the transcript; model-filled, auto-acked |

Notes:
- `move_stop` matches by place name so casual prompts work; `get_itinerary` exposes ids so the model can disambiguate duplicates.
- `clear_day` is the human-gated destructive write — Cancel must leave state untouched and return a result the model can react to.
- `day_card` has no dedicated chip; the model reaches for it after edits at its own discretion (descriptions guide it).

## 4. Welcome suggestion chips

Project `chat-welcome-suggestion` chips (label/value, same pattern as the cockpit examples) into the `[chatWelcomeSuggestions]` slot in `app.html`, with a `send(value)` handler in `app.ts` (`agent.submit({ message })`). Seven chips, two rows:

**Row 1 — backend capabilities**
1. "What do the docs say about streaming?" → search_documents + citations
2. "Build me a revenue dashboard" → gen-UI surface (a2ui / json-render per mode)
3. "Issue me a $50 refund" → request_approval → interrupt panel

**Row 2 — client tools + subagent**
4. "What's on my itinerary?" → `get_itinerary`
5. "Add the Louvre to day 2 of my trip" → `add_stop` (panel visibly changes)
6. "Clear my day 2 plans" → `clear_day` ask-confirm
7. "Research AG-UI and give me the highlights" → research subagent

## 5. Backend changes (`examples/ag-ui/python`)

- `State` gains a `tools` channel (list) — `ag-ui-langgraph` merges `RunAgentInput.tools` into `state["tools"]`; the channel must exist for it to be retained.
- `generate` binds the client catalog: `bind_client_tools(llm, [search_documents, request_approval, research, gen_ui_tool], state)` (from the published `threadplane-client-tools>=0.0.1`).
- Routing: when the model's calls are **pure client-tool calls**, the turn must END (the browser executes and re-runs with the ToolMessage). Server tool calls keep routing to `ToolNode` exactly as today. Use the middleware's `has_server_tool_call` / `client_tool_names` helpers inside the demo's existing `should_continue`; a client-tool-only turn routes to the turn-ending path (skipping `attach_citations` is acceptable on those turns).
- `pyproject.toml` + regenerated `uv.lock`/`requirements.txt` add `threadplane-client-tools>=0.0.1`.

## 6. Verification

- **Live-LLM local smoke (standing gate):** serve the demo locally with a real key; drive all seven chips in a real browser; confirm the panel updates on agent writes, the clear-day confirm gates the write (both Confirm and Cancel paths), and continuations stream after each client-tool round-trip.
- **aimock e2e:** extend `examples/ag-ui/angular/e2e` with a client-tools spec — fixtures for the read ("What's on my itinerary?" → `get_itinerary` call + continuation) and the ask chain ("Clear my day 2 plans" → `clear_day` call; click Confirm; assert the panel's day-2 group empties and the continuation renders). Existing demo specs stay green.
- **Unit:** `ItineraryStore` (mutations, persistence round-trip, case-insensitive move, clearDay).

## 7. Deploy

Normal main-merge path: the demo backend redeploys via its existing job; the frontend via "ag-ui demo → Vercel". No new infra. The backend dep resolves from PyPI (already published).

## Risks / notes

- The `move_stop` name-match can miss on typos; the tool returns a structured not-found result so the model can recover by calling `get_itinerary` — acceptable for a demo.
- `localStorage` seeds can drift from new deploys; the panel's "Reset demo data" affordance is the escape hatch.
- Chip prompts are live-LLM prompts (not fixture-bound); wording was chosen to route reliably to the intended tool, validated during the live smoke.
