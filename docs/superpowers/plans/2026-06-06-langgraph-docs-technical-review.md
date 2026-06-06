# LangGraph Docs Technical Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Audit the 21 langgraph documentation pages against library source, produce one severity-ranked findings report, then ship the accuracy fixes as 3 batched PRs — every snippet, import/package, API/signature, generic, behavioral claim, and link matching the implementation.

**Architecture:** Two gated phases. Phase 1 fans out six read-only section auditors (long guides/concepts split) plus a completeness sweep; the controller re-verifies borderline findings and consolidates one report. Phase 2 fixes the report's findings as 3 batched PRs (guides / concepts / api+getting-started), each finding re-verified against its cited source line. Concept pages are prose-dense — weight conceptual-correctness, not just symbol-matching.

**Tech Stack:** MDX docs (Next.js App Router), Angular library `libs/langgraph` (+ cross-source `libs/chat` Agent contract, `examples/chat/python` deploy config), `docs-config.ts` for link/nav resolution, `git diff` + source citation as the accuracy gate, dev-server/curl for render checks.

**Reference spec:** `docs/superpowers/specs/2026-06-06-langgraph-docs-technical-review-design.md`

---

## Ground-truth source map (used by every audit task)

| Audit | Pages (relative to `apps/website/content/docs/langgraph/`) | Ground-truth source |
|---|---|---|
| getting-started | `getting-started/{introduction,quickstart,installation}.mdx` | `libs/langgraph/src/public-api.ts`, `provideAgent`/`injectAgent`/`AgentConfig`; `examples/chat/python` (langgraph.json + graph) |
| guides-A | `guides/{lifecycle,streaming,subgraphs,time-travel,persistence}.mdx` | `libs/langgraph/src` — `lib/lifecycle.ts`, `lib/agent.types.ts`, `lib/transport/*`, `lib/threads/*` |
| guides-B | `guides/{deployment,memory,interrupts,testing}.mdx` | `libs/langgraph/src` — testing (`mockLangGraphAgent`, `provideFakeAgent`, `FakeStreamTransport`), threads adapter, interrupts (`Interrupt`); `examples/` for deployment manifests |
| concepts-A | `concepts/{agent-contract,langgraph-basics,angular-signals}.mdx` | `libs/langgraph/src` + `libs/chat/src/lib/agent/*` (runtime-neutral Agent contract) |
| concepts-B | `concepts/{state-management,agent-architecture}.mdx` | `libs/langgraph/src` — `lib/agent.types.ts`, state types, `BagTemplate`/`InferBag` |
| api | `api/{inject-agent,provide-agent,fetch-stream-transport,mock-stream-transport}.mdx` | `libs/langgraph/src/public-api.ts` + each module + `apps/website/content/docs/langgraph/api/api-docs.json` |

`libs/langgraph/src/public-api.ts` is authoritative. Key exports: `provideAgent`, `injectAgent`, `AgentConfig`; `AGENT_LIFECYCLE`/`AgentLifecycle`/`AgentLifecycleRegistry`; `agent.types` (`AgentOptions`, `AgentBranchTree*`, `AgentQueue*`, `LangGraphAgent`, `LangGraphMultitaskStrategy`, `LangGraphSubmitOptions`, `AgentTransport`, `CustomStreamEvent`, `StreamEvent`, `SubagentStreamRef`); `BagTemplate`/`InferBag`/`Interrupt`/`ThreadState`/`SubmitOptions`; `ResourceStatus`; `MockAgentTransport`/`FetchStreamTransport`/`FakeStreamTransport`; `mockLangGraphAgent`/`provideFakeAgent`; `extractCitations`; `createLangGraphClient`/`toAbsoluteApiUrl`; `LangGraphThreadsAdapter`/`LANGGRAPH_THREADS_CONFIG`/`LANGGRAPH_CLIENT`/`LangGraphThreadsConfig`; `refreshOnRunEnd`/`refreshOnTransition`.

## Findings severity taxonomy + row schema (used by report + fix gating)

- **P0 — wrong:** breaks copy-paste (wrong import/package, nonexistent API, wrong signature/type).
- **P1 — misleading:** runs but teaches a wrong model.
- **P2 — gap:** undocumented export, missing option, thin coverage.
- **P3 — polish:** stale wording, inconsistent naming, dead link.

Finding row (every finding MUST use this):
`page:line · dimension · severity · what's-wrong · source-evidence(libs/…:line) · proposed-fix`
Dimensions: `accuracy` | `conceptual` | `links` | `completeness`.

---

# PHASE 1 — AUDIT (read-only, parallel)

> Phase 1 produces NO docs edits. The controller dispatches Tasks 1–6 concurrently (disjoint reads), runs Task 7, re-verifies borderline findings, then writes the report in Task 8.

## Tasks 1–6: Section audit subagents

Each task dispatches ONE read-only audit subagent (use `subagent_type: Explore`). The prompt template is identical except for **section name**, **page list**, and **ground-truth source** (from the map above).

**Shared subagent prompt template:**

```
You are a READ-ONLY technical-docs auditor. DO NOT edit, write, or commit any file. You only read and return findings.

Repo root: /Users/blove/repos/angular-agent-framework. Branch: claude/langgraph-docs-technical-review.

## Your section: <SECTION>
## Pages to audit (read each in full):
<ABSOLUTE PAGE PATHS>
## Ground-truth source (read what you need to verify claims):
<SOURCE PATHS>

## Method
For every code fence, inline `code`, prose claim, and internal link in your pages, verify it against the ground-truth source. Open the source files and confirm: import paths/packages, exported symbol names, function/class signatures, generic params (e.g. BagTemplate/InferBag/typed state), option/property keys, transport class names, types, and documented BEHAVIOR. For internal links (href="/docs/..."), confirm the target exists in apps/website/src/lib/docs-config.ts (built from product/section/slug — check the entry exists; do not grep literal href strings). For CONCEPT pages especially: weight conceptual correctness — verify that prose claims about how state, signals, the agent contract, interrupts, time-travel, subgraphs, persistence/memory, and streaming behave match the implementation, not just that symbol names exist.

## The four dimensions
1. accuracy — import/package, symbol, signature, generic, option key, type matches source EXACTLY. Wrong package or nonexistent symbol = P0.
2. conceptual — behavior claims match implementation; runs-but-wrong-model = P1.
3. links — internal links resolve via docs-config.ts; examples internally coherent (imports cover symbols used; providers present) and runnable.
4. completeness — flag any obviously missing option/behavior a reader needs.

## Severity
P0 wrong (breaks copy-paste) | P1 misleading | P2 gap | P3 polish.

## Return format — a markdown table, columns EXACTLY:
| page:line | dimension | severity | what's wrong | source evidence | proposed fix |
- page:line = relative path + line, e.g. langgraph/guides/interrupts.mdx:42
- source evidence = libs/…:line you verified against
- proposed fix = the concrete corrected text/snippet (specific enough to apply)
If a page is clean: | <page> | — | clean | no issues found | <source checked> | none |
Every finding MUST cite a real source line. If a documented symbol can't be found in source, that's a P0 ("documented symbol not found in source"). End with a short "Systemic notes" paragraph for any cross-page pattern.

Your entire final message IS the audit result (table + systemic notes). Return only that.
```

- [ ] **Task 1 — getting-started.** Pages: `getting-started/{introduction,quickstart,installation}.mdx`. Source: `libs/langgraph/src/public-api.ts`, `provideAgent`/`injectAgent`/`AgentConfig`, `examples/chat/python` (langgraph.json + graph). Dispatch; save table for Task 8.

- [ ] **Task 2 — guides-A.** Pages: `guides/{lifecycle,streaming,subgraphs,time-travel,persistence}.mdx`. Source: `libs/langgraph/src` (lifecycle.ts, agent.types.ts, transport/*, threads/*). Dispatch; save table.

- [ ] **Task 3 — guides-B.** Pages: `guides/{deployment,memory,interrupts,testing}.mdx`. Source: `libs/langgraph/src` (testing helpers, threads adapter, Interrupt type) + `examples/` for deployment. Dispatch; save table.

- [ ] **Task 4 — concepts-A.** Pages: `concepts/{agent-contract,langgraph-basics,angular-signals}.mdx`. Source: `libs/langgraph/src` + `libs/chat/src/lib/agent/*` (Agent contract). Weight conceptual correctness. Dispatch; save table.

- [ ] **Task 5 — concepts-B.** Pages: `concepts/{state-management,agent-architecture}.mdx`. Source: `libs/langgraph/src` (agent.types.ts, state, BagTemplate/InferBag). Weight conceptual correctness. Dispatch; save table.

- [ ] **Task 6 — api.** Pages: `api/{inject-agent,provide-agent,fetch-stream-transport,mock-stream-transport}.mdx`. Source: `libs/langgraph/src/public-api.ts` + each module + `apps/website/content/docs/langgraph/api/api-docs.json`. Verify each documented signature/option against BOTH source and api-docs.json; flag drift (note which is right per `libs/langgraph/src`). Dispatch; save table.

## Task 7: Completeness sweep (exports-vs-docs)

**Files:** none (analysis). Run inline or as one subagent.

- [ ] **Step 1: List langgraph public exports**

```bash
cd /Users/blove/repos/angular-agent-framework
grep -E "^\s*(export|[A-Za-z])" libs/langgraph/src/public-api.ts | grep -oE "provide[A-Za-z]+|inject[A-Za-z]+|[A-Za-z]+Transport|[A-Za-z]+Adapter|mock[A-Za-z]+|refresh[A-Za-z]+|extractCitations|createLangGraphClient|LANGGRAPH_[A-Z_]+|AGENT_LIFECYCLE" | sort -u
```

- [ ] **Step 2: Cross-check each notable export against the docs**

```bash
cd /Users/blove/repos/angular-agent-framework
for sym in provideAgent injectAgent FetchStreamTransport MockAgentTransport FakeStreamTransport mockLangGraphAgent provideFakeAgent extractCitations createLangGraphClient toAbsoluteApiUrl LangGraphThreadsAdapter LANGGRAPH_THREADS_CONFIG LANGGRAPH_CLIENT refreshOnRunEnd refreshOnTransition AGENT_LIFECYCLE AgentLifecycleRegistry ResourceStatus; do
  c=$(grep -rl "\b$sym\b" apps/website/content/docs/langgraph 2>/dev/null | wc -l | tr -d ' ')
  echo "$c  $sym"
done | sort -n
```
Any notable export with count `0` is a **P2 completeness gap** (exported but undocumented). Record each.

- [ ] **Step 3: Reverse check.** From the Task 1–6 tables, collect every API the docs claim is exported from `@threadplane/langgraph`; confirm each appears in `libs/langgraph/src/public-api.ts`. Any that doesn't = **P0**. Record findings.

## Task 8: Consolidate the findings report

**Files:** Create `docs/superpowers/specs/2026-06-06-langgraph-docs-review-findings.md`

- [ ] **Step 1: Re-verify borderline findings.** Spot-check a sample of cited source lines; re-verify any finding that looks surprising or contradicts another (prior reviews caught false alarms this way). Drop or correct unverified findings.

- [ ] **Step 2: Assemble the report**

Structure:
```markdown
# LangGraph Docs Technical Review — Findings

**Date:** 2026-06-06
**Pages audited:** 21  **Source verified against:** libs/langgraph (+ chat Agent contract, python examples)

## Summary
- P0: <n>  P1: <n>  P2: <n>  P3: <n>
- Systemic issues: <bullets>

## Findings by severity
### P0 — wrong
<merged rows from all sections, sorted by page>
### P1 — misleading
### P2 — gap
### P3 — polish

## Structural / won't-fix-here
- <any libs/* source bug noticed — flagged for separate follow-up, NOT fixed here>
- api-docs.json generator nuances (already tracked as follow-ups from render/chat reviews)

## Fix plan (3 PRs)
- PR-1 guides: <findings>
- PR-2 concepts: <findings>
- PR-3 api + getting-started: <findings>
P-level cutoff: default P0+P1+P2, P3 where it's a one-line change. Structural + source items listed, not actioned.
```
Merge the section tables verbatim into the severity buckets; keep every source citation.

- [ ] **Step 3: Commit the report**

```bash
cd /Users/blove/repos/angular-agent-framework
git add docs/superpowers/specs/2026-06-06-langgraph-docs-review-findings.md
git commit -m "docs(langgraph): technical review findings report"
```

- [ ] **Step 4: CHECKPOINT — surface the report to the user.** Present summary counts + systemic issues + the 3-PR fix plan. Confirm the P-level cutoff and that structural/source items stay flagged-only, before starting Phase 2.

---

# PHASE 2 — FIX (subagent-driven, 3 batched PRs)

> Each PR is its own branch off the latest `origin/main`. Within a PR, fix grouped by section; each group's edits gated by re-verification against the cited source line + an independent accuracy review before commit. Use the Task 8 report as the source of truth for what to change.

**Shared fix-gate (run after each section's edits, before commit):**

```bash
cd /Users/blove/repos/angular-agent-framework
# $FILES = edited .mdx paths for this section
git --no-pager diff $FILES   # eyeball: each change matches a report finding's proposed fix; no unrelated heading/link/component churn
```
Then an independent accuracy-reviewer subagent confirms each edit matches its cited source line and no finding was missed/over-applied; loop until clean.

## Task 9: PR-1 — guides (9 pages)

**Branch:** `claude/fix-langgraph-docs-guides` off `origin/main`.
**Files:** the guide pages with findings (per report).

- [ ] **Step 1:** Create the branch off latest `origin/main`.
- [ ] **Step 2:** Dispatch implementer subagent(s) with the report's guide findings (full rows, grouped — e.g. guides-A then guides-B). Apply each proposed fix EXACTLY; re-read the cited source line before each edit; do NOT touch anything not in a finding.
- [ ] **Step 3:** Shared fix-gate on edited files.
- [ ] **Step 4:** Independent accuracy reviewer subagent; loop until clean.
- [ ] **Step 5:** Render check — edited guide routes return 200 (serve website on :3000; curl each `/docs/langgraph/guides/<slug>`).
- [ ] **Step 6:** Commit (`docs(langgraph): fix guides technical accuracy`), push, open PR, enable auto-merge (squash).

## Task 10: PR-2 — concepts (5 pages)

**Branch:** `claude/fix-langgraph-docs-concepts` off `origin/main` (create after PR-1 is up; update-branch if main moves).
**Files:** the concept pages with findings (per report).

- [ ] **Step 1:** Create the branch off latest `origin/main`.
- [ ] **Step 2:** Dispatch implementer with the concepts findings; apply proposed fixes exactly; re-verify each against `libs/langgraph/src` (and `libs/chat` Agent contract) cited lines. These pages are prose-dense — preserve correct prose; fix only flagged claims/snippets.
- [ ] **Step 3:** Shared fix-gate.
- [ ] **Step 4:** Independent accuracy reviewer; loop until clean.
- [ ] **Step 5:** Render check — edited concept routes return 200.
- [ ] **Step 6:** Commit (`docs(langgraph): fix concepts technical accuracy`), push, open PR, enable auto-merge.

## Task 11: PR-3 — api + getting-started (7 pages)

**Branch:** `claude/fix-langgraph-docs-api-gs` off `origin/main`.
**Files:** the api + getting-started pages with findings (per report).

- [ ] **Step 1:** Create the branch off latest `origin/main`.
- [ ] **Step 2:** Dispatch implementer with the api+getting-started findings; verify each signature/option against `libs/langgraph/src/public-api.ts` + named modules. If a finding is "doc drifted from generated api-docs.json", fix the doc prose to match source; do NOT hand-edit generated api-docs.json (generator nuances are tracked separately).
- [ ] **Step 3:** Shared fix-gate.
- [ ] **Step 4:** Independent accuracy reviewer; loop until clean.
- [ ] **Step 5:** Render check — edited api/getting-started routes return 200.
- [ ] **Step 6:** Commit (`docs(langgraph): fix api + getting-started technical accuracy`), push, open PR, enable auto-merge.

## Task 12: Final verification + land planning artifacts

**Files:** none (verification) + the findings report + spec/plan.

- [ ] **Step 1: All 21 langgraph routes return 200** (serve website on :3000; curl each page under getting-started/guides/concepts/api).
- [ ] **Step 2:** Mark each fixed finding ✅ in `2026-06-06-langgraph-docs-review-findings.md`; leave structural/source items open.
- [ ] **Step 3:** Land the planning artifacts (spec + plan + resolved findings report) to main via a small doc-only PR from `claude/langgraph-docs-technical-review` (rebased on main), enable auto-merge.
- [ ] **Step 4: Spawn follow-ups** for any real `libs/*` source bug the report flagged (do not fix here).
- [ ] **Step 5:** Confirm all PRs merged (monitor; `gh pr update-branch` any that go BEHIND); sync local main; delete merged branches.

---

## Manual verification (before each merge)
- [ ] Every fix traces to a report finding with a source citation; no edit lacks a finding.
- [ ] The PR's langgraph routes render; internal links resolve; no documented API attributed to the wrong package.
- [ ] Findings report committed; structural + source items listed, not actioned.

## Self-Review (completed during planning)

- **Spec coverage:** 21 pages across 4 sections audited (Tasks 1–6, guides split A/B, concepts split A/B) ✓; four dimensions in every audit prompt, with conceptual-correctness weighting for concept pages ✓; completeness sweep (Task 7) ✓; controller re-verification (Task 8 Step 1) ✓; one severity-ranked report at the spec'd path (Task 8) ✓; triage checkpoint (Task 8 Step 4) ✓; 3 batched fix PRs grouped by section with source-cited reviews + render checks (Tasks 9–11) ✓; final verification + planning-artifact landing + follow-ups (Task 12) ✓; out-of-scope (other libs' docs, source changes, api-docs.json generator, restructuring) honored.
- **Placeholder scan:** No TBD/TODO. Phase 2 fix snippets are intentionally report-driven (the audit produces the exact corrected text — inherent to a review whose fixes aren't known until discovery); the gates (source re-verification, fix-gate diff, reviewer loop, render 200) make each edit checkable. Commands have expected output.
- **Consistency:** the ground-truth map, severity taxonomy, and row schema are defined once and referenced by every task; the section page lists in Tasks 1–6 match the spec (3+5+4+3+2+4 = 21); the 3-PR grouping in Tasks 9–11 matches the report's fix-plan and the spec's Phase 2; `claude/langgraph-docs-technical-review` is the audit/report + planning-artifact branch, with separate fix branches per PR off `origin/main`.
