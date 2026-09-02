# PR C: Microsoft Agent Framework Subagent Demo + Emitter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The MAF expense demo delegates policy research to a `policy_researcher` specialist and emits standard `SUBAGENT_*` events so `chat-subagent-card` renders the child.

**Architecture:** Spike-first, pattern chosen by evidence. Candidate A: **agents-as-tools** (specialist `ChatAgent` wrapped as a function tool on the primary agent) — smallest diff, but the spike must show the nested run is observable at the bridge. Candidate B: a **two-executor workflow** (primary + specialist executors), leaning on MAF's `executor_invoked`/`executor_completed` events and per-executor streaming updates — stronger native signals, bigger restructuring. Handoff autonomous mode is experimental in Python — do NOT use it. The emitter translates whichever native signals the chosen pattern yields into the standard sequence, at the `agent_framework_ag_ui` bridge boundary (subclass/dispatch hook — the MAF analogue of `cockpit/ag-ui/subagents/python/src/streaming/activity_emitting_agent.py`). Depends on PR A on main.

**Tech Stack:** Python 3.12 + uv, `agent-framework-core>=1.16.0`, `agent-framework-ag-ui>=1.2.1`, OpenAI fallback client (Azure creds unavailable — `build_chat_client` in `src/agent.py:117-138` already falls back).

**Spec:** `docs/superpowers/specs/2026-09-01-runtime-subagents-design.md` §2 (MAF).

**Branching:** `git fetch origin main && git checkout -b blove/maf-subagent-demo origin/main` (PR A merged first — verify).

## The target wire contract (identical to the other runtime PRs — the emitter MUST produce exactly this)

```text
TOOL_CALL_START   {toolCallId: <tid>, toolCallName: "policy_researcher", parentMessageId}          ← bridge-native (candidate A) or synthesized (candidate B)
SUBAGENT_STARTED  {subagentRunId: <tid>-sub, name: "policy_researcher", parentToolCallId: <tid>}
TEXT_MESSAGE_START   {messageId: <tid>-sub-m1, role: "assistant", subagentRunId: <tid>-sub}
TEXT_MESSAGE_CONTENT {messageId: <tid>-sub-m1, delta: <child token(s)>, subagentRunId: <tid>-sub}  × N
TEXT_MESSAGE_END     {messageId: <tid>-sub-m1, subagentRunId: <tid>-sub}
SUBAGENT_FINISHED {subagentRunId: <tid>-sub, outcome: {type: "success"}}
TOOL_CALL_END / TOOL_CALL_RESULT for <tid>
```

On specialist failure: `SUBAGENT_ERROR {subagentRunId, message}` before the tool result. Ids derive from the delegation tool-use id (candidate A) or a stable executor-run id (candidate B) so fixture replay is deterministic.

---

### Task 0: Spike — bridge internals + live wire capture

**Files to read first:** `cockpit/runtimes/microsoft-agent-framework/python/src/agent.py` (whole), `src/server.py`; installed bridge: `find cockpit/runtimes/microsoft-agent-framework/python/.venv -path "*agent_framework*ag_ui*" -name "*.py" | head` then read the endpoint/translation modules end to end. Answer: (1) which MAF run/workflow events the bridge consumes and how they map to AG-UI events, (2) is there a dispatch/encoder hook a subclass can intercept, (3) does a nested agent invoked inside a function tool produce ANY events visible to the bridge (this decides candidate A vs B), (4) `uv run python -c "import ag_ui.core as c; print([n for n in dir(c) if 'Subagent' in n])"` — empty ⇒ raw-dict fallback through the encoder.

- [ ] **Step 1: Scratch candidate-A agent** (uncommitted): add to `src/agent.py` a specialist ChatAgent + a function tool that invokes it, following the file's existing client/agent construction idiom:

```python
policy_researcher = ChatAgent(
    chat_client=build_chat_client(),
    name="policy_researcher",
    instructions=(
        "You are an expense-policy researcher. Given an expense category and "
        "amount, summarize the applicable policy rules in 3 short bullets."
    ),
)

async def research_policy(category: str, amount: float) -> str:
    """Delegate policy research for this expense to a specialist."""
    result = await policy_researcher.run(f"Category: {category}. Amount: {amount}.")
    return result.text
```
(Adapt names/decorators to the exact tool-registration idiom already used by `lookup_expense_policy` — read it; register the tool on the primary agent and extend its instructions with one sentence about delegating policy research.)

- [ ] **Step 2: Live wire capture.** From `cockpit/runtimes/microsoft-agent-framework/python`:
`OPENAI_API_KEY=$OPENAI_API_KEY uv run uvicorn src.server:app --port 5330`
POST a RunAgentInput (copy request shape from the existing e2e fixture / bridge tests) with message "Should I submit a $900 conference travel expense? Research the policy first" and `curl -N ... | tee` the SSE to the scratchpad. Record exactly what the delegation produces today (expect the tool call; note whether ANY nested-run signal or executor activity appears, and whether child tokens stream).

- [ ] **Step 3: Decide candidate A vs B.** A wins if the nested run is observable (or if tool-body emission is possible via a reachable event writer — check whether the bridge exposes one to tools/middleware). If A yields nothing observable AND no writer is reachable, restructure per candidate B: primary + specialist as two executors in a `WorkflowBuilder` graph exposed through the bridge (read the bridge's workflow-mounting support first; if the bridge only mounts single agents, candidate A + emitter-side synthesis from the specialist's own callback stream is the fallback — the specialist agent's `run(stream=True)` updates are consumable inside the tool body regardless of the bridge).

- [ ] **Step 4: Evidence commit:** write findings + scrubbed capture + the decision to `cockpit/runtimes/microsoft-agent-framework/python/docs/wire-capture-subagents.md`; commit `docs(runtimes): maf delegation wire capture and pattern decision`.

---

### Task 1: Scenario (final form of the chosen pattern)

**Files:** `src/agent.py` (+ `src/server.py` if candidate B changes mounting). Existing tools/state/interrupt behavior stays untouched; the three existing e2e tests must stay green. Python test: add `tests/test_delegation.py` mirroring the existing python tests' stubbing style — assert the delegation tool/executor is registered and its docstring/name match the contract.

- [ ] `uv run pytest -q` → green. Commit: `feat(runtimes): maf expense demo delegates policy research to a specialist`

### Task 2: Emitter

**Files:** Create `src/subagent_emitter.py` + wire-up. Contract: consume the chosen pattern's native signals (candidate A: the specialist's streamed `run(stream=True)` updates from inside the tool body, or bridge-intercepted nested events; candidate B: `executor_invoked`/`executor_completed` + executor-attributed `AgentRunUpdate` deltas) and emit the target sequence above through the seam identified in Task 0 (event-writer if reachable, else dispatch-hook subclass mounted in `src/server.py`). Use `ag_ui.core` Subagent event classes if present, else raw dicts through the encoder. Unit test `tests/test_subagent_emitter.py`: feed captured native signals, assert the exact target sequence field-for-field (model on `cockpit/ag-ui/subagents/python/tests/test_activity_transform.py`).

- [ ] `uv run pytest -q` → green. Commit: `feat(runtimes): maf subagent emitter — standard SUBAGENT_* events at the bridge boundary`

### Task 3: e2e fixture + spec

- Modify `cockpit/runtimes/microsoft-agent-framework/angular/e2e/fixtures/microsoft-agent-framework.json`: add the delegation-turn fixtures (orchestrator call → `research_policy`/`policy_researcher` tool call; specialist call matched on its distinctive system prompt `"match": {"systemMessage": "expense-policy researcher"}`; continuation entry with `hasToolResult: true` FIRST — ordering rule). Record with `AIMOCK_MODE=record` or hand-write in the file's existing style.
- Modify `cockpit/runtimes/microsoft-agent-framework/angular/e2e/microsoft-agent-framework.spec.ts`:

```typescript
test('rt-maf: delegated policy research renders a subagent card', async ({ page }) => {
  const bubble = await submitAndWaitForResponse(page, 'Should I submit a $900 conference travel expense? Research the policy first');
  await expect(page.locator('chat-subagent-card')).toHaveCount(1);
  await expect(page.locator('chat-subagent-card')).toContainText('policy_researcher');
  await expect(bubble).toContainText(/policy|expense/i);
});
```
(Adapt to the spec file's actual helpers; existing 3 tests stay green.)

- [ ] `npx playwright test --config cockpit/runtimes/microsoft-agent-framework/angular/e2e/playwright.config.ts` (free ports 4330/5330 first) → 4/4. Commit: `test(runtimes): maf delegation e2e — subagent card via fixture replay`

### Task 4: Live verification

- [ ] Real-key serve + real browser drive of the delegation prompt; append a fresh scrubbed SSE dump (matching the target contract) + card screenshot reference to `docs/wire-capture-subagents.md`. Record whether child tokens streamed (decides Yes vs Partial cell wording in PR E). Kill servers after.

### Task 5: Deployment lane

- [ ] `npx tsx scripts/generate-ag-ui-deployment-config.ts` → verify `deployments/ag-ui-dev/deps/microsoft_agent_framework/` regenerated; commit `chore(deployments): regenerate ag-ui-dev with the maf delegation demo`.

### Task 6: PR

- [ ] Full check (pytest, playwright 4/4). Open PR `feat(runtimes): maf subagent delegation demo with standard SUBAGENT_* emission`; link evidence; note the pattern decision (A vs B) and the streaming finding; address AI review; arm auto-merge; verify Railway `/ok` after merge.
