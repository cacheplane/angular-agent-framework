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
| 10 | Research subagent | ✅ (runs) + 🔶 F5 | run completed with structured summary; renders as plain tool row — no subagent card (known adapter gap: no subagent metadata over AG-UI) |
| 11 | Stop mid-stream | 🔴 F3 | stream halts, but: red error banner "BodyStreamBuffer was aborted" + stray "Success" text appended to the truncated message |
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

### F3 — Stop surfaces as error + stray text — `@threadplane/ag-ui` adapter (high)
User-initiated stop renders a red "BodyStreamBuffer was aborted" error banner and appended a stray "Success" item to the truncated message. The adapter should treat AbortError as graceful cancellation (no error state) and finalize the partial message without appending terminal-event artifacts. Canonical LangGraph stop is graceful — parity gap.

### F4 — json-render binds objects as text — shared render/graph issue (medium, NOT AG-UI-specific)
Generated dashboard specs render `[object Object]` for metric values and a literal `trending_up` icon name. Reproduces byte-for-byte on `demo.threadplane.ai` (langgraph transport), so the bug is in the json-render engine's value/binding resolution (`@threadplane/render`) and/or the graph's `json_render` spec schema — not the AG-UI adapter. Track as its own fix; both demos benefit.

### F5 — No subagent card over AG-UI — adapter gap (medium, known)
The research delegation runs fine but renders as a generic tool row; the canonical demo shows a `chat-subagent` card. The AG-UI adapter doesn't surface subagent metadata (custom events → subagent sub-contract). Needs design: map the graph's subagent custom events into the chat subagent contract in `toAgent()`.

### F6 — NG0956 console warnings during streaming — chat lib perf (low)
Angular warns repeatedly that a tracked `@for` collection (size 1) is re-created per stream chunk (track-by-identity). Cheap fix: stable `track` keys in the streaming message list templates.

## Proposed gap-closure order (Phase 3+)

1. **P3a — F2** example CSS (small, no lib surface).
2. **P3b — F1** chat-input clear-on-send (lib, TDD; affects every consumer).
3. **P3c — F3** ag-ui adapter graceful stop (lib, TDD; parity).
4. **P3d — F4** json-render value binding (shared; fixes canonical prod too).
5. **P3e — F5** subagent card over AG-UI (adapter design + impl).
6. **P3f — F6** track-by keys (cleanup).
