# Client-Tool Continuation Hardening — Session Handoff

**Date:** 2026-07-07
**Branch:** `blove/recursing-chaplygin-f20d49` (git worktree)
**Design spec (source of truth):** `docs/superpowers/specs/2026-07-07-client-tool-continuation-architecture-design.md` (Revision 4)

This is a session-continuation handoff. A fresh agent can read this plus the design spec and carry the work forward. The prompt below is self-contained — paste it into a new session.

---

```
You are continuing a design-and-implementation effort on the Threadplane Angular
agent framework (repo: /Users/blove/repos/angular-agent-framework, working on
branch blove/recursing-chaplygin-f20d49, a git worktree). A prior session
completed the research and design; your job is to carry it forward. Start by
reading the design spec — it is the authoritative source of truth:

  docs/superpowers/specs/2026-07-07-client-tool-continuation-architecture-design.md
  (Revision 4)

=== MISSION ===
Threadplane is "the Angular final mile": productized chat/threads/generative-UI
for LangGraph/AG-UI/A2UI-backed enterprise agents. Product strategy: a low-level
protocol/provider layer (Hashbrown) owns AG-UI provider + event primitives +
browser LLM tool execution; Threadplane owns the runtime-neutral `Agent` contract,
chat UX, and client-tool orchestration. The `Agent` contract is the stability
boundary (README.md:152) and the migration seam. NEVER move agent-runtime
orchestration into the low-level layer.

This effort hardens and extends Threadplane's CLIENT-TOOL CONTINUATION model —
how a client-declared tool call (action/view/ask) is executed in the browser and
the run is continued. The decision (already made, do not relitigate): KEEP the
explicit, protocol-visible continuation (backend ends the run via middleware
`routeAfterAgent -> __end__`; browser detects `pending()` from a signal; browser
`resolve()`s by appending a tool message + starting a new run). Do NOT adopt
hidden client-side recursion — it fights server-authoritative checkpoints. Add
ergonomics (auto-execute, followUp, abort, batching, durable dedup) as opt-in,
additive, default-preserving changes behind the contract.

=== RESOLVED DECISIONS (do not reopen; full rationale in the spec) ===
1. Continuation model stays explicit/protocol-visible/server-authoritative.
2. Suppress-continuation ("followUp:false") = a NEW optional capability method
   `settle(id, result)` (record + buffer, no run), NOT a flag on resolve().
   `resolve` = settle + flush the group's buffered ToolMessages in ONE run.
3. Batching = per assistant-turn tool-call group (today N pending function tools
   = N racing runs, a latent bug; characterization tests must lock the CURRENT
   N-runs behavior, and batching FIXES it later).
4. Crash policy = fail-closed by default + per-tool `idempotent:true` opt-out.
5. Max-turns guard = configurable, default 10, surfaced when hit.
6. Durable dedup = BACKEND-AUTHORITATIVE, not a heavy browser store. A server
   `toolCallId` idempotency guard in @threadplane/middleware, shipped with a
   Postgres implementation (mirrors the `(tenant_id, event_id)` ON CONFLICT DO
   NOTHING pattern from the enterprise persistence platform at
   /Users/blove/repos/Intelligence, applied to tool calls). Tiers: Tier 0 = no
   store (today) / Tier 1 = server guard (idempotent continuation + reload
   reconcile, ships M3) / Tier 2 = claim-before-execute (at-most-once for
   non-idempotent browser tools, ships M3.5). Browser marker = fallback only.
   Honest limit: true exactly-once of a browser side effect needs the handler to
   pass its own idempotency key downstream.
7. Postgres table: nullable `tenant_id` column now, single-tenant PK
   (thread_id, tool_call_id) for first ship; tenant_id joins the PK later via an
   additive migration behind a config flag.
8. Shared-core extraction (PR 2) = ONLY the pure `pending` predicate
   (`selectPendingClientToolCalls`); adapters keep their own resolvedIds signal
   and result-application (AG-UI mutates a WritableSignal; LangGraph layers
   applyClientResult over a read-only projection).

=== MILESTONE ROADMAP (spec §10) ===
M0  test hardening (scriptable fake AG-UI agent + characterization tests)  <- NEXT
M1  extract the pure `pending` predicate (PR 2)
M2  AbortSignal in the handler context
M3  backend durable dedup Tier 1 + Postgres impl in @threadplane/middleware
M3.5 Tier 2 claim-before-execute (latency-validate first)
M4  settle() + batch-per-group  (depends on M3 — terminal results need the guard
    to be reload-safe; do NOT ship settle before the guard)
M5  max-turns guard + opt-in continuation policy + typed tool-call lifecycle
M6  Hashbrown-provider -> Agent bridge (future)

=== IMMEDIATE NEXT STEPS ===
1. Read the spec fully.
2. Write the M0 implementation plan to
   docs/superpowers/plans/2026-07-07-client-tools-m0-test-hardening-plan.md
   (repo convention: specs/ = design, plans/ = executable how). Use the
   writing-plans skill. The plan's scope is exactly spec §11 ("First PR scope").
3. Execute PR 1 = M0. Use test-driven / characterization discipline and the
   verification-before-completion skill. PR 1 is TESTS + TEST INFRA ONLY:
   ZERO production behavior change.

M0 concretely (see spec §11 for the full checklist):
  a. Extend libs/ag-ui/src/lib/testing/fake-agent.ts into a scriptable stream:
     script TOOL_CALL_START/ARGS/END (no result), RUN_ERROR, STATE_SNAPSHOT,
     CUSTOM/on_interrupt; and MULTI-STEP continuation by branching run() on the
     presence of an appended role:'tool' ToolMessage in history (models
     backend-ends -> browser resolves -> backend continues). Deterministic
     (setTimeout cadence, cancellable; no clocks/Math.random). Default (no
     script) behavior identical to today. Align with the existing shared testing
     surface (@threadplane/chat/testing FakeAgentConfig; langgraph
     provideFakeAgent + FakeStreamTransport) — extend, don't fork.
  b. Characterization tests, BOTH adapters (AG-UI + LangGraph parity): single
     pending -> 1 run; multiple pending -> N runs (one per resolve, CURRENT
     behavior — do NOT assert batching); resolve-one-doesn't-disturb-others;
     handler throw -> `Error: <msg>` tool message + run still issued; arg-validation
     fail -> `Error: invalid arguments: ...`, handler not called, run still issued;
     view auto-ack; ask via render event; pending empty while isLoading;
     server-resolved call excluded.
  c. Chat-component integration test driving action/view/ask through the
     coordinator using the scriptable fake (not just the hand-built FakeCap).
  Then STOP for review before starting M1.

=== HARD CONSTRAINTS (apply to all work) ===
- Preserve the runtime-neutral `Agent` contract as the stability boundary. All
  new behavior is additive and opt-in; defaults reproduce today's behavior.
- PR 1: zero runtime diff. `git diff` should touch only *.spec.ts and testing/
  scaffolding. Do NOT modify client-tools.ts resolve()/pending(), the executor,
  execute.ts, the coordinator, or adapter runtime code.
- No new dependencies without explicit approval. The Postgres driver (M3) is a
  dependency of @threadplane/middleware ONLY (a Node/backend package) — NEVER of
  the browser libs.
- No new public exports without running `npm run generate-api-docs` and committing.
  Prefer keeping M0 test scaffolding internal to spec/test files.
- Patch-only releases: never bump @threadplane/* to 0.1.0; increment patch.
- Deterministic, local tests only (no network, no live LLM in unit tests).
- NEVER reference external frameworks (hashbrown / copilotkit / chatgpt / claude)
  in code, comments, or commit/PR text. Spec/plan markdown is the only sanctioned
  place. The architecture is independently arrived at.
- Do not relitigate the resolved decisions above.

=== REPO / ENVIRONMENT GOTCHAS ===
- Fresh worktree: postinstall may be skipped. If unit tests can't resolve deps,
  run the generate-public-key script and copy missing node_modules packages
  (e.g. katex) from the main checkout before `npx nx test chat`.
- Lint gate: CI tolerates warnings but fails on ERRORS. Check with
  `<lint output> | grep -cE ' error '`, not the exit code.
- Only Vercel is a required check on main; lint/test/build can land broken and
  only break the release path. Verify tests locally; don't trust CI gating.
- Test targets: `npx nx test ag-ui`, `npx nx test langgraph`, `npx nx test chat`.
- Kill orphaned dev servers on :4200/:2024 before any e2e (not needed for unit).

=== KEY SOURCE REFERENCES ===
Runtime (read; modify only per the milestone you're on):
  libs/chat/src/lib/agent/agent.ts                     (Agent contract)
  libs/chat/src/lib/client-tools/client-tools-capability.ts (pending/resolve iface)
  libs/chat/src/lib/client-tools/client-tool-executor.ts    (13-34, auto-run)
  libs/chat/src/lib/client-tools/execute.ts            (executeFunctionTool 22-34)
  libs/chat/src/lib/client-tools/client-tools-coordinator.ts
  libs/chat/src/lib/client-tools/tools.ts              (action/view/ask authoring)
  libs/ag-ui/src/lib/client-tools.ts                   (pending 63-72, resolve 74-115)
  libs/ag-ui/src/lib/reducer.ts                        (TOOL_CALL_* 186/213/230/247,
                                                        RUN_FINISHED 111)
  libs/ag-ui/src/lib/testing/fake-agent.ts             (FakeAgent.run ~47)
  libs/langgraph/src/lib/client-tools.ts               (pending 108-118,
                                                        resolve 129-171,
                                                        mergeClientTools 60-68)
  libs/middleware/src/langgraph/middleware.ts          (routeAfterAgent 90-98)
Existing specs to extend:
  libs/ag-ui/src/lib/client-tools.spec.ts
  libs/langgraph/src/lib/client-tools.spec.ts
  libs/chat/src/lib/compositions/chat/chat.component.client-tools.spec.ts
Prior design context (specs/):
  2026-06-08-client-tools-design.md  (the current client-tools design)
  2026-04-21-chat-runtime-decoupling-design.md  (why the neutral contract exists)
  2026-04-25-events-on-agent-contract-design.md (state-on-signals invariant)
Prior-art reference (external, for §7 only):
  /Users/blove/repos/Intelligence  (@cpki/source) — Postgres event log +
  (tenant_id,event_id) ON CONFLICT DO NOTHING; built persistence but NOT the
  per-toolCallId execution guard (the layer M3 adds).

=== WORKING STYLE ===
Use skills: writing-plans (before the M0 plan), test-driven-development and
verification-before-completion (during M0), requesting-code-review before
declaring PR 1 done. Package versions: @threadplane/* at 0.0.55, middleware 0.0.2.
Report which files changed and paste passing test output before claiming done.
Stop after PR 1 for human review; do not proceed to M1 unprompted.
```
