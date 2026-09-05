# Executable approval tools for the demo graph

**Date:** 2026-09-04
**Status:** Approved design. Blocked on a prerequisite bug fix; the recording step is additionally gated on a live measurement.
**Surface:** `examples/chat/python/src/graph.py`, `examples/chat/angular`, and the hero walkthrough.

## 1. Why

The homepage hero's approval beat currently replays an authored narration: after the human approves, the transcript shows a compact three-step cleanup plan. Measured against the real backend, the product does not do that.

| Prompt | Pauses for approval | Post-approval turn |
|---|---|---|
| Bare request | 12/12 | 0/14 plans — clarifying questions, median 621 chars |
| Request that asks to be walked through it | 22/22 | 22/22 plans, median **5,802 chars / 75 lines**, ending in "What I need from you to proceed" |

Shipped narration: **482 characters**.

So the demo depicts behaviour the product does not have. That is invention, not curation, and re-labelling the frame would not fix it.

**The root cause is structural.** After approval the graph has nothing to execute — `request_approval` is the only relevant tool, and there is no tool that inventories or deletes anything. The model's only available move is to describe at length, or to ask. Give it tools and it acts instead, which is what should make a true recording compact.

A second problem the same change fixes: today the guardrail is a system-prompt instruction. It complies 22/22, but a prompt is not a guarantee, and "we told the model to ask first" is not an answer any team shipping irreversible actions would accept.

## 2. Decisions

| Decision | Choice |
|---|---|
| What "real" means | Genuinely executed against demo-owned state, and visible on screen |
| Where state lives | The graph's `State`, so it rides the checkpoint |
| How the inventory renders | A registered tool view, not generative UI and not markdown |
| How approval is enforced | The destructive tool interrupts itself; code, not prompt |
| Reach | Hero plus the demo's own surfaces, so a visitor can run it |

## 3. Mechanism

### State

A `backups` channel on `State`, seeded from a fixed list on first use so every thread starts identically and a recording is reproducible. Each row carries an id, location, creation date, size, and an optional `retain` tag.

Living in the checkpoint means it is per-thread isolated, and it survives the interrupt, the resume, and a page reload. One scenario then carries the interrupt claim, the durable-thread claim, and the "the pause is a checkpoint, not a modal" line the homepage already makes.

### Tools

`list_backups(older_than_days)` reads state through `InjectedState`, seeding it when empty, and returns the matching rows. This is the inventory the viewer sees.

`delete_backups(ids)` calls `interrupt()` **before doing anything**, with an approval payload naming exactly what will go. On resume it removes those ids via `Command(update=...)` and returns an audit summary. Declined, it deletes nothing and says so. It hard-refuses any id tagged `retain`, so the exclusion is enforced rather than suggested.

Everything before the `interrupt()` call must be idempotent, because LangGraph re-runs the node on resume and `interrupt()` returns the resume value on the second pass. `request_approval` already works this way and is the precedent.

The interrupt keeps the existing `{ type: 'approval_request', reason }` shape so `chat-interrupt-panel` renders unchanged.

**Verified available in this LangGraph:** `InjectedState` and `Command`.

### Why this makes the guardrail real

There is no path to deletion that skips the interrupt, because the interrupt is the first statement in the tool. A prompt cannot talk past it and neither can a jailbreak. That is the pattern teams actually need, and it is what the current demo only asserts.

`request_approval` stays for the generic case and its existing users; the hero's pause now comes from the destructive tool itself.

### Rendering

A `BackupTableComponent` registered as `views({ list_backups: BackupTableComponent })`, merged with the A2UI catalog the hero already passes. The view reads the call's status as well as its result, so it shows a pending state while the tool runs and then the rows — the tool-progress beat comes for free rather than as a separate claim.

### Reach

Tool views and a welcome-suggestion chip go into the demo shell as well as the hero, so a visitor who takes control can run the scenario rather than only watching it. The generic `request_approval`, its aimock fixture, the marketing clip and the cockpit interrupt example are untouched.

## 4. Testing

Python tests for seeding, filtering, and the retain refusal. The test that carries the whole claim: calling `delete_backups` without an approval must interrupt and delete nothing — mutation-checked, because a guardrail test that cannot fail is worse than none.

Angular specs for the tool view's three states. The hero e2e continues to run on the committed replay.

## 5. Gates

**Prerequisite, landing first as its own change.** The duplicate first-prompt submit races the interrupt into an HTTP 400 (`No tool output found for function call …`). It failed 7 of 7 live takes on the longer prompt and 5 of 9 on the shorter one, so nothing can be recorded from a real run until it is fixed. It is a production defect on the live takeover path regardless. aimock never validates function-call/output pairing, which is why replay-based CI cannot see it.

**Measurement gate before re-recording.** This spec asserts that real tools make the model's turn compact, on the reasoning that it is verbose precisely because it can only describe. That is a hypothesis. It must be measured live before committing to a re-recording, the way the two prompt hypotheses were. If the turn is still thousands of characters with tools in hand, stop and rethink rather than trimming by hand.

## 6. Out of scope

Making this the canonical interrupt story in the docs guide and the cockpit capability example. "Gate the destructive tool in code" is better guidance than what the interrupts guide teaches today, but that is a follow-up once the pattern has proven itself here.

Also deferred: the auto-generated thread title rendering as a stray assistant bubble with its own action row, found alongside the 400. Related smell — every assistant message across all three turns shares one id, the reused OpenAI Responses id.
