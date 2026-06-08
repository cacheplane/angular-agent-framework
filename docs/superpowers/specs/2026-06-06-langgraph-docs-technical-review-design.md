# LangGraph Docs Technical Review — Design

**Date:** 2026-06-06
**Status:** Draft for review
**Scope:** A full technical-accuracy review of the langgraph documentation (21 pages, ~6,800 lines — the largest doc set), cross-referenced against library source, producing one severity-ranked findings report and shipping fixes as batched PRs. Reuses the methodology proven on the render (#590) and chat (#594–597) reviews.

## Goal

Make the langgraph docs technically correct: every code snippet, import/package,
API name and signature, generic parameter, behavioral claim, and internal link
matches the implementation. Catch documented-but-nonexistent APIs and
exported-but-undocumented ones. Discovery is separated from fixing so findings
are triaged before any edit lands.

This is a **docs accuracy** review. It does not change `libs/*` source and does
not restructure the docs.

## Surface under review (21 pages)

`apps/website/content/docs/langgraph/` — ~6,822 lines across 4 sections (all in scope).

- **getting-started** (3): `introduction.mdx`, `quickstart.mdx`, `installation.mdx`.
- **guides** (9): `lifecycle`, `streaming`, `subgraphs`, `time-travel`, `persistence`, `deployment`, `memory`, `interrupts`, `testing`.
- **concepts** (5): `agent-contract`, `langgraph-basics`, `angular-signals`, `state-management`, `agent-architecture`.
- **api** (4): `inject-agent`, `provide-agent`, `fetch-stream-transport`, `mock-stream-transport`.

Note: the langgraph docs use `injectAgent()` consistently (no legacy `agent()` factory) — the systemic bug found in the chat docs is absent here.

## Ground-truth sources

`libs/langgraph/src` is authoritative. The public surface (`libs/langgraph/src/public-api.ts`) includes:
`provideAgent`, `injectAgent`, `AgentConfig`; lifecycle (`AGENT_LIFECYCLE`, `AgentLifecycle`, `AgentLifecycleRegistry`); `agent.types` (`AgentOptions`, `AgentBranchTree*`, `AgentQueue*`, `LangGraphAgent`, `LangGraphMultitaskStrategy`, `LangGraphSubmitOptions`, `AgentTransport`, `CustomStreamEvent`, `StreamEvent`, `SubagentStreamRef`); `BagTemplate`, `InferBag`, `Interrupt`, `ThreadState`, `SubmitOptions`; `ResourceStatus`; transports (`MockAgentTransport`, `FetchStreamTransport`, `FakeStreamTransport`); testing (`mockLangGraphAgent`, `provideFakeAgent`); `extractCitations`; `createLangGraphClient`, `toAbsoluteApiUrl`; threads (`LangGraphThreadsAdapter`, `LANGGRAPH_THREADS_CONFIG`, `LANGGRAPH_CLIENT`, `LangGraphThreadsConfig`); `refreshOnRunEnd`, `refreshOnTransition`.

Cross-lib / cross-source references to verify against the owning source:

| Section | Pages | Ground-truth source |
|---|---|---|
| getting-started | 3 | `libs/langgraph/src` + `examples/chat/python` (langgraph.json / graph for the quickstart deploy config) |
| guides-A | lifecycle, streaming, subgraphs, time-travel, persistence | `libs/langgraph/src` (agent.types, lifecycle, transports, threads) |
| guides-B | deployment, memory, interrupts, testing | `libs/langgraph/src` (testing helpers `mockLangGraphAgent`/`provideFakeAgent`/`FakeStreamTransport`, threads adapter) + `examples/` for deployment manifests |
| concepts-A | agent-contract, langgraph-basics, angular-signals | `libs/langgraph/src` + `libs/chat` (the runtime-neutral Agent contract) |
| concepts-B | state-management, agent-architecture | `libs/langgraph/src` (agent.types, state, `BagTemplate`/`InferBag`) |
| api | inject-agent, provide-agent, fetch-stream-transport, mock-stream-transport | `libs/langgraph/src/public-api.ts` + each module + `apps/website/content/docs/langgraph/api/api-docs.json` |

## Methodology — two gated phases

### Phase 1 — Audit (read-only, parallel)

Six section audit subagents run concurrently (disjoint reads, no conflict),
splitting the long guides/concepts so no auditor is overloaded. Each is read-only
and returns findings as rows:
`page:line · dimension · severity · what's-wrong · source-evidence(libs/…:line) · proposed-fix`.

Then a **completeness sweep**: diff `libs/langgraph/src/public-api.ts` exports
against what the docs document — flag material exported-but-undocumented symbols
and documented-but-nonexistent ones (the surface is large; flag notable gaps, not
every internal symbol).

The controller re-verifies borderline/surprising findings against source (both
prior reviews caught auditor false alarms this way), consolidates one
severity-ranked report, flags systemic issues, and **pauses at a triage
checkpoint** before Phase 2.

### Phase 2 — Fix (subagent-driven, batched PRs)

After triage, fixes ship as **3 PRs**, each its own branch off the latest main:

- **PR-1 — guides** (9 pages).
- **PR-2 — concepts** (5 pages).
- **PR-3 — api + getting-started** (7 pages).

Within each PR, fixes are grouped by section; each group's implementer re-verifies
every changed snippet against the cited source line, re-checks internal links
against `docs-config.ts`, and an independent accuracy reviewer confirms each fix
matches source before commit. Each PR ends with a render-200 check on its pages.

## The four audit dimensions

1. **Code-snippet accuracy** — import/package, exported symbol, signature,
   generic (`BagTemplate`/`InferBag`/typed state), option keys, transport class
   names, and types match source exactly. Wrong package or nonexistent symbol = P0.
2. **Conceptual correctness** — the heaviest dimension here: prose claims about
   state management, agent architecture, Angular Signals integration, the agent
   contract, interrupts, time-travel, subgraphs, persistence/memory, and streaming
   must match the implementation. Runs-but-wrong-model = P1. Concepts-A/B auditors
   weight this dimension heavily (these pages are prose-dense).
3. **Links + runnability** — internal links resolve via `docs-config.ts`; each
   example is internally coherent (imports cover symbols used; providers present)
   and would compile/run as written.
4. **Completeness/gaps** — exported-but-undocumented APIs, documented-but-nonexistent
   APIs, missing options/behaviors, thin coverage.

## Findings report format

One report: `docs/superpowers/specs/2026-06-06-langgraph-docs-review-findings.md`.

Severity taxonomy (same as prior reviews):
- **P0 — wrong:** breaks copy-paste (wrong import/package, nonexistent API, wrong signature/type).
- **P1 — misleading:** runs but teaches a wrong mental model.
- **P2 — gap:** undocumented export, missing option, thin coverage.
- **P3 — polish:** stale wording, inconsistent naming, dead link.

Each row carries a source citation. The report ends with a "Structural /
won't-fix-here" section (e.g. any `libs/*` source bug, api-docs.json generator
nuances already tracked) and a "Fix plan" grouping findings into the 3 PRs with a
P-level cutoff.

## Testing & verification

- **Phase 1:** every finding carries a concrete source citation; the controller
  spot-checks a sample + re-verifies any borderline finding before trusting it.
- **Phase 2 per PR:** each changed snippet re-verified against its cited source
  line; internal links re-checked against `docs-config.ts`; edited pages return
  HTTP 200; an independent accuracy reviewer signs off per section group.
- **Final per PR:** the PR's langgraph routes return 200; no documented API
  attributed to the wrong package.

## Out of scope

- Voice/prose-register edits (already shipped) — except where a P0/P1 fix rewrites a sentence.
- `libs/*` **source** changes — real code bugs get flagged for separate follow-ups.
- Net-new pages/examples beyond filling documented gaps the report identifies.
- Other libraries' docs; relocating/restructuring langgraph pages.
- `api-docs.json` generator nuances (already spawned as separate follow-ups during the render/chat reviews).

## Self-review notes

- **Placeholder scan:** none — every section names concrete files/sources.
- **Internal consistency:** the 6-auditor split matches the ground-truth table;
  the 3-PR batching matches Phase 2 and the report's fix-plan; concepts weighting
  toward conceptual-correctness is stated in both the methodology and dimension 2.
- **Scope:** one product's docs; large but coherent — one audit/report, batched
  fixes with a triage gate. Decomposition (6 auditors, 3 PRs) handles the size.
- **Ambiguity:** "audit + fix in PR(s)" = one findings report committed, then
  corrections shipped as 3 batched PRs; cross-source references (python examples,
  chat Agent contract) verified against the owning source, those surfaces' own
  docs stay out of scope.
