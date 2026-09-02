# PR D: Mastra Subagent Demo + Emitter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Mastra camping-trip demo delegates forecasting to a `weather_forecaster` sub-agent (Mastra 1.8+ `agents` property) and emits standard `SUBAGENT_*` events; expected cell: **Partial** (lifecycle + final text; no child token streaming unless the spike proves otherwise).

**Architecture:** Easiest lane — we own the whole SSE path. The backend is `deployments/ag-ui-mastra/` (hand-written `server.mjs` bridge over `@ag-ui/mastra` + `@mastra/core@1.63.2`, already on `@ag-ui/client` 0.0.59 in dev). The specialist is registered via the supervisor's `agents` property; delegation lifecycle comes from `onDelegationStart`/`onDelegationComplete` hooks (added `@mastra/core@1.8.0`); the emitter injects the standard events into the same event stream `server.mjs` already serializes. Mastra docs guarantee the child's FINAL text as a tool result only — child deltas are assumed absent; the spike checks whether `tool-output`/writer chunks give more. Depends on PR A on main.

**Tech Stack:** Node 20+, `@mastra/core` (bump within 1.x if `agents`/hooks need it — check installed 1.63.2 exports first), `@ag-ui/core` 0.0.59 (TS — the Subagent event types are definitely available here), LibSQL persistence.

**Spec:** `docs/superpowers/specs/2026-09-01-runtime-subagents-design.md` §2 (Mastra).

**Branching:** `git fetch origin main && git checkout -b blove/mastra-subagent-demo origin/main` (PR A merged first — verify).

## The target wire contract

```text
TOOL_CALL_START   {toolCallId: <tid>, toolCallName: <delegation tool name Mastra assigns>}   ← bridge-native
SUBAGENT_STARTED  {subagentRunId: <tid>-sub, name: "weather_forecaster", parentToolCallId: <tid>}
TEXT_MESSAGE_START   {messageId: <tid>-sub-m1, role: "assistant", subagentRunId: <tid>-sub}
TEXT_MESSAGE_CONTENT {messageId: <tid>-sub-m1, delta: <final child text — ONE chunk expected>, subagentRunId: <tid>-sub}
TEXT_MESSAGE_END     {messageId: <tid>-sub-m1, subagentRunId: <tid>-sub}
SUBAGENT_FINISHED {subagentRunId: <tid>-sub, outcome: {type: "success"}}
TOOL_CALL_END / TOOL_CALL_RESULT for <tid>
```

On delegation failure: `SUBAGENT_ERROR {subagentRunId, message}`. If the spike finds real child deltas (writer/`tool-output` chunks), forward them as multiple `TEXT_MESSAGE_CONTENT` events — and say so loudly in the evidence doc (upgrades the matrix cell).

---

### Task 0: Spike — installed API surface + live wire capture

**Files to read first (whole files):** `deployments/ag-ui-mastra/server.mjs`, `deployments/ag-ui-mastra/agents.mjs`, `deployments/ag-ui-mastra/package.json`; then check the installed core for the sub-agents API: `cd deployments/ag-ui-mastra && node -e "const {Agent} = require('@mastra/core'); console.log(Object.getOwnPropertyNames(Agent.prototype))"` and `grep -rn "onDelegationStart\|agents" node_modules/@mastra/core/dist/*.d.ts | head -20`. If the installed 1.63.2 lacks the `agents` property/hooks (they shipped in 1.8.0 — 1.63.2 is later, so they should exist), stop and report.

- [ ] **Step 1: Scratch specialist** (uncommitted) in `agents.mjs`, following the file's existing agent-construction idiom:

```javascript
const weatherForecaster = new Agent({
  name: 'weather_forecaster',
  description: 'Forecasts weather for a campsite and date range. Use for any weather question.',
  instructions: 'You are a weather forecaster. Given a campsite and dates, give a 3-bullet forecast summary. Be concise.',
  model: /* the same model the file already constructs */,
});
```
and register on the supervisor: `agents: { weatherForecaster }` plus delegation hooks (exact option shape per the installed .d.ts — read it):

```javascript
  onDelegationStart: (info) => emitter.delegationStart(info),
  onDelegationComplete: (info) => emitter.delegationComplete(info),
```

- [ ] **Step 2: Live wire capture.** `cd deployments/ag-ui-mastra && OPENAI_API_KEY=$OPENAI_API_KEY node server.mjs` (check server.mjs for the port + `X-Internal-Token` requirement — the dev proxy config at `cockpit/runtimes/mastra/angular/proxy.conf.mjs:9-17` shows the header/token to send). POST a RunAgentInput with "Plan a trip to Bear Lake this weekend — what will the weather be?" and tee the SSE. Record: how the delegation appears natively (tool-call shape + name Mastra assigns), whether ANY child text chunks stream, what the hook payloads contain (log them).

- [ ] **Step 3: Evidence commit:** findings + scrubbed capture → `cockpit/runtimes/mastra/angular/docs/wire-capture-subagents.md` (the Mastra example's docs live on the angular side since there's no python dir — confirm by `ls cockpit/runtimes/mastra/`; if a `docs/` convention exists elsewhere for this example, follow it). Commit `docs(runtimes): mastra delegation wire capture and hook payloads`.

---

### Task 1: Scenario + emitter (single task — same file pair, we own the bridge)

**Files:**
- Modify: `deployments/ag-ui-mastra/agents.mjs` — specialist + registration + hooks (final form).
- Create: `deployments/ag-ui-mastra/subagent-emitter.mjs` — builds the standard events (import event type constants from `@ag-ui/core`, already a dep of the bridge lane — check package.json; else use string literals matching the contract exactly) and hands them to the same serialization path `server.mjs` uses for native events (read how server.mjs writes SSE frames; the emitter must enqueue into that stream in order, keyed off the delegation tool call id from the hook payload).
- Modify: `deployments/ag-ui-mastra/server.mjs` — wire the emitter into the stream loop.
- Test: `deployments/ag-ui-mastra/subagent-emitter.test.mjs` (node --test or the lane's existing test idiom — check package.json scripts): feed synthetic hook payloads + a final text, assert the exact event sequence.

- [ ] Run the lane's tests (`npm test` inside deployments/ag-ui-mastra, or `node --test`). Green.
- [ ] Commit: `feat(runtimes): mastra camping demo delegates forecasting; standard SUBAGENT_* emission in the bridge`

### Task 2: e2e fixture + spec

- Modify `cockpit/runtimes/mastra/angular/e2e/fixtures/mastra.json`: delegation-turn fixtures (supervisor call → delegation tool call; specialist call matched on `"match": {"systemMessage": "weather forecaster"}`; `hasToolResult: true` continuation FIRST). NOTE: the aimock harness mocks the OpenAI endpoint the Node backend calls — confirm the mastra e2e global-setup points the Node server's `OPENAI_BASE_URL` at aimock the same way (read `cockpit/runtimes/mastra/angular/e2e/global-setup-impl.ts` first; if the Node lane spawns differently, follow its existing pattern).
- Modify `cockpit/runtimes/mastra/angular/e2e/mastra.spec.ts`:

```typescript
test('rt-mastra: delegated forecast renders a subagent card with the final text', async ({ page }) => {
  const bubble = await submitAndWaitForResponse(page, 'Plan a trip to Bear Lake this weekend — what will the weather be?');
  await expect(page.locator('chat-subagent-card')).toHaveCount(1);
  await expect(page.locator('chat-subagent-card')).toContainText('weather_forecaster');
  await expect(bubble).toContainText(/forecast|weather/i);
});
```

- [ ] `npx playwright test --config cockpit/runtimes/mastra/angular/e2e/playwright.config.ts` (ports 4332 + the node port; free orphans) → 5/5 (4 existing + 1 new). Commit: `test(runtimes): mastra delegation e2e — subagent card via fixture replay`

### Task 3: Live verification

- [ ] Real-key run + browser drive; append scrubbed SSE dump + card screenshot reference to the wire-capture doc; explicitly record "child deltas: absent (single final chunk)" or the upgrade if found. Kill servers.

### Task 4: Deploy + PR

- [ ] The Mastra lane deploys from `deployments/ag-ui-mastra/` via Railway (`railway.json`, `/ok` healthcheck) — no generator step. Confirm `railway.json`/Dockerfile need no changes (new files are plain imports).
- [ ] Full check (lane tests + playwright). Open PR `feat(runtimes): mastra subagent delegation demo with standard SUBAGENT_* emission`; link evidence; state the Partial finding plainly; address AI review; arm auto-merge; verify Railway `/ok` post-merge.
