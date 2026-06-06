# LangGraph Docs Technical Review — Findings

**Date:** 2026-06-06
**Pages audited:** 21 (getting-started ×3, guides ×9, concepts ×5, api ×4)
**Source verified against:** `libs/langgraph` (+ `libs/chat` Agent contract, `examples/chat/python`), generated `api-docs.json`
**Method:** 6 parallel read-only auditors + completeness sweep; controller re-verified every borderline finding against source (dropped 1 auditor false alarm).

## Resolution status — ✅ ALL FINDINGS FIXED (2 PRs merged)

Cutoff: P0+P1+P2 + the P3 restructure. Each fix re-verified against its cited source by an independent reviewer (all PASS).
- ✅ **PR #601 — concepts:** `value()` reclassified as LangGraph-specific (langgraph-basics + angular-signals); signal-mapping block restructured into "Agent contract" vs "LangGraph-specific"; `history()` placed under `AgentWithHistory`; `subagents()` vs `activeSubagents()` distinguished; state-management 16ms throttle documented. (A `Callout type="note"` introduced mid-fix 500'd a page — caught by the render check, corrected to `type="info"`.)
- ✅ **PR #602 — api:** `threadId` type P0 fixed; `AgentConfig` table completed to all 11 keys; `injectAgent` generics shown; `mock-stream-transport` constructor `script` documented; `LANGGRAPH_CLIENT` documented in the persistence guide.

**Guides + agent-contract were clean — no fixes needed.**

**Verified:** the `threadId` type is correct on main; no unsupported Callout type remains; all edited routes returned HTTP 200.

**Dropped (false alarm):** the `requireSync` claim — source provides `initialValue`, so the doc was already correct.

## Summary

- **P0: 1** · **P1: 2** · **P2: 6** · **P3: 2**
- **The langgraph docs are in strong shape** — all 9 **guides** pages and `agent-contract.mdx` came back clean. Findings concentrate in **concepts** (base-`Agent` vs LangGraph-specific signal conflation) and **api** (a `threadId` type error + an incomplete `AgentConfig` table).
- **Dropped (verified false alarm):** `state-management.mdx:272` "`toSignal()` with `requireSync: false`" — source uses `toSignal(obs, { initialValue })` everywhere with no `requireSync` (agent.fn.ts:307-327), so `requireSync` is effectively false; the doc is correct. (Auditor's Angular reasoning was wrong.)
- The langgraph docs use `injectAgent()`/`provideAgent()` consistently — no legacy `agent()` factory.

---

## Findings by severity

### P0 — wrong (breaks copy-paste)

| # | page:line | dim | what's wrong | source evidence | fix |
|---|---|---|---|---|---|
| 1 | `api/provide-agent.mdx:30` | accuracy | `threadId` type shown as `() => string \| undefined`; the real type is a string/null/Signal union | `libs/langgraph/src/lib/agent.provider.ts:30` → `threadId?: Signal<string \| null> \| string \| null` | Change the table row type to `Signal<string \| null> \| string \| null` — "Thread ID to connect to. Pass a Signal for reactive thread switching." |

### P1 — misleading (runs but wrong mental model)

| # | page:line | dim | what's wrong | source evidence | fix |
|---|---|---|---|---|---|
| 2 | `concepts/langgraph-basics.mdx:323` | conceptual | `agent.value()` presented among the "standard" `injectAgent()` signals; `value` is **LangGraph-specific**, not on the base `Agent` contract | `value` absent from `libs/chat/src/lib/agent/agent.ts`; present on `LangGraphAgent` at `libs/langgraph/src/lib/agent.types.ts:321` | Label `value()` (and the other LangGraph extensions) as LangGraph-specific, distinct from base-contract signals (see #10) |
| 3 | `concepts/angular-signals.mdx:73` | conceptual | `chat.value()` shown as a base `injectAgent()` signal — same conflation as #2 | same as #2 | Note `value()` is LangGraph-specific (available because `injectAgent()` returns `LangGraphAgent`), not part of the runtime-neutral `Agent` contract |

### P2 — gap

| # | page:line | dim | what's wrong | source evidence | fix |
|---|---|---|---|---|---|
| 4 | `api/provide-agent.mdx:28-36` | completeness | `AgentConfig` table documents 5 of 11 keys — omits `initialValues`, `throttle`, `toMessage`, `telemetry`, `filterSubagentMessages`, `subagentToolNames` | `agent.provider.ts:34-46` | Add the 6 missing keys with source types/descriptions |
| 5 | `concepts/state-management.mdx:29` | completeness | omits the default **16 ms throttle** on signal updates (and the `throttle` opt-out) | `agent.fn.ts:300-303` (`throttle` default 16 ms; `messages$` not throttled, :314); `agent.provider.ts:36` (`throttle?: number \| false`) | Add a sentence: state updates are throttled at ~16 ms by default to batch SSE tokens; configurable via `throttle` (`messages` is exempt for token-by-token rendering) |
| 6 | `concepts/langgraph-basics.mdx:343` | conceptual | `agent.subagents()` shown without distinguishing the base-contract `Map<string, Subagent>` from LangGraph's `activeSubagents: SubagentStreamRef[]` | `agent.types.ts:347` (`activeSubagents`) vs base `Agent.subagents` | Clarify the two: `subagents()` (contract, `Map`) vs `activeSubagents()` (LangGraph, running refs) |
| 7 | `api/mock-stream-transport.mdx:83` | completeness | constructor `script` param shown without its type/default | `mock-stream.transport.ts:36` → `constructor(script: StreamEvent[][] = [])` | Document `script?: StreamEvent[][]` (defaults to `[]`) |
| 8 | `api/inject-agent.mdx` | completeness | generics `<T, ResolvedBag>` not shown | `inject-agent.ts:16` → `injectAgent<T, ResolvedBag>(): LangGraphAgent<T, ResolvedBag>` | Add the signature with generics for advanced/typed-state usage |
| 9 | (sweep) `LANGGRAPH_CLIENT` | completeness | exported DI token with **zero** doc coverage | `libs/langgraph/src/public-api.ts` (threads-adapter) | Mention `LANGGRAPH_CLIENT` where the threads adapter / client is documented (e.g. persistence or an api note) |

### P3 — polish

| # | page:line | dim | what's wrong | source evidence | fix |
|---|---|---|---|---|---|
| 10 | `concepts/langgraph-basics.mdx:319-344` | conceptual | the signal-mapping block conflates base `Agent` signals with LangGraph extensions | base `Agent` (chat agent.ts) vs `LangGraphAgent` (agent.types.ts) | Restructure into two labeled groups: "Signals on every agent (Agent contract)" vs "LangGraph-specific signals" (subsumes #2/#3/#6) |
| 11 | `getting-started/introduction.mdx:3` | links | `/docs/choosing-an-adapter` link resolves (page route exists) but the page isn't registered in `docs-config.ts` nav | `apps/website/src/app/docs/choosing-an-adapter/page.tsx` exists; no `choosing-an-adapter` entry in `docs-config.ts` | Minor — see Structural; the link itself is not broken |

---

## Structural / won't-fix-here

- **`choosing-an-adapter` nav registration:** the page exists and the link works, but it's a standalone route not in the sidebar nav. Registering it is a site-IA decision affecting cross-library navigation broadly — out of scope for a langgraph accuracy pass; noted only.
- **`api-docs.json` `MockAgentTransport.script` `optional` flag:** the generated JSON marks the default-valued `script` param as `optional: false` — the generator default-param nuance already spawned as a follow-up during the chat review. Not hand-edited here.
- No `libs/*` source bugs identified.

## Verified NON-issue (no change)

- `state-management.mdx:272` `requireSync: false` — accurate; source provides `initialValue` (so `requireSync` is effectively false). Dropped.
- `gpt-5-mini` model name in examples — intentional example content, not a doc bug.

---

## Fix plan

Default cutoff: **P0 + P1 + P2; cheap P3** (#10 restructure is worth doing as it resolves #2/#3/#6 cleanly). Structural items flagged only.

**guides need no fixes** (all 9 clean), so Phase 2 is **2 PRs**:

- **PR-1 — concepts** (Task 9→10): #2, #3, #6, #5 (state-management), #10 (restructure).
- **PR-2 — api + getting-started** (Task 11): #1 (P0 threadId), #4 (AgentConfig table), #7 (mock-stream script), #8 (inject-agent generics), #9 (LANGGRAPH_CLIENT). #11 left as a noted structural item.
