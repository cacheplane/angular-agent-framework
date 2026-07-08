# Client-Tool Continuation Architecture — Explicit vs Recursive Follow-Up — Design

**Date:** 2026-07-07
**Status:** Research + recommendation (no code changes yet). **Revision 4** — settles the last schema/API-shaping items: Tier 1 (server idempotency guard) ships in M3, Tier 2 (claim-before-execute) splits to M3.5; the Postgres table ships a nullable `tenant_id` column with a single-tenant PK now (`tenant_id` joins the PK later via additive migration). Builds on Revision 3, which folded in: `settle()` for suppress-continuation, batch-per-tool-call-group, fail-closed crash policy with per-tool idempotent opt-out, max-turns default 10, and the **backend-authoritative durable-dedup model** (server-side `toolCallId` idempotency guard in `@threadplane/middleware`, shipped with a Postgres implementation; browser marker demoted to a fallback).
**Scope:** Decide whether Threadplane's client-tool continuation model should keep its explicit, protocol-visible contract, adopt a hidden recursive follow-up loop (as seen in comparable browser-agent frameworks), or move to a hybrid. Covers the runtime-neutral `Agent` contract, the `ClientToolsCapability`, both adapters (`@threadplane/ag-ui`, `@threadplane/langgraph`), the LangGraph middleware, and the Hashbrown↔Threadplane layering strategy.

> **Naming note:** This spec discusses external frameworks by name for comparison (a React browser-agent framework, a low-level Angular protocol layer, and an enterprise agent-persistence platform whose Postgres event-log design is cited as prior art). Per the repo rule, those names must **never** appear in shipped code, comments, or commit/PR text — the architecture here is independently arrived at. Spec/plan markdown is the only sanctioned place to name them.

---

## 1. TL;DR recommendation

**Keep the explicit, protocol-visible continuation contract. Harden it with tests first. Introduce every behavior-changing knob through an explicitly defined contract change — never a silent default. Make the backend the durable authority; don't build a heavy client-side store.**

1. **Preserve the primitive as-is for now.** `ClientToolsCapability.pending()` and `resolve(id, result)` keep their current signatures and behavior through the test-hardening phase. The backend continues to *end the run* on a client-only tool call (`routeAfterAgent → __end__`); the browser detects the pending call from a signal and resumes with an appended tool message + a new run.
2. **Add ergonomics as clearly-scoped later PRs, each with a defined contract:** an optional `settle()` capability method (suppress-continuation, §5a), batched continuation per tool-call group (§5d), an `AbortSignal` in the handler context (§5b), a max-turns guard (§5e), and durable dedup as a **backend-authoritative** model (§7). None ship in PR 1.
3. **Model recursive auto-continuation as a coordinator *policy*, not hidden adapter behavior.** Adapters stay thin. "Keep re-running until the model stops calling tools" becomes an explicit, inspectable, opt-in strategy.
4. **Durable dedup lives in the backend, not the browser.** The backend event log / LangGraph checkpoint already dedups the happy path. Exactly-once is enforced by a **server-side `toolCallId` idempotency guard in `@threadplane/middleware`, shipped with a Postgres implementation** (the same `ON CONFLICT DO NOTHING` pattern proven in the enterprise persistence platform, applied to tool calls). A minimal browser marker is only a fallback for backends without the guard.
5. **Ownership split:** the low-level protocol/provider/event layer (Hashbrown) owns AG-UI provider + event primitives + browser LLM tool execution; Threadplane owns the runtime-neutral `Agent` contract, chat UX, and the client-tool orchestration/continuation policy. The `Agent` contract is the migration seam.

Why not full hidden recursion as a default: against a stateful, server-authoritative backend a client that silently splices tool results into the authoritative message array and re-runs fights the backend's checkpoint model, risks double-execution on reload (§7), has no natural max-turns cap, and reverses the deliberate `2026-06-08-client-tools-design` decision to reserve `interrupt()` for approvals.

---

## 2. Behavior status legend

Every behavior is tagged: **[TODAY]** implemented now · **[CHARACTERIZE]** PR 1 tests lock current behavior, no code change · **[CHANGE]** a later PR changes behavior/contract · **[FUTURE]** optional, needs its own design.

### 2a. Master table — current vs proposed

| Behavior | Status | Where |
| --- | --- | --- |
| `pending` computed signal gated on `!isLoading` + catalog name + `result===undefined` + `!resolvedIds` | **[TODAY]** | `ag-ui/client-tools.ts:63-72`, `langgraph/client-tools.ts:108-118` (identical predicate) |
| `resolve(id, result)` writes local result, appends `role:'tool'` message, **always starts one run** | **[TODAY]** | `ag-ui/client-tools.ts:74-115`, `langgraph/client-tools.ts:129-171` |
| Function tools auto-execute; coordinator calls `resolve` per tool | **[TODAY]** | `client-tool-executor.ts:17-33` |
| Each `resolve()` starts its own run → N pending function tools = **N runs** | **[TODAY]** | executor loop + per-resolve `runAgent`/`submitFn` |
| Handler throw → `Error: …` tool message; run still issued | **[TODAY]** | `execute.ts:28-33` |
| Argument validation fail → `Error: invalid arguments: …`; handler not called; run still issued | **[TODAY]** | `execute.ts:22-27` |
| In-memory dedup (`inFlight` + `resolvedIds` + `result===undefined` backstop) | **[TODAY]** | `client-tool-executor.ts:16`, adapter `resolvedIds` |
| Backend ends run on client-only tool call (`routeAfterAgent → __end__`) | **[TODAY]** | `middleware/src/langgraph/middleware.ts:90-98` |
| Characterization tests, both adapters + chat component; scriptable fake AG-UI agent | **[CHARACTERIZE]** | PR 1 (§9) |
| Extract the pure `pending` predicate into a shared chat helper | **[CHANGE — refactor]** | PR 2 (§6) |
| `settle(id, result)` optional capability method (record + buffer, no run) | **[CHANGE — contract]** | §5a |
| Batched continuation per tool-call group (N settles → 1 run) | **[CHANGE]** | §5d |
| `AbortSignal` in the function-tool handler context | **[CHANGE]** | §5b |
| Max-turns guard (default 10, configurable, surfaced) | **[CHANGE]** | §5e |
| Backend `toolCallId` idempotency guard in `@threadplane/middleware` (Postgres impl shipped) | **[CHANGE]** | §7 |
| Claim-before-execute for non-idempotent browser tools (fail-closed; `idempotent:true` opts out) | **[CHANGE]** | §7 |
| Minimal browser fail-closed marker (fallback when no server guard) | **[CHANGE]** | §7 |
| Recursive auto-continuation as an opt-in coordinator policy | **[FUTURE]** | later PR |
| Hashbrown-provider → `Agent` bridge | **[FUTURE]** | §8, M6 |

---

## 3. Where the two models actually differ

Both approaches ultimately "append a `role:'tool'` message → run again." The differences are **who drives the loop**, **whether it is protocol-visible**, and **who is authoritative over history**.

### 3a. Threadplane today — explicit, protocol-visible, server-authoritative **[TODAY]**

- **Backend** (`middleware.ts`): binds the client catalog so the model *can* call client tools, but `routeAfterAgent` routes a client-only call to `__end__` — the run ends with the tool call **unresolved and no `ToolMessage`**.
- **Adapter** (`client-tools.ts`): `pending` = `!isLoading && catalogName(tc) && tc.result===undefined && !resolvedIds.has(tc.id)`. `resolve(id, result)` marks resolved, writes the local `ToolCall` (freezes the card), appends a `role:'tool'` message, and **starts one new run**.
- **Chat coordinator**: decides *when* to resolve — the executor auto-runs `action()` tools; `view()` auto-acks; `ask()` resolves from the mounted component's value.

The multi-step loop is **emergent**; the backend stays authoritative over persisted history and checkpoints.

### 3b. The comparable recursive model — hidden, client-authoritative

Mutual recursion (`runAgent` ⇄ `processAgentResult`), no max-turns cap; scans returned messages, splices results into the authoritative array, recurses unless aborted or `followUp:false`. No backend cooperation needed. Optimized for browser-running agents where the client can be authoritative.

### 3c. The decisive difference

| Dimension | Explicit (Threadplane) | Hidden recursive |
| --- | --- | --- |
| Loop driver | Backend ends → signal → coordinator resolves → new run | Runtime recurses client-side |
| Protocol visibility | Visible: the graph genuinely pauses | Invisible: client patches history + re-runs |
| Authoritative history | **Server / checkpoints** | **Client message array** |
| Backend requirement | Must route client calls to `__end__` | None |
| Termination | Emergent (no more pending) | Implicit; no max-turns |
| Fit | Stateful enterprise agents, HITL approvals, audit | Browser agents, dumb backends |

Threadplane's target (`README.md`/`gtm.md`: "the Angular final mile" for "LangGraph/AG-UI/A2UI-backed enterprise agent workflows") is where server-authoritative, protocol-visible continuation is the correct default.

---

## 4. Answers to the five questions

**Q1 — Keep the explicit contract? → Yes.** Server-authoritative, checkpoint-safe, inspectable, composes with `interrupt()` approvals and time-travel; the advertised stability boundary (`README.md:152`); honors the `state on signals, events on events$` invariant.

**Q2 — Hidden recursive follow-up? → No, not as adapter behavior.** Fights server checkpoints, risks reload double-execution, no max-turns, reverses `2026-06-08`. Right for browser agents (the low-level layer's domain), wrong as a Threadplane-wide default.

**Q3 — Hybrid? → Yes.** Keep the protocol-visible primitive; add the recursive model's *ergonomics* as opt-in coordinator policy over an explicitly-extended contract.

**Q4 — Where? → `@threadplane/chat` coordinator** for orchestration/policy; **`@threadplane/middleware`** for the server-side idempotency guard (§7); adapters stay thin. A narrow shared helper (§6) absorbs only the pure predicate.

**Q5 — Hashbrown vs Threadplane.** Hashbrown owns provider/event/protocol primitives + browser LLM tool execution; Threadplane owns the `Agent` contract, chat UX, and continuation policy. Seam = the `Agent` contract.

---

## 5. The behavior-changing knobs, defined

All are **[CHANGE]** — none in PR 1.

### 5a. `settle()` — suppress-continuation **[CHANGE — contract]** *(decided)*

**Problem.** Both adapters' `resolve()` always call `runAgent`/`submitFn` (`ag-ui:114`, `langgraph:170`). A terminal tool (`followUp:false`) cannot avoid a continuation run without a contract change.

**Decision — a separate optional method** (`settle`), chosen over an optional flag on `resolve` so terminal-ness is explicit at the call site and a capability that doesn't implement it fails loudly rather than silently continuing:

```ts
interface ClientToolsCapability {
  setCatalog(specs: readonly ClientToolSpec[]): void;
  readonly pending: Signal<readonly ToolCall[]>;
  /** Record the result + append the ToolMessage to the group buffer AND flush
   *  the buffer in one continuation run. (Unchanged for single-tool callers.) */
  resolve(id: string, result: ClientToolResult): void;
  /** Record the result + append the ToolMessage to the group buffer, but do
   *  NOT start a run. Optional: capabilities that omit it fall back to today's
   *  behavior (the coordinator warns when it cannot honor followUp:false). */
  settle?(id: string, result: ClientToolResult): void;
}
```

**Semantics.** `settle` = record local result (freeze card) + buffer the ToolMessage; no run. `resolve` = `settle` + flush the whole buffered group in one run. For a single-tool group with an empty prior buffer, `resolve` is byte-for-byte today's behavior — so existing tests and existing consumer capabilities are unaffected. `settle` is **optional** on the interface; a capability lacking it can't suppress a run, and the coordinator emits a dev warning when a `followUp:false` tool can't be honored.

**Transport caveat (documented, narrowed).** With today's transports a tool result reaches the backend *only* by issuing a run (AG-UI's `addMessage` ships on the next `runAgent`; LangGraph's ToolMessage rides inside the `submitFn` payload). So a **fully-terminal group** (every tool `followUp:false` → all `settle`, no `resolve`) records results **client-side only**; they are not persisted to the backend thread. A **mixed group** (any tool wants follow-up) still issues one run, so the terminal tools' results *do* get persisted along the way. Fully-terminal results are made reload-safe by §7 (they won't re-execute), so this caveat is bounded.

### 5b. `AbortSignal` in the handler context **[CHANGE]**

Today `executeFunctionTool(def, tc.args)` passes args only (`execute.ts:29`); `stop()` can't cancel an in-flight client tool. Thread an `AbortSignal` (owned by the executor, aborted on `stop()`/coordinator swap/registry change) into a second handler argument — `handler(args, { signal })`. Additive. An aborted handler must **not** `resolve`/`settle` and must **not** start a continuation run.

### 5c. Durable duplicate-execution prevention **[CHANGE]** — see §7

The full model. In-memory `inFlight`/`resolvedIds` are per-instance and lost on reload; §7 defines the backend-authoritative replacement.

### 5d. Batched continuation per tool-call group **[CHANGE]** *(decided)*

**Correction to Revision 1.** Today the executor calls `resolve` per settled tool, and each `resolve` starts its own run — so **N simultaneously-pending function tools produce N runs on the same thread** (`client-tool-executor.ts:28-31`). The `2026-06-08` "batch into a single re-run" was never implemented.

**Decision — batch per assistant-turn tool-call group.** The coordinator tracks the group of client tool calls emitted by one assistant turn; as each settles it calls `settle(id, result)`; when the group is complete it calls `resolve(lastId, lastResult)` to flush all buffered ToolMessages in **one** run. This matches the LLM contract (a turn's tool calls must all be answered before the model responds) and fixes the racing-runs bug. A slow/hung handler blocks its group — which is correct; `stop()`/abort (§5b) handles the hung case. A **fully-terminal** group flushes via `settle` on every tool and issues no run.

### 5e. Max-turns guard **[CHANGE]** *(decided)*

**Decision — configurable, default 10 consecutive client-tool continuation rounds.** Legit multi-step flows are 1–3 rounds; 10 catches runaway loops without tripping real usage. When hit: stop continuing, surface a diagnostic (log + an error state on the run), never silently swallow. Lives in the coordinator policy.

---

## 6. Shared-core extraction — narrow scope **[CHANGE — refactor]**

Only the predicate is genuinely shared. Extract exactly this pure function into `@threadplane/chat`:

```ts
export function selectPendingClientToolCalls(input: {
  isLoading: boolean;
  toolCalls: readonly ToolCall[];
  catalogNames: ReadonlySet<string>;
  resolvedIds: ReadonlySet<string>;
}): readonly ToolCall[];
```

**Do not** move into chat: the `resolvedIds` *signal* (each adapter owns its own), result application (AG-UI mutates a `WritableSignal` at `ag-ui:88-98`; LangGraph layers `applyClientResult` over a read-only projection at `langgraph:147-150`), or the transport-specific append+rerun. Behavior-preserving; **PR 2**.

---

## 7. Durable duplicate-execution — backend-authoritative design **[CHANGE]**

The prior draft proposed a full client-side result **ledger**. Investigation of the enterprise persistence platform (`@cpki/source`) showed the stronger, proven pattern: a **server-authoritative Postgres event log with `(tenant_id, event_id)` `ON CONFLICT DO NOTHING` idempotency**, Redis as a non-authoritative hot cache, and reconnect rehydrating a `MESSAGES_SNAPSHOT` from Postgres. That platform built *thread persistence + event idempotency* but **not** a per-tool-call execution guard — which is exactly the missing top layer this section specifies, applying its `event_id` idempotency pattern to `toolCallId`.

### 7a. Principle: the backend is the durable authority; don't rebuild the log

LangGraph *is* a checkpointed event log; an AG-UI enterprise backend *is* that Postgres log. Threadplane must not rebuild it. Durable dedup is layered on top of it, server-side.

### 7b. The honest guarantee boundary

A server-side guard **cannot** make a browser handler's side effect exactly-once by itself — the handler runs in the browser before the server sees any result, so a guard on inbound results can't undo a duplicate charge. True exactly-once of a non-idempotent browser effect requires either (a) the handler passing its own idempotency key downstream, or (b) **claim-before-execute** (the client durably claims *before* running the handler). We therefore ship tiers, each explicit about what it guarantees and what it costs.

### 7c. Guarantee tiers

- **Tier 0 — no store (default; today's behavior).** In-memory `inFlight`/`resolvedIds` + the backend happy path: a persisted `TOOL_CALL_RESULT`, rehydrated on reload, sets `result` so `pending` never resurfaces the call. Sufficient for idempotent / non-critical tools (`view`, navigation, UI updates). No new machinery.
- **Tier 1 — server `toolCallId` idempotency guard (Postgres, shipped in M3).** When a continuation run delivers a ToolMessage for `toolCallId X`, the middleware records `(threadId, X)` with `ON CONFLICT DO NOTHING`. This makes **continuation idempotent** — a re-delivered result never double-processes downstream server logic — and provides an **authoritative "already executed" record** the client reads on reload to avoid re-surfacing `X`. Closes the happy-path and re-delivery cases exactly-once *at the server*. Does **not** by itself stop a browser re-execution in the crash window.
- **Tier 2 — claim-before-execute (for non-idempotent browser effects).** Before running a guarded handler the client durably claims `(threadId, X)='executing'` via the Tier-1 guard, runs the handler, then records the result. On reload: record `done` → skip + (optionally) re-deliver; record `executing` with no result (crash mid-handler) → **fail-closed** (surface an interrupted-error tool result); no record → run. Bounds browser re-execution to **at-most-once**. Costs one durable round trip before execution — so it applies only to tools that need it (see policy).

**Honest limit.** Even Tier 2 is at-most-once, not exactly-once, for the *downstream* effect; genuine exactly-once needs the handler to pass an idempotency key to its own service. The framework gives at-most-once (fail-closed) or effectively-once *delivery* of an already-computed result — and documents this plainly.

### 7d. Crash policy — fail-closed + per-tool idempotent opt-out *(decided)*

Default for guarded tools: on reload, an `executing` record with no result → **fail-closed** (interrupted-error result, do not re-run) — safe for non-idempotent side effects. A tool declared `idempotent: true` opts out and may re-execute (at-least-once). At-most-once by default; at-least-once when the author opts in.

### 7e. Config layering (reconciles fail-closed-default with the round-trip cost)

- **No store wired → Tier 0.** Exactly today's behavior. Default for OSS / simple apps.
- **Postgres guard wired (enterprise) → Tier 1 on.** Continuation is idempotent; reload reconciles against the guard. Within this mode, a tool is **guarded/fail-closed by default** and `idempotent: true` opts a tool out of the Tier-2 claim path (it simply re-runs, no round trip). So the pre-execution round trip is paid only for non-idempotent tools in guard-enabled apps — never for the common idempotent case, and never for apps that don't opt in.

### 7f. Where it lives, and the Postgres shipment

- **Server guard + Postgres implementation:** `@threadplane/middleware` (where `routeAfterAgent` already lives). Ship a Postgres-backed `ClientToolExecutionStore` out of the box.
- **Injectable interface:** `ClientToolExecutionStore` with an **in-memory** implementation (default, Tier 0/1 without persistence) and the **Postgres** implementation (Tier 1/2). Consumers can supply their own (e.g., an existing enterprise Postgres log).
- **Browser marker (demoted to fallback):** a minimal, fail-closed, per-`toolCallId` marker for backends that expose no server guard. Non-authoritative; smallest possible; behind the same injectable boundary. This supersedes Revision 2's "ship sessionStorage as the blessed provider" — sessionStorage is now only one possible browser-fallback impl, not the primary path.

Proposed schema (first ship: nullable `tenant_id` column, single-tenant PK; mirrors the enterprise `event_id` pattern applied to tool calls):

```sql
CREATE TABLE threadplane_client_tool_executions (
  tenant_id     text,                       -- nullable now; joins the PK later (see below)
  thread_id     text        NOT NULL,
  tool_call_id  text        NOT NULL,
  status        text        NOT NULL,       -- 'executing' | 'done' | 'failed'
  result        jsonb,                      -- serialized ClientToolResult when 'done'
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, tool_call_id)
);
-- claim:  INSERT ... ON CONFLICT (thread_id, tool_call_id) DO NOTHING RETURNING *;
--         inserted row → 'claimed'; conflict → read existing row's status/result
-- record: UPDATE ... SET status='done', result=$, updated_at=now() WHERE (thread_id, tool_call_id)=($,$)
```

**Tenant scoping (settled).** Ship the nullable `tenant_id` column from day one so the table is never rewritten. Keep the PK `(thread_id, tool_call_id)` for the first ship (single-tenant-safe because `thread_id` is globally unique). When a multi-tenant consumer needs isolation, an **additive migration** behind a config flag promotes the PK to `(tenant_id, thread_id, tool_call_id)` and threads `tenant_id` through `claim`/`record`/`lookup`. No first-ship multi-tenancy work.

Interface sketch:

```ts
export interface ClientToolExecutionStore {
  /** Atomically claim a tool-call execution. Returns the prior state if any. */
  claim(key: { threadId: string; toolCallId: string }):
    Promise<'claimed' | { status: 'executing' } | { status: 'done'; result: ClientToolResult }>;
  record(key: { threadId: string; toolCallId: string }, result: ClientToolResult): Promise<void>;
  /** Reload reconciliation: statuses/results for a thread's pending tool calls. */
  lookup(threadId: string, toolCallIds: readonly string[]):
    Promise<Record<string, { status: string; result?: ClientToolResult }>>;
}
```

---

## 8. Migration story: Hashbrown → Threadplane

Developers start on the low-level layer (browser agents, LLM-driven frontend tools) and **migrate into Threadplane** for enterprise/production chat. Additive, gated by the `Agent` contract.

1. **Provider stays** — keeps producing AG-UI events/provider primitives.
2. **Bridge to the contract** — a thin, independently-authored adapter turns the provider's events into `Agent` (mirroring `to-agent.ts`).
3. **Adopt the chat surface** — swap bespoke UI for `@threadplane/chat` compositions.
4. **Frontend tools port 1:1** — browser action tools → `action()`; render-only → `view()`; HITL → `ask()`. The coordinator policy supplies auto-execute + (opt-in) auto-continue — server-authoritative when the backend is a stateful graph, client-driven only where the provider is genuinely client-authoritative.
5. **Escalate to enterprise backends without rewriting UI** — chat consumes `Agent`, so swapping the provider requires no template changes (`README.md:152`).

**Protecting existing `@threadplane/ag-ui` / `@threadplane/langgraph` users** (hard constraint):
- Through PR 1 and PR 2: `pending()`/`resolve()`/`action()`/`view()`/`ask()` unchanged in signature and behavior.
- Later [CHANGE] PRs are additive and default-preserving: `settle?` is optional; the handler `signal` is an optional 2nd arg; the durable guard is off unless a store is wired; batching/max-turns/recursive policy are opt-in. Each carries its §5/§7 migration note.
- No package moves, no dependency additions in `@threadplane/chat`. The Postgres driver is a dependency of `@threadplane/middleware` only (a Node/backend package), never of the browser libs.

---

## 9. Risk analysis

### 9a. Risks of keeping explicit continuation (status quo)

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Requires backend cooperation (`routeAfterAgent → __end__`). | Medium | Ship + document the middleware; dev-mode warning when a catalog tool is called but the run didn't end. |
| No single place enforces max-turns or a global follow-up policy. | Medium | Coordinator policy (§5e). |
| **Ephemeral in-memory dedup** — reload can re-execute a not-yet-persisted tool. | **High** | §7 backend-authoritative guard (Tier 1/2). |
| No `AbortSignal` to handlers. | High | §5b. |
| **N pending function tools → N racing runs.** | Medium | §5d batch-per-group. |
| Duplicated `pending` predicate across adapters. | Low | §6 narrow extraction. |

### 9b. Risks of hidden recursive follow-up

| Risk | Severity | Notes |
| --- | --- | --- |
| **Client becomes orchestration-authoritative** — fights server checkpoints on stateful backends. | **Critical** | *Unverified prior context:* an internal issue where a frontend store pushing state via `threads.updateState` raced the client-tool resume loop. Mechanism is concrete; re-confirm with a live-LLM test before relying on it. |
| No max-turns cap → infinite loop. | High | *Unverified prior context:* an aimock fixture-ordering bug produced an infinite continuation loop. Any auto-loop needs §5e. |
| Opaque vs a rendered `pending` signal; tension with the no-duplication invariant. | Medium | Keep the primitive signal-shaped; make any loop an explicit policy. |
| Breaks protocol-visible semantics → wrong for HITL approvals, audit. | High | Reserve `interrupt()` for approvals. |
| Reverses the documented `2026-06-08` decision. | Medium | No justification found. |

### 9c. Why the hybrid dominates

It captures the recursive model's *ergonomics* as a chat-layer policy over the protocol-visible primitive, preserves the enterprise-correct properties (server-authoritative, inspectable, checkpoint-safe, `interrupt()`-for-approvals), and fixes real current gaps (backend-authoritative dedup, abort, racing runs) — each through a defined contract, not a silent default.

---

## 10. Milestone plan

- **M0 — Test hardening (no behavior change).** Scriptable fake AG-UI agent; characterization tests; AG-UI/LangGraph parity; chat integration for action/view/ask. → **PR 1** (§11). Gates everything else.
- **M1 — Narrow shared-core extraction.** Pure `selectPendingClientToolCalls` only (§6). → **PR 2**.
- **M2 — `AbortSignal` in the handler context** (§5b). Additive.
- **M3 — Backend-authoritative durable dedup, Tier 1, shipped with Postgres** (§7): `ClientToolExecutionStore` interface + in-memory default + **Postgres implementation** in `@threadplane/middleware`; Tier-1 server `toolCallId` idempotency guard wired into the continuation path; reload reconciliation. Nullable `tenant_id` column, single-tenant PK.
- **M3.5 — Tier-2 claim-before-execute** (§7c): the pre-execution durable claim for non-idempotent browser tools (fail-closed on crash; `idempotent:true` opts out). Split from M3 so its extra round trip is latency-validated on a real deployment before it joins the default guarded path.
- **M4 — `settle()` + batch-per-group** (§5a, §5d), with the transport caveat documented, now reload-safe via M3. Coordinator group-tracking + `settle?` in both adapters.
- **M5 — Opt-in continuation policy + max-turns guard** (§5e); typed tool-call lifecycle surfaced to view/ask; cockpit example exercising abort + terminal (`settle`) tools.
- **M6 (FUTURE).** Hashbrown-provider → `Agent` bridge (§8).

**Sequencing note:** M4 (`settle`/`followUp:false`) depends on M3 — a terminal tool whose result isn't persisted must be reload-safe, which only the durable guard provides. Do not ship `settle` before the guard.

---

## 11. First PR scope — tests and characterization only

**PR 1 = M0. No production behavior change. No contract change.**

1. Extend `libs/ag-ui/src/lib/testing/fake-agent.ts` into a scriptable stream (`TOOL_CALL_START/ARGS/END`, `RUN_ERROR`, `STATE_SNAPSHOT`, `CUSTOM`/`on_interrupt`; branch on the presence of a `ToolMessage` in history to model backend-ends → resumes → continues). Deterministic (`setTimeout` cadence, cancellable; no clocks/`Math.random`).
2. Characterization tests locking **today's** behavior across both adapters:
   - single pending → one continuation run;
   - **multiple pending → one run *per resolve*** (N runs — current behavior; do **not** assert a single batched run);
   - resolving one call does not disturb others;
   - handler throw → `Error: …` tool message + a run is still issued;
   - argument-validation fail → `Error: invalid arguments: …`, handler not called, run still issued;
   - `view` auto-ack; `ask` resolves via the render event;
   - `pending` empty while `isLoading`; server-resolved tool call skipped.
3. Chat-component integration test driving `action`/`view`/`ask` through the scriptable fake.

**Out of PR 1** (each has a defined [CHANGE] design): shared-core extraction (PR 2), `AbortSignal` (M2), durable guard + Postgres (M3), `settle`/batching (M4), recursive policy / max-turns (M5). If a reviewer wants any sooner, it lands as its own PR carrying its §5/§7 migration note.

Acceptance: new tests green on both adapters; **zero diff in runtime behavior** (characterization proves it); lint clean (`grep -cE ' error '`); no new public exports; no dependency changes.

---

## 12. Resolved decisions & remaining open items

**Resolved (Revision 3):**
1. **Suppress-continuation API** → separate optional **`settle()`** method (§5a), not a flag.
2. **Batching** → **batch per assistant-turn tool-call group** (§5d), fixing the N-racing-runs bug.
3. **Crash policy** → **fail-closed by default + per-tool `idempotent: true` opt-out** (§7d).
4. **Max-turns** → **configurable, default 10**, surfaced when hit (§5e).
5. **Durable dedup home & storage** → **backend-authoritative**; server `toolCallId` idempotency guard in `@threadplane/middleware`, **shipped with a Postgres implementation** (§7); browser marker demoted to a fallback (supersedes Revision 2's sessionStorage-first).
6. **Tier-2 timing** → **Tier 1 ships in M3; Tier 2 (claim-before-execute) splits to M3.5**, latency-validated on a real deployment before joining the default guarded path (§10).
7. **Tenant scoping** → **nullable `tenant_id` column now, single-tenant PK `(thread_id, tool_call_id)` for first ship**; `tenant_id` joins the PK later via an additive migration behind a config flag (§7f).

**Remaining open items (non-blocking, M4+):**
1. **Batching mixed-inflight edge** — confirm the group-completion signal (all client tool calls in an assistant turn have settled) is derivable from `toolCallIds` on the assistant message; verify against a real multi-tool-call stream. (M4 concern.)
2. **Hashbrown-provider bridge (M6)** — reuse `to-agent`'s reducer or a bespoke adapter? Depends on the provider's event shape; defer.
