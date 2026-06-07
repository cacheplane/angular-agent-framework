# AG-UI Docs Technical Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Audit the 10 ag-ui documentation pages against library source, produce one severity-ranked findings report, then ship the accuracy fixes (1 PR; split only if large) — every snippet, import/package, API/signature, behavioral claim, and link matching the implementation, with the event-mapping reference as the priority target.

**Architecture:** Two gated phases. Phase 1 fans out three read-only section auditors plus a completeness sweep; the controller re-verifies borderline findings and consolidates one report. Phase 2 fixes the report's findings in a single PR (split if large), each finding re-verified against its cited source line. The `event-mapping.mdx` reference maps AG-UI protocol events to neutral `Agent` signals and must match `to-agent.ts`.

**Tech Stack:** MDX docs (Next.js App Router), Angular library `libs/ag-ui` (+ cross-source `libs/chat` Agent contract, AG-UI protocol event types), `docs-config.ts` for link/nav resolution, `git diff` + source citation as the accuracy gate, dev-server/curl for render checks.

**Reference spec:** `docs/superpowers/specs/2026-06-06-ag-ui-docs-technical-review-design.md`

---

## Ground-truth source map (used by every audit task)

| Audit | Pages (relative to `apps/website/content/docs/ag-ui/`) | Ground-truth source |
|---|---|---|
| getting-started | `getting-started/{introduction,quickstart,installation}.mdx` | `libs/ag-ui/src/public-api.ts`, `lib/provide-agent.ts` (`provideAgent`/`injectAgent`/`AgentConfig`), `lib/to-agent.ts` |
| guides | `guides/{testing,fake-agent,citations,troubleshooting,interrupts}.mdx` | `libs/ag-ui/src` — `lib/testing/fake-agent.ts` (`FakeAgent`), `lib/testing/provide-fake-agent.ts`, `lib/bridge-citations-state.ts`, `lib/to-agent.ts` + `libs/chat/src/lib/agent/*` (Agent contract) |
| concepts + reference | `concepts/architecture.mdx`, `reference/event-mapping.mdx` | `libs/ag-ui/src/lib/to-agent.ts` (AG-UI-event → neutral-`Agent` translation) + the AG-UI protocol event types it consumes |

`libs/ag-ui/src/public-api.ts` is authoritative. Exports (8): `toAgent`, `ToAgentOptions`, `provideAgent`, `injectAgent`, `AgentConfig`, `FakeAgent`, `provideFakeAgent`, `bridgeCitationsState`.

## Findings severity taxonomy + row schema

- **P0 — wrong:** breaks copy-paste (wrong import/package, nonexistent API, wrong signature/type).
- **P1 — misleading:** runs but teaches a wrong model.
- **P2 — gap:** undocumented export, missing option, thin coverage.
- **P3 — polish:** stale wording, inconsistent naming, dead link.

Finding row: `page:line · dimension · severity · what's-wrong · source-evidence(libs/…:line) · proposed-fix`.
Dimensions: `accuracy` | `conceptual` | `links` | `completeness`.

---

# PHASE 1 — AUDIT (read-only, parallel)

> Phase 1 produces NO docs edits. The controller dispatches Tasks 1–3 concurrently (disjoint reads), runs Task 4, re-verifies borderline findings, then writes the report in Task 5.

## Tasks 1–3: Section audit subagents

Each task dispatches ONE read-only audit subagent (use `subagent_type: Explore`). The prompt template is identical except for **section name**, **page list**, and **ground-truth source**.

**Shared subagent prompt template:**

```
You are a READ-ONLY technical-docs auditor. DO NOT edit, write, or commit any file. You only read and return findings.

Repo root: /Users/blove/repos/angular-agent-framework. Branch: claude/ag-ui-docs-technical-review.

## Your section: <SECTION>
## Pages to audit (read each in full):
<ABSOLUTE PAGE PATHS>
## Ground-truth source (read what you need to verify claims):
<SOURCE PATHS>

## Method
For every code fence, inline `code`, prose claim, and internal link in your pages, verify it against the ground-truth source. Open the source files and confirm: import paths/packages, exported symbol names, function/class signatures, option/property keys (AgentConfig, ToAgentOptions, FakeAgent config), types, and documented BEHAVIOR. For the event-mapping reference especially: confirm every AG-UI-event → Agent-signal row matches how `to-agent.ts` actually translates events; flag wrong/missing/renamed events. For internal links (href="/docs/..."), confirm the target exists in apps/website/src/lib/docs-config.ts (built from product/section/slug — check the entry exists; do not grep literal href strings).

## The four dimensions
1. accuracy — import/package, symbol, signature, option key, type matches source EXACTLY. Wrong package or nonexistent symbol = P0.
2. conceptual — behavior claims match implementation; runs-but-wrong-model = P1.
3. links — internal links resolve via docs-config.ts; examples internally coherent + runnable.
4. completeness — flag any obviously missing option/behavior/event a reader needs.

## Severity
P0 wrong (breaks copy-paste) | P1 misleading | P2 gap | P3 polish.

## Return format — a markdown table, columns EXACTLY:
| page:line | dimension | severity | what's wrong | source evidence | proposed fix |
- page:line = relative path + line, e.g. ag-ui/reference/event-mapping.mdx:42
- source evidence = libs/…:line you verified against
- proposed fix = the concrete corrected text/snippet (specific enough to apply)
If a page is clean: | <page> | — | clean | no issues found | <source checked> | none |
Every finding MUST cite a real source line. If a documented symbol can't be found in source, that's a P0. End with a short "Systemic notes" paragraph for any cross-page pattern.

Your entire final message IS the audit result (table + systemic notes). Return only that.
```

- [ ] **Task 1 — getting-started.** Pages: `getting-started/{introduction,quickstart,installation}.mdx`. Source: `libs/ag-ui/src/public-api.ts`, `lib/provide-agent.ts`, `lib/to-agent.ts`. Dispatch; save table for Task 5.

- [ ] **Task 2 — guides.** Pages: `guides/{testing,fake-agent,citations,troubleshooting,interrupts}.mdx`. Source: `libs/ag-ui/src/lib/testing/fake-agent.ts`, `lib/testing/provide-fake-agent.ts`, `lib/bridge-citations-state.ts`, `lib/to-agent.ts` + `libs/chat/src/lib/agent/*`. Dispatch; save table.

- [ ] **Task 3 — concepts + reference.** Pages: `concepts/architecture.mdx`, `reference/event-mapping.mdx`. Source: `libs/ag-ui/src/lib/to-agent.ts` (+ the AG-UI event types it consumes). The event-mapping table is the priority — verify every event→signal row against `to-agent.ts`. Weight conceptual correctness for architecture. Dispatch; save table.

## Task 4: Completeness sweep + langgraph-ref check

**Files:** none (analysis).

- [ ] **Step 1: Exports vs docs**

```bash
cd /Users/blove/repos/angular-agent-framework
for sym in toAgent ToAgentOptions provideAgent injectAgent AgentConfig FakeAgent provideFakeAgent bridgeCitationsState; do
  c=$(grep -rl "\b$sym\b" apps/website/content/docs/ag-ui 2>/dev/null | wc -l | tr -d ' ')
  echo "$c  $sym"
done | sort -n
```
Any export with count `0` is a **P2 completeness gap**. Record it.

- [ ] **Step 2: Reverse check.** From the Task 1–3 tables, confirm every API the docs claim is exported from `@threadplane/ag-ui` appears in `libs/ag-ui/src/public-api.ts`. Any that doesn't = **P0**.

- [ ] **Step 3: Verify the langgraph reference.**

```bash
cd /Users/blove/repos/angular-agent-framework
grep -rn "@threadplane/langgraph" apps/website/content/docs/ag-ui
```
Confirm the single `@threadplane/langgraph` reference is a legitimate cross-adapter comparison (verify any symbol it names against `libs/langgraph/src/public-api.ts`); if it cites a nonexistent langgraph symbol, that's a finding.

## Task 5: Consolidate the findings report

**Files:** Create `docs/superpowers/specs/2026-06-06-ag-ui-docs-review-findings.md`

- [ ] **Step 1: Re-verify borderline findings** against source; drop/correct unverified ones (prior reviews caught false alarms this way).

- [ ] **Step 2: Assemble the report**

```markdown
# AG-UI Docs Technical Review — Findings

**Date:** 2026-06-06
**Pages audited:** 10  **Source verified against:** libs/ag-ui (+ chat Agent contract, AG-UI event types)

## Summary
- P0: <n>  P1: <n>  P2: <n>  P3: <n>
- Systemic issues: <bullets>

## Findings by severity
### P0 — wrong
### P1 — misleading
### P2 — gap
### P3 — polish

## Structural / won't-fix-here
- <any libs/* source bug — flagged for separate follow-up, NOT fixed here>
- api-docs.json generator nuances (already tracked)

## Fix plan
- Single PR (split only if large). P-level cutoff: default P0+P1+P2, P3 where it's a one-line change. Structural + source items listed, not actioned.
```
Merge the section tables verbatim into the severity buckets; keep every source citation.

- [ ] **Step 3: Commit the report**

```bash
cd /Users/blove/repos/angular-agent-framework
git add docs/superpowers/specs/2026-06-06-ag-ui-docs-review-findings.md
git commit -m "docs(ag-ui): technical review findings report"
```

- [ ] **Step 4: CHECKPOINT — surface the report to the user.** Present summary counts + systemic issues + the fix plan. Confirm the P-level cutoff and that structural/source items stay flagged-only, before Phase 2.

---

# PHASE 2 — FIX (subagent-driven)

> Single fix PR off the latest `origin/main` (split into 2 only if the finding count is large). Fix grouped by section; each group's edits gated by re-verification against the cited source line + an independent accuracy review before commit. Use the Task 5 report as the source of truth.

## Task 6: Fix PR

**Branch:** `claude/fix-ag-ui-docs` off `origin/main`.
**Files:** the ag-ui pages with findings (per report).

- [ ] **Step 1:** Create the branch off latest `origin/main`.
- [ ] **Step 2:** Dispatch implementer subagent(s) with the report's findings (full rows, grouped by section). Apply each proposed fix EXACTLY; re-read the cited source line before each edit; do NOT touch anything not in a finding. For MDX components, use only SUPPORTED `Callout` types (`tip`/`info`/`warning`/`danger` — NOT `note`).
- [ ] **Step 3:** Fix-gate — `git --no-pager diff <files>`; eyeball that each change matches a report finding and there's no unrelated heading/link/component churn.
- [ ] **Step 4:** Independent accuracy reviewer subagent; loop until clean.
- [ ] **Step 5:** Render check — edited ag-ui routes return 200 (serve website on :3000; curl each `/docs/ag-ui/<section>/<slug>`).
- [ ] **Step 6:** Commit (`docs(ag-ui): fix technical accuracy issues`), push, open PR, enable auto-merge (squash).

## Task 7: Final verification + land planning artifacts

**Files:** none (verification) + the findings report + spec/plan.

- [ ] **Step 1: All 10 ag-ui routes return 200** (serve website on :3000; curl each page).
- [ ] **Step 2:** Mark each fixed finding ✅ in `2026-06-06-ag-ui-docs-review-findings.md`; leave structural/source items open.
- [ ] **Step 3:** Land the planning artifacts (spec + plan + resolved findings report) to main via a small doc-only PR from `claude/ag-ui-docs-technical-review` (rebased on main), enable auto-merge.
- [ ] **Step 4: Spawn follow-ups** for any real `libs/*` source bug the report flagged.
- [ ] **Step 5:** Confirm PRs merged (monitor; `gh pr update-branch` any that go BEHIND); sync local main; delete merged branches.

---

## Manual verification (before merge)
- [ ] Every fix traces to a report finding with a source citation; no edit lacks a finding.
- [ ] The edited ag-ui routes render; internal links resolve; no documented API attributed to the wrong package; only supported Callout types used.
- [ ] Findings report committed; structural + source items listed, not actioned.

## Self-Review (completed during planning)

- **Spec coverage:** 10 pages across 4 sections audited (Tasks 1–3) ✓; four dimensions in every audit prompt, with event-mapping as the priority + architecture conceptual weighting ✓; completeness sweep + langgraph-ref check (Task 4) ✓; controller re-verification (Task 5 Step 1) ✓; one severity-ranked report at the spec'd path (Task 5) ✓; triage checkpoint (Task 5 Step 4) ✓; single fix PR grouped by section with source-cited review + render check (Task 6) ✓; final verification + planning-artifact landing + follow-ups (Task 7) ✓; out-of-scope (other libs' docs, source changes, api-docs.json generator, restructuring) honored.
- **Placeholder scan:** No TBD/TODO. Phase 2 fix snippets are intentionally report-driven (the audit produces the exact corrected text); the gates (source re-verification, fix-gate diff, reviewer loop, render 200, supported-Callout-types) make each edit checkable. Commands have expected output.
- **Consistency:** the ground-truth map, severity taxonomy, and row schema are defined once and referenced by every task; the section page lists in Tasks 1–3 match the spec (3+5+2 = 10); `claude/ag-ui-docs-technical-review` is the audit/report + planning-artifact branch, with a separate fix branch off `origin/main`. The supported-Callout-type guard is included (a `type="note"` 500'd a page in the langgraph review).
