# AG-UI Docs Technical Review — Findings

**Date:** 2026-06-06
**Pages audited:** 10 (getting-started ×3, concepts ×1, guides ×5, reference ×1)
**Source verified against:** `libs/ag-ui` (esp. `lib/reducer.ts`, `lib/to-agent.ts`, `lib/testing/fake-agent.ts`) + `libs/chat` Agent contract
**Method:** 3 parallel read-only auditors + completeness sweep; controller re-verified every finding against source.

## Resolution status — ✅ ALL FINDINGS FIXED (PR #604)

All 7 findings fixed in a single PR, each re-verified against the current `reducer.ts` (313-line version) + `fake-agent.ts` by an independent reviewer (PASS):
- ✅ **P1** CUSTOM `on_interrupt` row documented; **P2** RUN_STARTED clears `interrupt`, TOOL_CALL_START → `messages` (via `parentMessageId`), MESSAGES_SNAPSHOT → `toolCalls` (by id), architecture `interrupt` bullet, installation FakeAgent `reasoningTokens`. **P3** subsumed by the per-row fixes.

**Process note:** the fix branch was initially cut from a stale local `main` (whose `reducer.ts` predated the `parentMessageId`/snapshot-toolCalls handling). The implementer correctly refused #4/#5 as ungrounded against that stale source; the controller caught the staleness via a blob-hash mismatch, rebased onto current `origin/main`, and the now-valid #4/#5 were applied and verified.

**Verified:** all edited routes returned HTTP 200; no `type="note"` Callout; no `libs/*` source bugs.

## Summary

- **P0: 0** · **P1: 1** · **P2: 5** · **P3: 1**
- **The ag-ui docs are in excellent shape** — all 5 **guides** are clean, and `getting-started` + `architecture` are nearly so. The findings cluster in the **event-mapping reference**, whose "Agent field" column under-reports the multi-signal effects of several AG-UI events (the event reducer is `libs/ag-ui/src/lib/reducer.ts`).
- **No P0s; no wrong package/symbol; no broken links.** Every `@threadplane/langgraph` reference is a legitimate cross-adapter comparison. All 8 public exports are documented.

---

## Findings by severity

### P1 — misleading

| # | page:line | dim | what's wrong | source evidence | fix |
|---|---|---|---|---|---|
| 1 | `reference/event-mapping.mdx:28` | accuracy | `CUSTOM` event row omits the special `on_interrupt` handling — when `name === 'on_interrupt'`, the reducer sets the `interrupt` signal (resumable); other custom events emit via `events$` | `libs/ag-ui/src/lib/reducer.ts:255,261-262` (`store.interrupt.set({ id, value: parsedValue, resumable: true })`) | Expand the CUSTOM row (or add one): `CUSTOM` (`name: 'on_interrupt'`) → sets `interrupt` with the parsed value (resumable); other CUSTOM events emit on `events$` |

### P2 — gap

| # | page:line | dim | what's wrong | source evidence | fix |
|---|---|---|---|---|---|
| 2 | `getting-started/installation.mdx:83` | completeness | `FakeAgent`/`provideFakeAgent` options table omits `reasoningTokens` | `libs/ag-ui/src/lib/testing/fake-agent.ts:35` (`reasoningTokens?: string[]`) | Add row: `reasoningTokens` · `string[]` · Optional reasoning chunks emitted before the text reply (default `[]`) |
| 3 | `reference/event-mapping.mdx:11` | completeness | `RUN_STARTED` also clears the `interrupt` signal — not listed in the Agent-field column | `reducer.ts:71-75` (`store.interrupt.set(undefined)`) | Add `interrupt` (cleared) to the RUN_STARTED effects |
| 4 | `reference/event-mapping.mdx:21` | completeness | `TOOL_CALL_START` also updates `messages` when `parentMessageId` is present (links the call to its parent assistant message) | `reducer.ts:150-175` | Note the `messages` effect when `parentMessageId` is provided |
| 5 | `reference/event-mapping.mdx:27` | completeness | `MESSAGES_SNAPSHOT` also merges snapshot-embedded tool calls into `toolCalls` | `reducer.ts:217-251` | Add `toolCalls` to the MESSAGES_SNAPSHOT effects |
| 6 | `concepts/architecture.mdx:87-90` | completeness | the list of reducer-updated signals omits `interrupt` | `reducer.ts:75,262` | Add an `interrupt` bullet (cleared on `RUN_STARTED`, set by CUSTOM `on_interrupt`) |

### P3 — polish

| # | page:line | dim | what's wrong | source evidence | fix |
|---|---|---|---|---|---|
| 7 | `reference/event-mapping.mdx:9-29` | completeness | the single "Agent field" column makes multi-signal events hard to represent (root cause of #1,#3,#4,#5) | `reducer.ts` (multiple events touch several signals) | Optional: note in the table intro that some events update multiple signals; the per-row fixes above already capture the specifics |

---

## Structural / won't-fix-here

- No `libs/*` source bugs identified.
- `api-docs.json` generator nuances — already tracked as follow-ups from prior reviews.

## Verified NON-issues (no change)

- All `@threadplane/langgraph` references in ag-ui docs are legitimate cross-adapter comparisons / "use langgraph instead" notes / a migration-diff line. No broken or wrong references.
- `guides/*` (testing, fake-agent, citations, troubleshooting, interrupts) — all clean; the "links" rows the auditor listed are all valid (no fix). `fake-agent.mdx` correctly documents `{ tokens?, reasoningTokens?, delayMs? }`.
- All 8 public exports are documented at least once.

---

## Fix plan

Default cutoff: **P0+P1+P2; the P3 is covered by the per-row P2 fixes** (no separate restructure needed). Single PR (the surface is small). Files touched: `reference/event-mapping.mdx`, `getting-started/installation.mdx`, `concepts/architecture.mdx`.
