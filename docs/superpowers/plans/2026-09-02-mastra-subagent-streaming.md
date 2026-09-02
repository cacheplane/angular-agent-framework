# Mastra Sub-agent Streaming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Mastra demo streams the sub-agent's child deltas to the AG-UI wire (with an eager `TOOL_CALL_START`), flipping the matrix cell from Partial to Yes.

**Architecture:** See `docs/superpowers/specs/2026-09-02-mastra-subagent-streaming-design.md`. A public-API stream tee (`Proxy` over the Mastra `Agent`, wrapping `stream()`/`resumeStream()`'s `fullStream`) observes each chunk before the unmodified bridge consumes it; the per-run injector maps `tool-call`/`tool-output`/`tool-result`/`tool-call-suspended` chunks to synthesized eager `TOOL_CALL_*` + `SUBAGENT_*` + attributed `TEXT_MESSAGE_*` events and dedupes the bridge's later buffered copies.

**Tech Stack:** Node 20+, `@mastra/core@1.63.2`, `@ag-ui/mastra@1.1.2` (unchanged pins), `node --test`, Playwright + aimock replay.

**Branch:** `blove/mastra-subagent-streaming` (off origin/main; spec + plan committed).

**Files:** `deployments/ag-ui-mastra/{streaming-tee.mjs (new), subagent-emitter.mjs, server.mjs, test/streaming-tee.test.mjs (new), test/subagent-emitter.test.mjs}`; `cockpit/runtimes/mastra/angular/docs/wire-capture-subagents.md`; docs/blog pages listed in Task 5.

---

### Task 0: Spike (no production code)

- [ ] Read `deployments/ag-ui-mastra/server.mjs`, `agents.mjs`, `subagent-emitter.mjs`, `test/subagent-emitter.test.mjs`, and the wire-capture doc; read `node_modules/@ag-ui/mastra/dist/*.mjs` around `isLocalMastraAgent`, `streamMastraAgent` (`this.agent.stream(A,s)` → `processFullStream(m.fullStream,…)`), and `resumeStream` usage, to list every agent member the bridge touches.
- [ ] Card-mount check: read `libs/chat/src/lib/primitives/chat-tool-calls/chat-tool-calls.component.ts` — confirm cards are anchored to entries in the parent `toolCalls()` list (i.e. a `SUBAGENT_STARTED` with no prior `TOOL_CALL_START` renders no card). Record the finding.
- [ ] Raw `fullStream` capture: export the key silently (`export OPENAI_API_KEY=$(grep '^OPENAI_API_KEY=' /Users/blove/repos/angular-agent-framework/.env | cut -d= -f2-)`), write a scratch script in `deployments/ag-ui-mastra/` (uncommitted) that calls the camping supervisor's `stream()` with the delegation prompt and logs every chunk `{type, payload.toolCallId?, payload.toolName?, payload.output?.type}`; note the order of `tool-call` → `tool-output(start/text-start/text-delta×N/text-end/…)` → `tool-result`, the `start`/`step-start` messageId available for `parentMessageId`, and whether `tool-call-suspended` appears.
- [ ] Proxy feasibility test (this one IS committed): `test/streaming-tee.test.mjs` — construct a real `Agent` from `agents.mjs`'s exports (no model call), wrap with a minimal Proxy prototype, assert `'getMemory' in proxy`, `typeof proxy.listTools === 'function'`, and that calling a stubbed `stream()` via the proxy returns an object whose `fullStream` is the wrapped generator. Run `node --test test/streaming-tee.test.mjs` → this fails until Task 1 provides the module; keep it as the failing test.
- [ ] Append "## Streaming spike" to `cockpit/runtimes/mastra/angular/docs/wire-capture-subagents.md` (chunk order, parentMessageId source, card-mount finding, suspended presence). Commit `docs(runtimes): mastra streaming spike — raw fullStream order and card-mount finding` + `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

### Task 1: `streaming-tee.mjs` (TDD)

- [ ] Tests (`test/streaming-tee.test.mjs`): with a fake agent `{ getMemory(){}, listTools(){}, async stream(){ return { fullStream: (async function*(){ yield {type:'a'}; yield {type:'b'}; })(), text: 'x' } } }`: (1) observer sees `a` then `b`, each BEFORE the consumer receives it (record an interleaved trace `obs:a, out:a, obs:b, out:b`); (2) non-`fullStream` properties of the stream result are preserved (`text === 'x'`); (3) `resumeStream` wrapped the same way; (4) other members forward with `this` bound to the real agent (a method reading a `#private` field on a real `Agent` subclass instance still works through the proxy); (5) an observer exception does not break the consumer (logged, chunk still yielded).
- [ ] Implement `withDelegationTee(agent, observe)` per the spec. Commit `feat(runtimes): mastra stream tee — observe fullStream chunks before the bridge consumes them`.

### Task 2: Injector chunk mapping + dedupe (TDD)

- [ ] Tests (`test/subagent-emitter.test.mjs`, extend): feed `chunk()` sequences copied from the spike capture and assert exact events: eager `TOOL_CALL_START{toolCallId,toolCallName,parentMessageId}`/`ARGS{delta: JSON}`/`END` + `SUBAGENT_STARTED` on the `agent-*` `tool-call`; attributed `TEXT_MESSAGE_START/CONTENT×N/END` from `tool-output` inner text chunks (lazy START when `text-start` is absent); `SUBAGENT_FINISHED` on `tool-result` (and `SUBAGENT_ERROR` on the failure shape); `eventsFor` DROPS the bridge's later `TOOL_CALL_START/ARGS/END` for a synthesized id but passes `TOOL_CALL_RESULT`; the old single-chunk synthesis fires ONLY when no deltas were observed; `tool-call-suspended` → close message + `SUBAGENT_FINISHED{outcome:{type:'suspended'}}`; non-`agent-` tool-calls untouched; terminal cleanup closes open messages then `SUBAGENT_ERROR` for pending ids exactly once.
- [ ] Implement in `subagent-emitter.mjs` (pure per-run state: `pending` map with `{ name, messageOpen, messageId, deltasSeen, synthesized }`). Commit `feat(runtimes): mastra injector maps delegation chunks to eager TOOL_CALL_* and attributed child deltas`.

### Task 3: `server.mjs` wiring + e2e

- [ ] Per request: `const injector = createSubagentInjector(); const observe = (c) => { for (const e of injector.chunk(c)) write(e); }; const bridge = new MastraAgent({ ..., agent: withDelegationTee(agent, observe) });` keeping the existing `for (const e of injector.eventsFor(event)) write(e)` for bridge events. Make sure `write` is the same SSE frame writer for both paths.
- [ ] `npm test` (lane) green; free ports (cockpit/ports.mjs → cockpit-runtimes-mastra-angular), `npx playwright test --config cockpit/runtimes/mastra/angular/e2e/playwright.config.ts` → 5/5 (assertions unchanged). Commit `feat(runtimes): mastra server wires the delegation tee into the SSE stream`.

### Task 4: Live verification

- [ ] Real-key server + `npx nx serve cockpit-runtimes-mastra-angular`; POST the delegation prompt and tee the SSE: assert eager `TOOL_CALL_START` + `SUBAGENT_STARTED` precede the first attributed delta; count `TEXT_MESSAGE_CONTENT` with `subagentRunId`; confirm no duplicate `TOOL_CALL_START` for the delegation id. Browser: poll the card's innerText ~150 ms; record growth while `running`; screenshot over `cockpit/runtimes/mastra/angular/e2e/manual/subagent-card-live.png`. Append "## After streaming" + updated "## Browser verification" to the wire-capture doc; note the suspended caveat and the subclass alternative as fallback design. Kill servers. Commit `docs(runtimes): mastra streaming live verification`.

### Task 5: Docs — flip the cell

- [ ] `apps/website/content/docs/choosing-an-adapter/index.mdx`: Mastra Subagents cell → `Yes`; cause cell → the emitter (public-API stream tee) note; the "one Partial cell" sentences in the subagents section rewritten (all three stream live; note Mastra's card streams via the tee because the bridge itself drops child output). `runtimes/getting-started/introduction.mdx` matrix + the "lifecycle-plus-final-text on Mastra" clause; `runtimes/mastra/overview.mdx` Surface row + "How subagents surface" section; `runtimes/mastra/how-it-connects.mdx` sentence pair. Blog: `2026-08-31-we-measured-the-runtime-swap.mdx` matrix cell + the "Two of the three cards stream live. Mastra's fills in at completion…" passage + conclusion; `2026-08-31-what-changes-when-the-runtime-changes.mdx` if it names the Partial. No contractions; one sentence per line. `npx nx test website` green. Commit `docs(website,blog): mastra subagents stream — cell flips to Yes`.

### Task 6: PR + follow-ups

- [ ] Push; open PR `feat(runtimes): mastra sub-agent streaming via a public-API stream tee` (body: research verdict summary, evidence links, tallies, the suspended caveat; end with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`). Do NOT arm auto-merge (the coordinator reviews first).
- [ ] Follow-up chip (coordinator): upstream `tool-output` mapping patch against `ag-ui-protocol/ag-ui` `integrations/mastra/typescript/src/mastra.ts`, referencing #2402/#2403.
