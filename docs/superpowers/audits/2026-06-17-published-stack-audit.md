# Published-stack live audit — 2026-06-17

**Goal:** Act as a real user across the canonical demos + client-tools demos (published backends), exercising happy paths, unhappy paths, performance, and correctness via Chrome MCP. Log findings; defer fixes to a later brainstorm.

**Scope (locked with Brian):** canonical demos (`examples/ag-ui`, `examples/chat`) + client-tools demos on published backends (`cockpit/langgraph/client-tools` JS node on npm `@threadplane/middleware@0.0.2`, `cockpit/ag-ui/client-tools` + `examples/ag-ui` python on PyPI `threadplane-middleware`). Backends run published packages; Angular frontends build from in-repo lib source (noted as a source-vs-published risk, not separately probed).

**Method:** one demo at a time — start backend+frontend, drive in Chrome with a real OpenAI key, record findings, tear down. Severity: 🔴 broken · 🟠 wrong/confusing · 🟡 polish/perf · 🟢 works well.

## Dimensions (per demo)
- **Happy path** — the core real-user flows for each capability.
- **Unhappy path** — empty submit, nonsense/ambiguous input, cancel mid-run, rapid double-submit, stop backend mid-stream, retry after error, very long input, refresh mid-state.
- **Performance** — initial load, time-to-first-token, streaming smoothness, console errors/warnings, network shape, memory growth on repeated actions.
- **Correctness** — state consistency (localStorage/panels), ask-card freeze, continuation after tool round-trips, citations, theme + mode (Embed/Popup/Sidebar) switching.

## Demos & run configs
- **D1 `cockpit/langgraph/client-tools`** — node backend `langgraphjs dev :5308` (npm `@threadplane/middleware@0.0.2`); angular `:4308`. Tools: get_weather (action), weather_card (view), confirm_booking (ask).
- **D2 `cockpit/ag-ui/client-tools`** — python `uvicorn src.server:app --port 5325` (PyPI); angular `:4325`. Same three tools over AG-UI.
- **D3 `examples/ag-ui`** (itinerary canonical) — python `:8000` (PyPI); angular `:4201`. Itinerary panel + 7 capability chips + client tools (get/add/move/clear_day/day_card) + Embed/Popup/Sidebar modes.
- **D4 `examples/chat`** (canonical chat) — `nx run examples-chat-python:serve` + `examples-chat-angular:serve`. Full chat capability set.

## Findings log
(filled during execution)

### D1 — cockpit/langgraph/client-tools (npm 0.0.2)
- 🟢 Happy: action (get_weather), view (weather_card), ask Confirm — all work; continuations stream.
- 🟢 Ask **Cancel** → freezes to "Booking cancelled", model acknowledges, no error.
- 🟢 Empty submit → no-op (correct).
- 🟢 Ambiguous "weather" → model asks "Which location?" (graceful).
- 🟢 Warm dev load fast (TTFB 15ms, interactive 37ms).
- 🟠 **Backend down** → error surfaces but message is just **"HTTP 500:"** (empty body, unhelpful) and takes **~20s** to appear; spinner clears + input recovers afterward.
- 🟠 **Console warning `NG0953: Unexpected emit for destroyed OutputRef`** — a component emits after destroy (likely a client-tools view/ask component or render host on unmount).
- 🟡 No thread restoration on page reload — conversation cleared.

### D2 — cockpit/ag-ui/client-tools (PyPI)
- 🟢 View tool (weather_card) renders (Rome 78°F card) + continuation over the **AG-UI transport on the published PyPI `threadplane-middleware`** backend. Console clean.
- 🟢 Published PyPI backend works end-to-end (validates the rename + PyPI publish).
- (action/ask share the same framework path validated in D1; not re-run exhaustively.)
- ⚪ Harness note: the first programmatic type right after `navigate` often doesn't register (Angular signal input) — a Chrome-MCP pixel-typing quirk, NOT a demo bug; reliable path is click→type→verify-value→Enter.

### D3 — examples/ag-ui (itinerary canonical)
- 🟢 Backend (examples/ag-ui/python) runs clean on **published PyPI `threadplane-middleware`** post-rename.
- 🟢 `add_stop` client tool → Colosseum added to Day 2, **panel updates live**; model chains `get_itinerary`; gen-UI (json-render) "Day 2" recap card renders; final summary correct. Rich multi-capability turn works.
- 🔴 **`DayCardComponent` (day_card view tool) throws `NG0950: Input "day" is required but no value is available yet` — 6×** during streaming render. The view-tool component mounts before its required `day`/`places` inputs are streamed in → `input.required()` throws repeatedly until args arrive. Renders fine visually, but floods console with runtime errors. **Framework-level** (render-host/chat-tool-views mounting timing). Pairs with D1's NG0953 → a **client-tools view/ask component lifecycle bug class**.
- 🟡 Welcome shows only **1 of 7 capability chips** + "More prompts ▾" dropdown at 1483px — 6 capabilities hidden behind a dropdown (discoverability).
- 🟡 Itinerary panel persists **stale localStorage** test data across sessions (Pompidou/Sainte-Chapelle from earlier) — not reset to seed; correct persistence but confusing for a fresh demo.

### D4 — examples/chat (canonical chat) — CLEANEST
- 🟢 Gen-UI / **A2UI**: "render a contact form" → `render_a2ui_surface` → full form (Name/Email/Subject/Message + Send) renders clean. No errors.
- 🟢 Basic streaming chat works; multi-turn in one thread.
- 🟢 **Thread persistence + URL routing** (`/embed/<thread-id>`) + **auto-titling** ("Untitled" → "Contact form HTML example"). Full app shell (projects, search, recent, archived).
- 🟢 **Zero console errors** across the whole session — notably better than the client-tools demos.

### Cross-cutting (perf, console, source-vs-published)
- 🔴/🟠 **Client-tools view/ask component lifecycle bug class** (D1 + D3): `NG0950` (required input not available during streaming mount of view component) + `NG0953` (emit after destroy on ask unmount). The chat demo (no client-tools views) is error-free → the regression is specific to the **client-tools render-host mounting/teardown timing**, the surface we just shipped. Highest-priority finding.
- 🟠 **Error UX**: backend-down surfaces a bare "HTTP 500:" after ~20s. Generic, slow, no retry affordance.
- 🟡 **Thread persistence is inconsistent across demos**: examples/chat persists threads + URL-routes + auto-titles; the client-tools demos (D1/D3) lose the conversation on reload. (May be intentional per-demo, but inconsistent UX story.)
- 🟡 **Capability discoverability**: itinerary welcome shows 1 of 7 chips + "More prompts" dropdown at desktop width.
- 🟡 **Demo data hygiene**: itinerary panel persists stale localStorage test data; "Reset demo data" exists but isn't auto-applied.
- ⚪ **Published-package validation**: PyPI `threadplane-middleware` (D2 + D3 python backends) and npm `@threadplane/middleware@0.0.2` (D1 node backend) both run clean end-to-end. Frontends are in-repo source (not separately probed, per scope).
- ⚪ Harness: post-navigation programmatic typing flakes (Angular signal input) — test-tool artifact, not a product bug.

## Severity-ranked summary
1. 🔴 **NG0950 — day_card view tool throws "required input not available" 6× during streaming render** (D3). Framework: render host mounts view components before streamed args populate required inputs.
2. 🟠 **NG0953 — ask component emits after destroy** (D1). Framework: lifecycle/teardown of resolved ask components.
3. 🟠 **Backend-failure UX** — bare "HTTP 500:", ~20s to surface, no retry (D1).
4. 🟡 Inconsistent thread persistence across demos · capability-chip discoverability · stale demo localStorage.
- ✅ All core capabilities function (client tools action/view/ask, gen-UI/A2UI, streaming, threads, modes); published backends validated; chat demo is pristine.
