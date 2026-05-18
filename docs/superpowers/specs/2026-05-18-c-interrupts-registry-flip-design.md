# c-interrupts capability-registry flip — design

> **Place in the larger plan.** Sub-project 4 of the per-cap migration chain. Activates the book_flight + interrupt() backend that PR #382 just landed at `cockpit/chat/interrupts/python/`. Same mechanical pattern as PR #413 (Tier A batch) and PR #417 (c-generative-ui): one-line registry edit, local-dev-only migration, production stays on umbrella until the final cleanup.

## Goal

Switch `c-interrupts` from consuming the umbrella's prompt-only `chat_graphs.py::c_interrupts` to its real ToolNode-loop standalone backend at `cockpit/chat/interrupts/python/` (book_flight tool + interrupt dispatch + UI action→resume wiring, all landed by PR #382).

## Non-goals

- Modifying `cockpit/chat/interrupts/python/` content (already complete on main).
- Modifying the umbrella's `chat_graphs.py` (still serves production).
- Landing the c-interrupts aimock spec (separate sub-project; plan already exists at `docs/superpowers/plans/2026-05-17-c-interrupts-aimock-phase2.md`).
- c-a2ui migration (next sub-project).

## What changes

### Single code edit

`apps/cockpit/scripts/capability-registry.ts` — change `pythonDir` on one row:

| Cap id | Before | After |
|---|---|---|
| `c-interrupts` | `cockpit/langgraph/streaming/python` | `cockpit/chat/interrupts/python` |

`pythonPort: 5503` stays — already aligned with the per-cap `proxy.conf.json` target (`http://localhost:5503`).

### No other files changed

Verified during brainstorm:
- `cockpit/chat/interrupts/python/src/graph.py` — agent ↔ ToolNode loop, book_flight tool at line 27, `interrupt({...})` dispatch at line 50, `[book_flight, find_routes, lookup_flight, get_airport_info]` bound at line 68.
- `cockpit/chat/interrupts/python/src/aviation_data.py`, `aviation_tools.py` — landed by PR #382 (copies of umbrella versions, byte-identical aviation fixtures).
- `cockpit/chat/interrupts/python/langgraph.json` — registers exactly `c-interrupts`.
- `cockpit/chat/interrupts/python/prompts/interrupts.md` — booking-flow prompt that instructs the LLM to call `book_flight`.
- `cockpit/chat/interrupts/angular/proxy.conf.json` — targets `localhost:5503`.
- `cockpit/chat/interrupts/angular/src/app/interrupts.component.ts` — already has `(action)="onInterruptAction($event)"` wiring that maps Accept→`resume('confirm')` and Ignore→`resume('cancel')`.

## Verification

### Production deploy is byte-identical

Same as PRs #413 and #417. `scripts/generate-shared-deployment-config.ts` line 54 skips chat caps; c-interrupts reaches production via the umbrella's manifest, which still registers `c-interrupts: ./src/chat_graphs.py:c_interrupts` (the prompt-only version). Manifest must be byte-identical before/after.

### Interrupt cycle exercised via SDK

Unlike Tier A's "hello" turn or c-generative-ui's two-turn dashboard exchange, c-interrupts requires verifying the full interrupt + resume round trip:

1. **Submit a booking request:** `"Book me on UA123."`
2. **Poll run status:** must reach `interrupted` (not `success`).
3. **Verify interrupt payload:** `state['tasks'][0]['interrupts'][0]['value']` has shape `{type: 'approval_request', summary: str, flight: dict}` with `flight['flight_number'] == 'UA123'`.
4. **Resume with confirm:** POST `{"command":{"resume":"confirm"}}` to `/threads/$T/runs`.
5. **Poll resume status:** must reach `success`.
6. **Verify booking confirmation:** final ToolMessage content starts with `"Booked"`; final AI message references the booking.

This proves the round-trip end-to-end. The Angular UI side was already verified via Chrome MCP during PR #382's manual gate.

### Regression

- `nx e2e cockpit-langgraph-streaming-angular` (streaming cap, unaffected by interrupts)
- `nx e2e cockpit-chat-tool-calls-angular` (tool-calls cap, unaffected)
- `nx e2e cockpit-chat-subagents-angular` (subagents cap, unaffected)

### Reverse audit

After this PR lands:
- 10 of 11 c-* caps on per-cap dirs.
- 1 cap (`c-a2ui`) still on umbrella.
- Umbrella's `chat_graphs.py` + `aviation_data.py` + `aviation_tools.py` untouched.

## Risk surface

- **Per-cap backend never battle-tested via local-dev tooling.** The standalone interrupts backend was exercised via Chrome MCP against a manually-launched `langgraph dev` during PR #382's verification. After the registry flip, `nx serve cockpit-chat-interrupts-angular` will use it for the first time. Verification via SDK round trip catches any wiring bug.
- **Aviation_data drift between umbrella and per-cap.** PR #382 copied these files; they were byte-identical at copy time. If a later umbrella commit modifies them, the per-cap version won't pick that up. Same "two copies" tech debt as the other migrations; resolved by the final umbrella cleanup PR.
- **Shared checkout chaos.** Pre-flight `git fetch origin && git checkout origin/main` to ensure starting from the post-#382 state.

## Acceptance criteria

- `apps/cockpit/scripts/capability-registry.ts` shows `c-interrupts` → `cockpit/chat/interrupts/python`. No other rows changed.
- Per-cap backend imports clean (`CompiledStateGraph`).
- `langgraph dev` boots with exactly `c-interrupts`, no traceback.
- SDK exchange: turn 1 reaches `interrupted` status with the expected interrupt payload shape.
- SDK exchange: resume('confirm') reaches `success` status with booking confirmation in the ToolMessage.
- `npx tsx scripts/generate-shared-deployment-config.ts` output is byte-identical before/after.
- Existing cockpit aimock e2es (streaming, tool-calls, subagents) still pass.
- Umbrella's `chat_graphs.py` and `aviation_*.py` untouched.
- Reverse audit: only `c-a2ui` still on umbrella.
