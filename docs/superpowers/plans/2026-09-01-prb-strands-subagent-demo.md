# PR B: AWS Strands Subagent Demo + Emitter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Strands meeting-scheduler demo delegates to an `availability_researcher` specialist (agents-as-tools) and emits standard `SUBAGENT_*` events so the Angular `chat-subagent-card` renders the child live.

**Architecture:** Spike-first. A hand-written `@tool` wrapper invokes the specialist `Agent` (this is the documented Strands agents-as-tools form and gives us a code location inside the delegation), and an emitter at the AG-UI bridge boundary produces the standard event sequence. Two candidate emitter seams, decided by the spike: (a) emit directly from the tool body if the bridge exposes an event writer/queue reachable from tool context; (b) subclass the bridge agent's event-dispatch method (the `ag_ui_strands` analogue of our `ActivityEmittingAgent` pattern — reference implementation at `cockpit/ag-ui/subagents/python/src/streaming/activity_emitting_agent.py`) and translate the native `current_tool_use` / `tool_stream_event` stream for the specialist tool. Depends on PR A (adapter) being merged.

**Tech Stack:** Python 3.12 + uv, `strands-agents[openai]>=1.54.0`, `ag-ui-strands` (git-pinned), FastAPI; Playwright + aimock replay for e2e.

**Spec:** `docs/superpowers/specs/2026-09-01-runtime-subagents-design.md` §2 (Strands).

**Branching:** `git fetch origin main && git checkout -b blove/strands-subagent-demo origin/main` (PR A must already be on main; verify `git log origin/main --oneline -20 | grep "SUBAGENT_"`). `npm ci` if needed.

## The target wire contract (the emitter MUST produce exactly this shape)

```text
TOOL_CALL_START   {toolCallId: <tid>, toolCallName: "availability_researcher", parentMessageId}   ← bridge-native
SUBAGENT_STARTED  {subagentRunId: <tid>-sub, name: "availability_researcher", parentToolCallId: <tid>}
TEXT_MESSAGE_START   {messageId: <tid>-sub-m1, role: "assistant", subagentRunId: <tid>-sub}
TEXT_MESSAGE_CONTENT {messageId: <tid>-sub-m1, delta: <child token(s)>, subagentRunId: <tid>-sub}   × N
TEXT_MESSAGE_END     {messageId: <tid>-sub-m1, subagentRunId: <tid>-sub}
SUBAGENT_FINISHED {subagentRunId: <tid>-sub, outcome: {type: "success"}}
TOOL_CALL_END / TOOL_CALL_RESULT for <tid>                                                        ← bridge-native
```

Ids derive from the delegation tool-use id so replay is deterministic. On specialist failure: `SUBAGENT_ERROR {subagentRunId, message}` before the tool result.

---

### Task 0: Spike — bridge internals + live wire capture (no commits to src yet)

**Files:**
- Read: `cockpit/runtimes/aws-strands/python/src/agent.py` (whole file), `src/server.py`
- Read (installed bridge source): `find cockpit/runtimes/aws-strands/python/.venv -name "*.py" -path "*ag_ui*" | head` then read the bridge's endpoint/agent/encoder modules end to end — identify (1) where Strands native events are translated to AG-UI events, (2) whether a tool body can reach an event emitter (queue/writer/context), (3) how events are serialized (does it pass through unknown event types / raw dicts?).
- Check the Python SDK for the new events: `cd cockpit/runtimes/aws-strands/python && uv run python -c "import ag_ui.core as c; print([n for n in dir(c) if 'Subagent' in n])"`. Empty list ⇒ use the raw-dict fallback (emit `{"type": "SUBAGENT_STARTED", ...}` through whatever encoder path the bridge uses for typed events — confirm the encoder serializes dicts or construct a passthrough).

- [ ] **Step 1:** Add the specialist + delegation tool as an uncommitted scratch edit to `src/agent.py` (final version is Task 1 — same code; the spike proves it):

```python
availability_researcher = Agent(
    name="availability_researcher",
    system_prompt=(
        "You are an availability researcher. Given attendee names and a date "
        "range, produce a short bullet summary of likely availability windows. "
        "Be concise: 3 bullets max."
    ),
    tools=[],
    model=build_model(),  # ← use the exact model-construction helper src/agent.py already defines; read it first
)

@tool
def research_availability(attendees: str, date_range: str) -> str:
    """Delegate availability research for the given attendees to a specialist."""
    result = availability_researcher(f"Attendees: {attendees}. Date range: {date_range}.")
    return str(result)
```
(Replace the model line with the file's existing model-construction idiom — read it; the demo already builds an OpenAI-backed model. Register `research_availability` in the orchestrator's `tools=[...]` and extend the system prompt with one sentence telling it to delegate availability questions.)

- [ ] **Step 2: Live wire capture.** Start the server with a real key (export ONLY `OPENAI_API_KEY` — never source the whole root `.env`), from `cockpit/runtimes/aws-strands/python`:
`OPENAI_API_KEY=$OPENAI_API_KEY uv run uvicorn src.server:app --port 5331`
Then capture (RunAgentInput shape — copy an exact request body from the existing e2e fixture `cockpit/runtimes/aws-strands/angular/e2e/fixtures/aws-strands.json`'s recorded inputs or from the bridge's test suite; message: "Find a slot for Ada and Grace next week — research their availability first"):
`curl -N -s http://localhost:5331/agent -H 'content-type: application/json' -d @/tmp/claude-501/.../scratchpad/run-input.json | tee scratchpad/strands-delegation-capture.raw.txt`
Record: what the bridge emits during the delegation tool call TODAY (expect `TOOL_CALL_*` and possibly `CUSTOM MultiAgentHandoff`/`STEP_*`; expect NO child text unless `tool_stream_event` is forwarded — note exactly what appears).

- [ ] **Step 3: Decide the emitter seam** from findings (tool-body writer if reachable; else dispatch-hook subclass) and write the decision + the scrubbed capture into `cockpit/runtimes/aws-strands/python/docs/wire-capture-subagents.md` (strip any org ids/keys; keep the raw event lines). This file is the PR's evidence artifact.

- [ ] **Step 4: Commit the spike evidence only**

```bash
git add cockpit/runtimes/aws-strands/python/docs/wire-capture-subagents.md
git commit -m "docs(runtimes): strands delegation wire capture and emitter-seam decision"
```

---

### Task 1: Scenario — specialist + delegation tool (TDD via e2e-later; python tests now)

**Files:**
- Modify: `cockpit/runtimes/aws-strands/python/src/agent.py` (the Step-1 spike code, final form per the file's idioms; keep existing tools/state/interrupt behavior untouched)
- Test: `cockpit/runtimes/aws-strands/python/tests/` — read the existing test layout; add `test_delegation.py` asserting the orchestrator's tool registry contains `research_availability` and that calling the tool function directly (with the model stubbed the way existing python tests stub it — read them; if they hit the real model, make this a shape-only test of the registry + docstring) returns a string.

- [ ] Run the python tests the way CI does: `cd cockpit/runtimes/aws-strands/python && uv run pytest -q` → green.
- [ ] Commit: `feat(runtimes): strands meeting scheduler delegates availability research to a specialist`

---

### Task 2: Emitter — standard events on the wire

**Files:**
- Create: `cockpit/runtimes/aws-strands/python/src/subagent_emitter.py` — the seam chosen in Task 0. Whichever seam: it must (1) emit `SUBAGENT_STARTED` when the `research_availability` tool use begins (id = tool-use id + `-sub`), (2) forward the specialist's streamed text as `TEXT_MESSAGE_*` carrying `subagentRunId` (if the specialist's tokens are reachable — via `tool_stream_event` translation or a callback handler on the specialist agent, mirroring `cockpit/ag-ui/subagents/python/src/streaming/subagent_stream_handler.py`; if they are not reachable, emit ONE `TEXT_MESSAGE_CONTENT` carrying the final result text and record that limitation for the docs PR), (3) emit `SUBAGENT_FINISHED` success on tool completion and `SUBAGENT_ERROR` on exception. Use `ag_ui.core` event classes if the Task-0 check found them; else raw dicts through the encoder path identified in Task 0.
- Modify: `src/server.py` and/or `src/agent.py` to wire the emitter (subclass mount or tool-body wiring per the seam decision).
- Test: `tests/test_subagent_emitter.py` — unit-test the translation in isolation (feed it the native signals captured in Task 0; assert the exact target sequence above, field for field). Model the test on `cockpit/ag-ui/subagents/python/tests/test_activity_transform.py`.

- [ ] `uv run pytest -q` → green. Commit: `feat(runtimes): strands subagent emitter — standard SUBAGENT_* events at the bridge boundary`

---

### Task 3: e2e fixture + spec

**Files:**
- Modify: `cockpit/runtimes/aws-strands/angular/e2e/fixtures/aws-strands.json` — add fixture entries for the delegation turn: the orchestrator's LLM call answering the new prompt with a `research_availability` tool call, the specialist's LLM call (matched via its distinctive system prompt: `"match": {"systemMessage": "availability researcher"}`), and the orchestrator's continuation (`hasToolResult: true` entry FIRST — ordering rule). Record via `AIMOCK_MODE=record` against the live server (the harness supports it since #947) and normalize, or hand-write matching the existing entries' style.
- Modify: `cockpit/runtimes/aws-strands/angular/e2e/aws-strands.spec.ts` — add:

```typescript
test('rt-strands: delegated availability research renders a subagent card', async ({ page }) => {
  const bubble = await submitAndWaitForResponse(page, 'Find a slot for Ada and Grace next week — research their availability first');
  await expect(page.locator('chat-subagent-card')).toHaveCount(1);
  await expect(page.locator('chat-subagent-card')).toContainText('availability_researcher');
  await expect(bubble).toContainText(/slot|available/i);
});
```
(Adapt helper names to what the spec file actually imports — read it first; the existing 3 tests must stay green.)

- [ ] Run: `npx playwright test --config cockpit/runtimes/aws-strands/angular/e2e/playwright.config.ts` (free ports 4331/5331 of orphans first). Expected: 4/4.
- [ ] Commit: `test(runtimes): strands delegation e2e — subagent card via fixture replay`

---

### Task 4: Live verification (merge gate evidence)

- [ ] Serve backend with real key + `npx nx serve cockpit-runtimes-aws-strands-angular`; drive the delegation prompt in a real browser (Browser pane); capture (1) a fresh scrubbed SSE dump appended to `docs/wire-capture-subagents.md` showing the final emitter output matching the target contract, (2) a screenshot of the rendered card mid-run. Kill servers afterwards (live serve must not overlap e2e ports).
- [ ] If child text does NOT stream live (only final text), record it in the capture doc — that fact decides the matrix cell wording in PR E (Yes vs Partial).

---

### Task 5: Deployment lane

- [ ] Regenerate the aggregated dev deployment: run `npx tsx scripts/generate-ag-ui-deployment-config.ts` (read its header for exact usage) and verify `deployments/ag-ui-dev/deps/aws_strands/` picked up the new agent + emitter files; the generator owns the copy — never hand-edit the dep.
- [ ] `git add deployments/ag-ui-dev && git commit -m "chore(deployments): regenerate ag-ui-dev with the strands delegation demo"`

### Task 6: PR

- [ ] Full check: `uv run pytest -q` (python), the playwright config above (4/4), `npx nx lint` for the angular project if templates changed.
- [ ] Open PR: `feat(runtimes): strands subagent delegation demo with standard SUBAGENT_* emission`. Body: link the wire-capture doc, the screenshot, and note the streaming finding. Address AI review; arm auto-merge. Railway redeploys ag-ui-dev on merge — verify `/ok` boot gate after.
