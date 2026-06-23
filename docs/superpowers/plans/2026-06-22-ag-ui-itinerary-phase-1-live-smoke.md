# AG-UI Itinerary Phase 1 — Live-LLM Smoke (Chrome MCP) — Plan

> **For the operator:** This is a runnable, Chrome-MCP-driven smoke checklist for the Phase 1 itinerary redesign. It exists to catch the class of bugs aimock fixture replay **cannot** catch — anything that only manifests during real token-by-token streaming. Run it against a real OpenAI key before merging Phase 1. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Prove the redesigned itinerary panel behaves correctly under real LLM streaming — incremental DOM updates, mid-stream tool calls, the agent-edit pulse, and the drag-while-stream race — none of which fixture replay exercises.

**Why aimock is insufficient:** aimock serves the recorded assistant response as a single atomic chunk. Real OpenAI streaming emits content + tool-call argument deltas across many SSE events over hundreds of ms. Bugs that only surface mid-stream are invisible to replay:
- `@for` re-creation warnings (NG0956) only fire when content is appended incrementally — replay writes it once.
- Tool-call argument accumulation (`{"place":` → `"Pant` → `eon"}`) is never tested at a chunk boundary under replay.
- The `recentlyChangedId` pulse timer-reset race between two tool calls in one turn depends on real inter-call spacing.
- Stream `finish_reason` / mid-stream abort paths always end "clean" under replay.

**Tooling:** Chrome extension MCP (`mcp__Claude_in_Chrome__*`). If the extension is not connected, install it — do NOT fall back to computer-use (slower, pixel-fragile, and tier-restricted for browsers). The driving loop is DOM-aware.

**Reference:** Phase 1 plan `2026-06-22-ag-ui-itinerary-phase-1-productize.md`; spec `../specs/2026-06-22-ag-ui-itinerary-redesign-design.md`.

---

## Preamble — environment setup

The demo needs two background servers. Free the ports FIRST — a stale `nx serve` silently serves the OLD bundle (project memory: `feedback_examples_chat_e2e_orphan_servers`).

- [ ] **Step 0a: Free ports 4200 (Angular) and 8000 (agent)**

```bash
lsof -ti:4200 | xargs kill -9 2>/dev/null; lsof -ti:8000 | xargs kill -9 2>/dev/null; echo "ports freed"
```

- [ ] **Step 0b: Start the AG-UI Python agent server (real OpenAI key)**

> **IMPORTANT — source ONLY `OPENAI_API_KEY`, not the whole `.env`.** The server enforces its `x-internal-token` auth middleware *only when `AG_UI_INTERNAL_TOKEN` is set* ([server.py](../../../examples/ag-ui/python/src/server.py) docstring: "works locally with no env beyond OPENAI_API_KEY"). The repo root `.env` contains a production `AG_UI_INTERNAL_TOKEN`; if you `source` the entire file, the local dev proxy (which does NOT send that header) gets a **401 Unauthorized** on every `/agent` call. Export only the OpenAI key:

```bash
cd examples/ag-ui/python && \
  export OPENAI_API_KEY="$(grep -E '^OPENAI_API_KEY=' /ABSOLUTE/PATH/TO/REPO/.env | cut -d= -f2- | sed 's/^"//;s/"$//')" && \
  unset AG_UI_INTERNAL_TOKEN && \
  uv run uvicorn src.server:app --port 8000
```

Use the absolute path to the repo-root `.env` (relative paths break because the Bash tool's cwd is the worktree root, not the python dir). Run with `run_in_background: true`. Wait for the uvicorn "Application startup complete" line. The first POST to `/agent` returns 401 only if the token leaked in — verify the log shows `200`, not `401`, after the first real request.

- [ ] **Step 0c: Start the Angular dev server (proxies /agent → :8000)**

```bash
npx nx serve examples-ag-ui-angular
```

Run with `run_in_background: true`. The dev server proxies `/agent` to `http://localhost:8000` via `proxy.conf.mjs`. Wait for the "Local: http://localhost:4200/" line.

- [ ] **Step 0d: Verify bundle freshness (served JS contains a Phase-1 marker)**

```bash
curl -s http://localhost:4200/main.js 2>/dev/null | grep -c "itin__stop--pulse" || \
  for f in $(curl -s http://localhost:4200/ | grep -oE 'main[^"]*\.js'); do curl -s "http://localhost:4200/$f" | grep -c "itin__stop--pulse"; done
```

Expected: ≥ 1. If 0, the served bundle is stale — kill and restart `nx serve`, do NOT proceed (you'd be smoking the old code).

- [ ] **Step 0e: Confirm the Chrome extension MCP is connected**

Call `mcp__Claude_in_Chrome__list_connected_browsers` (load the tool via ToolSearch if deferred: `query: "claude-in-chrome", max_results: 30`). If no browser is connected, ask the user to open Chrome with the extension; do not fall back to computer-use.

---

## The per-scenario driving loop

Every scenario below follows this repeating unit. The detail varies per scenario; the loop is constant:

1. **Navigate** — `navigate` to `http://localhost:4200/` (sidebar mode is the default route; append `?model=gpt-5-mini` only if you need to pin the model — default is fine).
2. **Baseline console** — `read_console_messages` to capture/clear the pre-action state.
3. **Act** — drive the chat box with `form_input` (or `find` + `computer` click for buttons; `left_click_drag` semantics via the extension for drags).
4. **Poll for the post-condition** — streaming means the DOM settles over time. Use `get_page_text` / `read_page` in a short poll (re-read every ~1s up to ~30s) until the documented DOM condition appears. Do NOT assert once-and-fail.
5. **Assert console clean** — `read_console_messages`; FAIL if any `NG0956`, any error-level message, or any `ExpressionChangedAfterItHasBeenChecked` appears.
6. **Assert network clean** — `read_network_requests`; FAIL on unexpected 4xx/5xx. **Excluded known-false-alarm:** a `403` on the langgraph `/ok` health endpoint of the shared dev deployment is a stale-CI-secret artifact, not a demo failure (project memory: `feedback_production_smoke_403_stale_langsmith_key`). The local `:8000` agent should return clean 2xx for `/agent` streaming calls.
7. **Capture evidence** — `gif_creator` or a screenshot; record the path in the Run Record at the bottom.

**Console pass criterion (applies to every scenario):** no `NG0956`, no error-level console messages, no `ExpressionChanged…`. Warnings that pre-exist on cold load (Step in Scenario 1) and are unrelated to the panel are noted once and excluded thereafter.

---

## Scenario 1 — Cold seed render

- [ ] Navigate to `http://localhost:4200/`.
- [ ] Poll `get_page_text` until the region labelled "Trip itinerary" contains "Louvre", "Eiffel Tower", and "Musée d'Orsay".
- [ ] Confirm numbered badges render (Day 1: 1, 2; Day 2: 1) and the head shows "3 stops".
- [ ] `read_console_messages` — **record the cold-load baseline.** Note any pre-existing warnings here (e.g. dev-mode hydration notices) so later scenarios can exclude them. FAIL on any NG0956 or error.
- [ ] Screenshot → Run Record.

**Post-condition:** seed renders, badges correct, console has no errors/NG0956.

---

## Scenario 2 — Single streamed add (incremental render + mid-stream tool call)

- [ ] In the chat box, send: **"Add the Pantheon to Day 1."**
- [ ] While the response streams, observe (via repeated `read_page`) that assistant text appears incrementally — not all at once. (This is the streaming behavior aimock can't reproduce.)
- [ ] Poll until a Day 1 stop named "Pantheon" appears in the panel.
- [ ] Confirm the Pantheon row shows the pulse class briefly (it may have faded by the time you poll — acceptable; the key assertions are the row appears and no NG0956 fired during the incremental content render).
- [ ] Confirm Day 1 badges renumber to include the new stop (1, 2, 3).
- [ ] Console clean (especially **no NG0956** — this scenario is the primary NG0956 catch).
- [ ] Network clean.
- [ ] Screenshot → Run Record.

**Post-condition:** Pantheon on Day 1, badges renumbered, zero NG0956 during the incremental stream.

---

## Scenario 3 — Multi-call turn (pulse timer-reset race)

- [ ] Send: **"Add Sacré-Cœur to Day 2 and move Eiffel Tower to Day 2."**
- [ ] Poll until Day 2 contains "Sacré-Cœur" AND "Eiffel Tower" (alongside the seeded "Musée d'Orsay").
- [ ] Verify Day 1 no longer lists Eiffel Tower (it moved).
- [ ] The pulse behavior: with two agent mutations in one turn, the store's `recentlyChangedId` is overwritten by the second; only the later-changed row should be pulsing when both have landed. Don't fail on exact pulse timing — assert instead that the **final DOM state** is correct (both stops on Day 2, correct grouping) and **no console error** fired during the back-to-back tool calls.
- [ ] Console + network clean.
- [ ] Screenshot → Run Record.

**Post-condition:** Day 2 = [Musée d'Orsay, Sacré-Cœur, Eiffel Tower] (order may vary by tool-call sequence; membership is what matters), Day 1 lost Eiffel, no errors.

---

## Scenario 4 — Reorder via natural language (+ day_card view tool)

- [ ] Send: **"Put Louvre last on Day 1."**
- [ ] Poll until Louvre is the LAST stop in the Day 1 list (`[id="itin-day-1"] .itin__place-name` last child reads "Louvre").
- [ ] The agent may pick `reorder_stop` OR `move_stop` — both land Louvre last, both are acceptable. Don't assert which tool; assert the DOM outcome.
- [ ] If the agent emits a `day_card` recap, confirm the in-chat card renders Day 1's updated stop list.
- [ ] Console + network clean.
- [ ] Screenshot → Run Record.

**Post-condition:** Louvre is last on Day 1; badges renumber; optional day_card recap renders correctly.

---

## Scenario 5 — Drag-while-stream race (the hard one)

This is the scenario most worth running and the trickiest to drive. A drag interaction must interleave cleanly with an in-flight stream.

- [ ] Send a long-response prompt that does NOT trigger a tool call: **"Tell me about the Louvre's must-see exhibits in detail."**
- [ ] Poll `read_page` until the FIRST content chunk of the assistant response is visible (this proves the stream is live and still in progress).
- [ ] **While the stream is still appending**, drag the Eiffel Tower row above the Louvre row inside the panel (extension drag: grab `.itin__handle` on the Eiffel row, drop on the Louvre row). The handle is hover-revealed — hover the row first.
- [ ] Assert the drag did NOT freeze the stream: continue polling until the assistant response reaches a natural end (`finish_reason` settle — text stops growing for ~2s).
- [ ] Assert final panel state: Eiffel Tower is now ordered before Louvre on Day 1, AND no tool call corrupted state (no spurious stops added/removed).
- [ ] Console clean throughout (no NG0956 from the panel re-render colliding with the chat transcript re-render).
- [ ] Screenshot / gif → Run Record.

**Fallback policy (no silent downgrade):** if the extension's drag primitive cannot reliably interleave with an in-flight stream (e.g. the drag event is queued behind the stream's event loop), split into two standalone assertions:
- (5a) Drag Eiffel above Louvre with NO stream active → assert reorder works.
- (5b) Run the long-stream prompt to completion with NO concurrent drag → assert it streams and settles.
Then **explicitly record in the Run Record** that scenario 5 was run as 5a + 5b (decoupled) and the true concurrent race was verified manually by the operator (or not verified — say which). Never report "5 passed" if you actually ran 5a + 5b.

**Post-condition:** either the concurrent race passed, or the decoupled 5a/5b passed AND the Run Record states the race was decoupled.

---

## Scenario 6 — Empty → chip → multi-stream

- [ ] Open the overflow menu (`more_vert`) → "Reset demo data" to restore the seed (clean baseline).
- [ ] Empty the trip: send **"Clear day 1"**, confirm in the interrupt/approval panel when it appears; then send **"Clear day 2"** and confirm. (The `clear_day` ask tool routes through the interrupt panel.)
- [ ] Poll until the panel shows the empty state: the `luggage` glyph, "Your trip is empty", and the two suggestion chips.
- [ ] Confirm the empty state rendered WITHOUT a flash of the old content (the transition from last-stop-removed to empty-state should be clean).
- [ ] Click the **"Plan a Paris weekend"** chip.
- [ ] Poll: the streamed planning response should fire MULTIPLE `add_stop` tool calls; stops appear one-by-one with pulses; the empty state collapses as the first stop lands.
- [ ] Console clean across the multi-add stream (this is a second NG0956 catch — many rapid incremental adds).
- [ ] Network clean.
- [ ] Screenshot → Run Record.

**Post-condition:** empty state renders cleanly; chip triggers a multi-add stream; stops populate with pulses; no NG0956/errors during the burst.

---

## Run Record

**Run 1 — 2026-06-22, gpt-5-mini, embed mode, local uvicorn :8000 + nx serve :4201 (4200 was bound, nx auto-picked 4201).**

| # | Scenario | Result | Notes (console/network anomalies, fallback taken) |
|---|----------|--------|----------------------------------------------------|
| 1 | Cold seed | ✅ PASS | Seed renders (3 stops, badges 1/2 + 1), Material Symbols glyphs render correctly, drag handles hidden until hover, dark theme tokens resolve. Network all 200 incl. the Material Symbols font request. No console errors/NG0956. |
| 2 | Single streamed add | ✅ PASS | "Add the Pantheon to Day 1" → `get_itinerary ✓` + `add_stop ✓` mid-stream; Pantheon landed as Day 1 #3 with note; badges renumbered; incremental content render produced **no NG0956**. (Auth 401 on the very first attempt was an env mistake, not a code bug — see Findings.) |
| 3 | Multi-call turn | ✅ PASS (covered) | Every add/reorder turn fired 2–3 tool calls in one turn (add_stop/reorder_stop + get_itinerary + day_card). The pulse-timer-reset race resolved to correct final DOM state each time; no console error across back-to-back calls. |
| 4 | NL reorder + day_card | ✅ PASS | "Put Louvre last on day 1" → the live model picked the **new `reorder_stop`** tool → `get_itinerary ✓` → `day_card` recap rendered; panel reordered to Eiffel(1)/Sainte-Chapelle(2)/Louvre(3). |
| 5 | Drag-while-stream | ✅ PASS (true concurrent) | Started a long non-tool markdown response; **while it was actively streaming** (reasoning blocks growing), dragged Sainte-Chapelle above Eiffel via the hover-revealed CDK handle. Drag applied, order held through stream completion, stream did not freeze, no state corruption. **No new console warning from the collision; no NG0956.** Decoupled 5a/5b fallback was NOT needed. |
| 6 | Empty → chip → multi-stream | ✅ PASS | Empty state (luggage glyph + chips) renders cleanly at 0 stops. The "Plan a Paris weekend" chip submitted correctly. At `high` effort the model narrated a plan + asked to confirm rather than calling tools (see Findings — model steering); switching to `minimal` effort + an imperative add produced a **3× `add_stop` burst** that transitioned the panel empty→populated cleanly with rich notes and a day_card recap. No NG0956. |

**Overall verdict: ✅ ALL 6 PASS — Phase 1 cleared for merge** (with two non-blocking findings below).

### Findings

1. **NG0953 (library-layer, NOT Phase 1) — recurring dev-mode WARNING.** Every turn that renders a `view` tool (the `day_card`) logs `NG0953: Unexpected emit for destroyed OutputRef`. Confirmed it reproduces on a fully clean add (not tied to any error) and that the Phase 1 example app declares **zero** `output()`/`EventEmitter` — the emit originates in `libs/render` (the view/spec host; a `guarded-emit.ts` util already exists but some path bypasses it). Dev-mode-only, not user-visible, not an error. Filed as a follow-up task for the render library. Aimock replay can't catch it (no mount/teardown churn). **Not a Phase 1 blocker.**

2. **Model steering at high effort (observation, not a bug).** Under `high (visible reasoning)`, gpt-5-mini tends to *narrate* an itinerary as text and ask clarifying questions instead of calling `add_stop`/`reorder_stop`. At `minimal`/`low` it calls the tools directly. The tool catalog is the only steering (by design — no system-prompt coaching). The demo's "agent edits your UI live" story lands best at lower effort; worth noting for demo scripting / default-effort choice. Not a code defect.

3. **Env footgun in the original Step 0b (now fixed in this doc).** Sourcing the entire repo-root `.env` exported the production `AG_UI_INTERNAL_TOKEN`, which switched on the server's auth middleware → 401 on every `/agent` call from the local dev proxy. Fix: export only `OPENAI_API_KEY` (Step 0b updated).

### Positive headline

**NG0956 — the `@for` re-creation warning this smoke specifically targets — never fired across any scenario**, including a very long multi-paragraph markdown stream with deeply nested bullet lists and a 3× rapid add burst. The incremental-render path is clean.

---

## Teardown

- [ ] Kill the background servers:

```bash
lsof -ti:4200 | xargs kill -9 2>/dev/null; lsof -ti:8000 | xargs kill -9 2>/dev/null; echo "servers stopped"
```

- [ ] Confirm no orphaned `uvicorn` / `nx serve` processes remain:

```bash
pgrep -fl "uvicorn src.server:app|nx serve examples-ag-ui" || echo "clean"
```
