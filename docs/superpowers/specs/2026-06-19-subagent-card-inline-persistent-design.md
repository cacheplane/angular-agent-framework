# Inline, Persistent Subagent Cards — Design

**Status:** Approved design (brainstormed 2026-06-19). Closes capability gap **F5** with the *real* defect found by live smoke.

## Background — what the live smoke established

F5 in the AG-UI capability audit claimed: *"research delegation renders as a plain tool row — no subagent card, unlike the canonical LangGraph demo."* A live-LLM smoke of `cockpit/ag-ui/subagents` (real OpenAI, DOM sampled every 120ms) **refuted that premise** and surfaced a different, framework-level defect:

1. **The subagent card DOES render over AG-UI** — the `research` card appeared ~10s in with a `running` badge and streamed its summary live (6,746 chars); confirmed by screenshot. The `text`→`messages` "shape mismatch" is a non-issue (the `subagentFor` fallback in `libs/ag-ui/.../to-agent.ts` handles it).
2. **The card is transient by design** — `chat-subagents` filters to active (`pending`/`running`) only (`chat-subagents.component.ts:22`), so on completion the card vanishes and the only durable trace is a generic "called task" chip.
3. **NEW framework bug: duplicate cards.** `<chat-subagents [agent]="agent()" />` is mounted at `chat.component.ts:221` **inside the per-assistant-message `ai` template**, yet it binds the whole agent's `subagents()` (not message-scoped). So it re-renders the same active cards **once per assistant message** — two orchestrator messages → two identical cards. Transport-agnostic; AG-UI just surfaced it first.

These are one design problem: **where and how subagents render in the `<chat>` composition.**

## Goal

Render each subagent **once**, **anchored to its spawning tool call**, **persisting in the transcript** after completion — replacing the generic tool chip. Fixes the duplication bug, the transience, and the "durable trace is a generic chip" weakness in a single transport-agnostic change in `libs/chat`.

## Design decisions (settled via brainstorm)

- **Card replaces the tool chip, inline.** A `task` tool call whose `toolCallId` is a key in `agent.subagents()` renders **as** a `chat-subagent-card` in the message where the call lives — not as a generic `chat-tool-call-card`. One representation, in conversation order, persistent in history.
- **Lifecycle:** running → **expanded** (live stream + spinner + `running` badge); completed/error → **collapsed summary** by default (`▸ research ✓ · N messages`), click to expand. Reuses the existing `<chat-trace [state]>` wrapper already inside `chat-subagent-card` (`done` state collapses).
- **Keep `chat-subagents` as a public primitive** (it's exported) for consumers who want a standalone active-only tray, but **stop mounting it in the default `<chat>` composition.** No public-API break.
- **Transport-agnostic:** the key is `toolCallId`, which both `@threadplane/langgraph` and `@threadplane/ag-ui` already populate in `agent.subagents()` (keyed by tool-call id). One change fixes both.
- **Rollout:** land in `libs/chat`; verify/build all subagent demos across both transports and reconcile their e2e (chip → card).

## Architecture

### 1. `chat-tool-calls` becomes subagent-aware
`libs/chat/src/lib/primitives/chat-tool-calls/chat-tool-calls.component.ts`

- New input: `subagents = input<ReadonlyMap<string, Subagent>>(new Map())` (or read from `agent().subagents?.()` directly — prefer reading off the already-required `agent` input to avoid a new binding the composition must thread). Decision for the plan: **read `agent().subagents?.()`** so no composition wiring changes beyond the input it already has.
- In the `groups` computed: partition `toolCalls()` into (a) **subagent calls** — `tc.id ∈ subagents` — and (b) normal calls. Subagent calls **bypass grouping** and each render a `<chat-subagent-card [subagent]="subagents.get(tc.id)!" />`. Normal calls keep the existing group/template/card path. Subagent calls must not be swept into a "task ×N" strip.
- `chat-tool-calls` imports `ChatSubagentCardComponent`.
- Ordering: render each tool call's representation in tool-call order so a subagent card sits exactly where its `task` call appears.

### 2. Remove the duplicate mount
`libs/chat/src/lib/compositions/chat/chat.component.ts`

- Delete `<chat-subagents [agent]="agent()" />` at line 221 (inside the `ai` message template). Subagents now render via the subagent-aware `chat-tool-calls` already present at line 208 in the same template.
- Drop the now-unused `ChatSubagentsComponent` import from the composition (keep the export from the lib's public API).

### 3. Collapsed-on-complete card
`libs/chat/src/lib/compositions/chat-subagent-card/chat-subagent-card.component.ts`

- The card already wraps its body in `<chat-trace [state]="state()">`. Ensure `chat-trace` **collapses by default when `state==='done'`/`'error'`** and stays **expanded while `running`/`pending`**. If `chat-trace` doesn't already default-collapse on `done`, add a `defaultCollapsed` (or `collapsedWhenDone`) input wired from the card's status. Verify current `chat-trace` behavior first; prefer reusing it over new collapse logic.
- Collapsed summary line shows: name + status glyph + `N message(s)`. Expanded shows the full nested messages (existing template).

### Files

- **Modify:** `libs/chat/src/lib/primitives/chat-tool-calls/chat-tool-calls.component.ts` (subagent-aware rendering)
- **Modify:** `libs/chat/src/lib/compositions/chat/chat.component.ts` (remove per-message `<chat-subagents>` mount + import)
- **Modify:** `libs/chat/src/lib/compositions/chat-subagent-card/chat-subagent-card.component.ts` (collapsed-on-done) — and possibly `libs/chat/src/lib/primitives/chat-trace/chat-trace.component.ts` if a default-collapse input is needed
- **Tests:** specs for `chat-tool-calls` (subagent call → card, normal call → chip, one card per id, no duplication), `chat-subagent-card` (collapsed when done / expanded when running)
- **e2e reconcile:** `cockpit/ag-ui/subagents/angular/e2e/subagents.spec.ts` and `cockpit/chat/subagents/angular/e2e/c-subagents.spec.ts` (both currently assert the generic `getByRole('button', { name: /called task|task/i })` chip — update to assert the `chat-subagent-card` and, for the durable case, that it persists after completion). Re-scan `examples/chat` + `cockpit/langgraph/*` subagent paths for any chip assertions.

## Verification

1. `nx run-many -t test lint build --projects=chat` — green (new + existing specs).
2. Build all subagent demos: `cockpit-ag-ui-subagents-angular`, `cockpit-chat-subagents-angular`, any `cockpit-langgraph` subagent app, `examples-chat-angular`.
3. Reconcile + run the affected e2e (aimock) — chip→card; assert exactly one card per subagent and persistence after completion.
4. **Live re-smoke** of `cockpit/ag-ui/subagents` (real key via root `.env`, the harness set up during F5 verification): confirm **one** persistent card per subagent (no duplicates), collapsed summary after completion, and no NG0956. Capture screenshots.
5. Final review; open PR; arm auto-merge + self-healing watcher.

## Risks / edge cases

- **Grouping interaction:** subagent `task` calls must bypass the "group by name" path, else multiple subagents collapse into one strip. Covered by partitioning before grouping.
- **A subagent whose tool call is in `agent.toolCalls()` but not in any `message.tool_calls`** (transport quirk): `resolveMessageToolCalls` is the source; verify the `task` call is present per-message on both transports (AG-UI reducer links tool calls to the parent message — see prior work). If a subagent id has no owning message tool call, it would not render; flag in the plan to confirm via the live smoke.
- **`excludeToolNames`** still applies to non-subagent tools (GenUI/view) — unchanged.
- **NG0956:** new `@for` over partitioned calls must track by `tc.id` (primitive) — no `track <object>`.

## Self-review

- Coverage: duplication bug (mount move), persistence (inline card), dedup of chip (card replaces chip), collapsed-on-done (chat-trace), transport-agnostic (toolCallId), keep primitive (no API break), all-demo rollout + e2e. ✓
- The change is contained to 3 `libs/chat` files + tests; consumers need no changes (composition reads `agent().subagents()` it already has).
- Closes F5 with the real defect; updates the audit findings doc as part of the PR.
