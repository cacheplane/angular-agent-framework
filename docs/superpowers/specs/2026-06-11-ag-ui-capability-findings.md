# AG-UI Capability Audit — Findings

**Campaign:** `2026-06-11-ag-ui-demo-toolbar-design.md` Phase 2 — **complete (2026-06-11)**.
**Method:** Chrome MCP driving `localhost:4201` (AgUiShell toolbar build, merged in #656) against the real uvicorn backend (`:8000`, live OpenAI key). A fetch recorder captured every `POST /agent` `RunAgentInput` payload for transport-level proof. Cross-checks against the production canonical demo (`demo.threadplane.ai`) localized shared-vs-adapter issues.

## Verdict matrix

| # | Capability | Verdict | Evidence / notes |
|---|------------|---------|------------------|
| 1 | Streaming + markdown | ✅ | e2e + recut evidence (pre-verified) |
| 2 | Citations | ✅ | references + [n] markers (recut 2026-06-11) |
| 3 | Interrupt — Accept | ✅ | live resume proven 2026-06-11 |
| 4a | Interrupt — Edit | ✅ | resume carried edited value; agent acknowledged "$25 not $50" change |
| 4b | Interrupt — Respond | ✅ | payload: `forwardedProps.command.resume = "Manager approval confirmed in ticket OPS-88…"`; reply incorporated it |
| 4c | Interrupt — Ignore | ✅ | payload: `resume: "denied"`; agent acknowledged denial and offered alternatives |
| 5 | Model select (gpt-5-nano) | ✅ | request payload `state.model: "gpt-5-nano"`; **response_metadata echoed `model: "gpt-5-nano-2025-08-07"`** — served by OpenAI, end-to-end proof |
| 6 | Effort=high + reasoning render | ✅ | "Thought for Ns" chips + live thinking text streamed over AG-UI; full final answer |
| 7 | Gen-UI: a2ui | ✅ | pre-verified |
| 8 | Gen-UI: json-render | ✅ (renders) + 🔶 F4 | interactive dashboard rendered (tabs/sliders/checkboxes); metric values show `[object Object]` — **reproduces identically on canonical prod** → shared render/graph issue, not AG-UI |
| 9 | Theme presets + dark/light | ✅ + 🔶 F2 | toggle + URL knobs sync; itinerary panel & mode hosts stay dark in light scheme (example CSS) |
| 10 | Research subagent | ✅ + F5 closed | run completes with structured summary AND renders an inline, persistent `chat-subagent-card` (F5 premise refuted by live smoke; the real defect was a duplicate per-message mount — fixed 2026-06-19) |
| 11 | Stop mid-stream | 🔴 F3 | stream halts, but a red error banner "BodyStreamBuffer was aborted" presents the user's own stop as a failure |
| 12 | Regenerate | ✅ | replaced the aborted message; fresh complete response, no artifacts |
| 13 | Error recovery | ✅ | e2e (pre-verified) |
| 14 | Client tools — embed | ✅ | #655 e2e (3 specs) |
| 15 | Client tools — popup/sidebar | ✅ | popup: `get_itinerary` listed the 4 panel items; sidebar: `add_stop` mutated the live panel (Sainte-Chapelle → Day 1). Proves the #656 `[clientTools]` pass-through fix |

Also verified along the way: mid-conversation model switching (toolbar → composer pill → URL → next request payload), knob persistence across mode navigation, and one shared agent/thread across embed/popup/sidebar.

## Findings (gaps to close in scope)

### F1 — Composer keeps text after Enter send — `@threadplane/chat` bug (high)
Every conversation-state send leaves the sent text in the textarea. Probed live: `chat-input.messageText()` is `""` after submit but the DOM textarea still holds the text — the `[ngModel]` write-back to the view never happens (OnPush + signal + FormsModule). **Reproduced on the production canonical demo** mid-thread; it's masked on first-send because thread-route navigation remounts the composer, and in e2e because Playwright `fill` replaces content. Fix in `libs/chat/src/lib/primitives/chat-input/` with a failing test that types via real DOM events, submits, and asserts the textarea value is empty.

### F2 — Light scheme not honored by example chrome (low, example-level)
`examples/ag-ui` itinerary panel (#655) and the popup/sidebar mode host backgrounds use hardcoded dark colors; with `scheme=light` the toolbar+chat go light but the panel and mode hosts stay dark. Fix with theme-aware CSS keyed off `data-threadplane-chat-theme`.

### F3 — Stop surfaces as an error — `@threadplane/ag-ui` adapter (high)
User-initiated stop renders a red "BodyStreamBuffer was aborted" error banner: `source.abortRun()` makes the underlying AG-UI client invoke `onRunFailed`, and the adapter's handler unconditionally sets `status: 'error'` + `error`. Fix: `stop()` sets an abort-requested flag; `onRunFailed`/submit-catch treat abort errors (flag set, or `AbortError`/abort-message) as graceful cancellation — status `idle`, no error, distinct telemetry. Canonical LangGraph stop is graceful — parity gap. (An earlier note about stray "Success" text was a misread: it was the final streamed delta "Succe|ssive…" truncated mid-word by the abort — expected.)

### F4 — json-render binds objects as text — shared render/graph issue (medium, NOT AG-UI-specific)
Generated dashboard specs render `[object Object]` for metric values and a literal `trending_up` icon name. Reproduces byte-for-byte on `demo.threadplane.ai` (langgraph transport), so the bug is in the json-render engine's value/binding resolution (`@threadplane/render`) and/or the graph's `json_render` spec schema — not the AG-UI adapter. Track as its own fix; both demos benefit.

### F5 — ✅ CLOSED (2026-06-19) — premise refuted; real defect was a duplicate mount
**Original claim:** research delegation renders as a generic tool row, no subagent card (unlike the canonical LangGraph demo).

**Live-LLM smoke refuted this.** The AG-UI adapter DOES surface subagent metadata: `subagentFor` in `libs/ag-ui/.../to-agent.ts` projects `ACTIVITY` events onto `agent.subagents()` keyed by tool-call id (the `text`→`messages` fallback handles the backend's shape), and `chat-subagent-card` rendered + streamed live (verified by screenshot: a `research` card with a `running` badge and 6.7k streamed chars). The audit's observation was a timing artifact — the card is transient (active-only) and the auditor caught it on one transport's run but not the other.

**The real, transport-agnostic defect:** `<chat-subagents [agent]>` was mounted inside the per-assistant-message `ai` template in the `<chat>` composition but bound the whole agent's `subagents()`, so it re-rendered the same active cards once per assistant message → duplicate cards (and the durable trace after completion was a generic "called task" chip).

**Fix (PR for `2026-06-19-subagent-card-inline-persistent`):** the spawning `task` tool call now renders **as** an inline, persistent `chat-subagent-card` in `chat-tool-calls` (running = expanded/live, done = collapsed summary), replacing the generic chip; the duplicate per-message mount is removed. Keyed on `toolCallId`, so it fixes both transports. Live re-smoke confirmed: 3 subagents → 3 cards, **0 duplicate ticks**, persist + collapse on done, **0 NG0956**, no leftover task chips.

### F6 — NG0956 console warnings during streaming — chat lib perf (low)
Angular warns repeatedly that a tracked `@for` collection (size 1) is re-created per stream chunk (track-by-identity). Cheap fix: stable `track` keys in the streaming message list templates.

## Gap-closure status (updated 2026-06-12, Phase 3)

Phase 3 (branch `ag-ui-gap-closure-p3`, plan `2026-06-11-ag-ui-gap-closure-p3.md`) closed F1, F2, F3, F4, and the main F6 source — each TDD'd, two-stage reviewed, and re-verified in a live Chrome smoke against the real backend:

- **F1 ✅** — chat-input binds `[value]`/`(input)` directly (FormsModule dropped, `@angular/forms` peer removed from `@threadplane/chat`); composer verified clearing live, including mid-stream sends. The `name="messageText"` attribute was preserved for cockpit selectors.
- **F2 ✅** — AgUiShell sets `data-color-scheme` + index.html pre-bootstrap script; page chrome (itinerary panel, mode hosts) verified light live.
- **F3 ✅** — adapter settles abort-shaped failures as graceful cancellation on BOTH delivery paths (`onRunFailed` AND the synthesized `RUN_ERROR` event — the second path was caught only by the live smoke, not the stub harness). No banner on stop, verified live.
- **F4 ✅** — json-render `{statePath}` props are normalized to the `$bindState` dialect + `_bindings` in `chat-generative-ui`; surfaces are store-isolated per instance unless a consumer passes an explicit `[store]` (the two cockpit dashboard capabilities now opt in explicitly — backend STATE_SNAPSHOT state requires an explicit store by design, matching a2ui). Live dashboard renders real values; zero `[object Object]`.
- **F6 ✅ (main source)** — markdown children/table rows now track by `$index`; zero NG0956 during text/reasoning streaming.
- **F6 residual ✅ (resolved 2026-06-18)** — the json-render *spec assembly* NG0956 residual is gone. Re-grounded against current main (post #680 render-lifecycle rework + F4 + the markdown `$index` fixes): **every** `@for` in the json-render path — `cockpit/ag-ui/json-render` views, the a2ui catalog, `libs/render` core (`render-element` `track $index`, `render-spec` has no `@for`), and `libs/chat` markdown — now keys on a **primitive** (`$index` / string key / numeric value); the NG0956-prone `track <object>` pattern is absent. Confirmed by a live `cockpit-ag-ui-json-render` e2e run streaming the airline dashboard: **zero NG0956** in the console.
  - **No regression guard committed.** An e2e console-guard was prototyped but proven ineffective here: NG0956 only fires when an `@for` collection re-materializes across multiple change-detection cycles, but the aimock fixture replays the spec ~atomically (single `content`), so no `@for` re-evaluates. A negative control — forcing `track [key]` (identity) on the fixture-rendered `container` view — produced **no** NG0956, confirming the e2e harness cannot catch this class of regression. A real guard would need a **component-level** vitest test feeding a render component successive specs (simulating streaming deltas) and asserting no NG0956 across re-materialization. Deferred as optional.
- **F5 ✅ (closed 2026-06-19)** — premise refuted by live smoke (the card already rendered + streamed over AG-UI). The real defect was a transport-agnostic duplicate per-message `<chat-subagents>` mount in the `<chat>` composition. Fixed by rendering the subagent inline + persistent in `chat-tool-calls` (replacing the generic chip) and removing the duplicate mount. See `docs/superpowers/specs/2026-06-19-subagent-card-inline-persistent-design.md`.

Additional follow-ups logged during Phase 3:
- Icon rendering: the a2ui catalog icon component renders icon *names* as text (`trending_up`) — proper icon support is a new catalog feature, not built.
- json-render normalizer handles top-level `{statePath}` props only (matches the documented schema); nested occurrences from model drift would still stringify.
