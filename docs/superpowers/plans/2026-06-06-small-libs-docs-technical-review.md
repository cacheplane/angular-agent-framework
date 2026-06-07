# Small Libs Docs Technical Review (a2ui + licensing + telemetry) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Audit the 16 docs pages of a2ui, licensing, and telemetry against library source, produce one severity-ranked findings report, then ship accuracy fixes as per-lib PRs — every snippet, import/package, API/signature, behavioral claim, and link matching the implementation, with the reference pages as the priority.

**Architecture:** Two gated phases. Phase 1 fans out four read-only auditors (a2ui split core/reference; licensing; telemetry) plus a per-lib completeness sweep; the controller re-verifies borderline findings (and source freshness) and consolidates one report grouped by lib. Phase 2 fixes per lib (up to 3 PRs, skip clean libs), each branch cut from up-to-date `origin/main`, each finding re-verified against its cited source line.

**Tech Stack:** MDX docs (Next.js App Router), Angular libraries `libs/a2ui`, `libs/licensing`, `libs/telemetry`, `docs-config.ts` for link/nav resolution, `git diff` + source citation as the accuracy gate, dev-server/curl for render checks.

**Reference spec:** `docs/superpowers/specs/2026-06-06-small-libs-docs-technical-review-design.md`

---

## Ground-truth source map (used by every audit task)

| Audit | Pages (relative to `apps/website/content/docs/`) | Ground-truth source |
|---|---|---|
| a2ui-core | `a2ui/getting-started/{introduction,quickstart}.mdx`, `a2ui/guides/{message-protocol,data-model,adapters-and-validation}.mdx` | `libs/a2ui/src` — `lib/types.ts`, `lib/parser.ts`, resolver/guards, `src/index.ts` |
| a2ui-reference | `a2ui/reference/{schema,parser-resolver-guards}.mdx` | `libs/a2ui/src/lib/types.ts` (schema) + the parser/resolver/guard functions + signatures |
| licensing | `licensing/getting-started/introduction.mdx`, `licensing/guides/{setup,ci-and-offline}.mdx`, `licensing/reference/api.mdx` | `libs/licensing/src` — `evaluateLicense` + status/result types + exports (`src/index.ts`) |
| telemetry | `telemetry/getting-started/introduction.mdx`, `telemetry/guides/{browser,node,privacy-and-opt-out}.mdx`, `telemetry/reference/events.mdx` | `libs/telemetry/src` — `browser/*`, `node/*`, `shared/*`, the events catalog + exports |

Each lib's authoritative export list is `libs/<lib>/src/(public-api.ts|index.ts)`.

## Findings severity taxonomy + row schema

- **P0 — wrong:** breaks copy-paste (wrong import/package, nonexistent API, wrong signature/type).
- **P1 — misleading:** runs but teaches a wrong model.
- **P2 — gap:** undocumented export, missing option, thin coverage.
- **P3 — polish:** stale wording, inconsistent naming, dead link.

Finding row: `page:line · dimension · severity · what's-wrong · source-evidence(libs/…:line) · proposed-fix`.
Dimensions: `accuracy` | `conceptual` | `links` | `completeness`.

---

# PHASE 1 — AUDIT (read-only, parallel)

> Phase 1 produces NO docs edits. The controller dispatches Tasks 1–4 concurrently (disjoint reads), runs Task 5, re-verifies borderline findings, then writes the report in Task 6.

## Tasks 1–4: Section audit subagents

Each task dispatches ONE read-only audit subagent (use `subagent_type: Explore`). Identical prompt except **section/lib name**, **page list**, **ground-truth source**.

**Shared subagent prompt template:**

```
You are a READ-ONLY technical-docs auditor. DO NOT edit, write, or commit any file. You only read and return findings.

Repo root: /Users/blove/repos/angular-agent-framework. Branch: claude/small-libs-docs-technical-review.

## Your section: <SECTION>
## Pages to audit (read each in full):
<ABSOLUTE PAGE PATHS>
## Ground-truth source (read what you need to verify claims):
<SOURCE PATHS>

## Method
For every code fence, inline `code`, prose claim, and internal link in your pages, verify it against the ground-truth source. Open the source files and confirm: import paths/packages, exported symbol names, function/class signatures, option/property keys, types, and documented BEHAVIOR. For REFERENCE pages especially (a2ui schema + parser-resolver-guards, licensing api, telemetry events): every documented type/field/signature/event must match source EXACTLY, and material source items should appear. For internal links (href="/docs/..."), confirm the target exists in apps/website/src/lib/docs-config.ts (built from product/section/slug — check the entry exists; do not grep literal href strings).

## The four dimensions
1. accuracy — import/package, symbol, signature, option key, type matches source EXACTLY. Wrong package or nonexistent symbol = P0.
2. conceptual — behavior claims match implementation; runs-but-wrong-model = P1.
3. links — internal links resolve via docs-config.ts; examples internally coherent + runnable.
4. completeness — flag any obviously missing option/behavior/field/event a reader needs.

## Severity
P0 wrong (breaks copy-paste) | P1 misleading | P2 gap | P3 polish.

## Return format — a markdown table, columns EXACTLY:
| page:line | dimension | severity | what's wrong | source evidence | proposed fix |
- page:line = relative path + line, e.g. a2ui/reference/schema.mdx:42
- source evidence = libs/…:line you verified against
- proposed fix = the concrete corrected text/snippet (specific enough to apply)
If a page is clean: | <page> | — | clean | no issues found | <source checked> | none |
Every finding MUST cite a real source line. If a documented symbol can't be found in source, that's a P0. End with a short "Systemic notes" paragraph for any cross-page pattern.

Your entire final message IS the audit result (table + systemic notes). Return only that.
```

- [ ] **Task 1 — a2ui-core.** Pages: `a2ui/getting-started/{introduction,quickstart}.mdx`, `a2ui/guides/{message-protocol,data-model,adapters-and-validation}.mdx`. Source: `libs/a2ui/src/lib/types.ts`, `lib/parser.ts`, resolver/guards, `src/index.ts`. Dispatch; save table for Task 6.

- [ ] **Task 2 — a2ui-reference.** Pages: `a2ui/reference/{schema,parser-resolver-guards}.mdx`. Source: `libs/a2ui/src/lib/types.ts` (the schema/envelopes/components/dataModel) + the parser/resolver/guard functions + their exact signatures. PRIORITY: every schema type/field + function signature must match source. Dispatch; save table.

- [ ] **Task 3 — licensing.** Pages: `licensing/getting-started/introduction.mdx`, `licensing/guides/{setup,ci-and-offline}.mdx`, `licensing/reference/api.mdx`. Source: `libs/licensing/src` (`evaluateLicense`, status/result types, `src/index.ts`). Verify the license-evaluation semantics (returns a status, does not throw for normal states) + the api reference signatures. Dispatch; save table.

- [ ] **Task 4 — telemetry.** Pages: `telemetry/getting-started/introduction.mdx`, `telemetry/guides/{browser,node,privacy-and-opt-out}.mdx`, `telemetry/reference/events.mdx`. Source: `libs/telemetry/src/browser/*`, `node/*`, `shared/*` (sink, tokens incl. deprecated `posthogKey`/`posthogHost`, opt-out, the events catalog). Verify the events reference vs the actually-emitted events; confirm deprecations. Dispatch; save table.

## Task 5: Per-lib completeness sweep

**Files:** none (analysis).

- [ ] **Step 1: Exports vs docs, per lib**

```bash
cd /Users/blove/repos/angular-agent-framework
for lib in a2ui licensing telemetry; do
  echo "===== $lib ====="
  ENTRY=$(ls libs/$lib/src/public-api.ts libs/$lib/src/index.ts 2>/dev/null | head -1)
  grep -oE "export (function|const|class|type|interface) [A-Za-z0-9_]+|export \{[^}]+\}" "$ENTRY" 2>/dev/null \
    | grep -oE "[A-Z][A-Za-z0-9_]+|[a-z][A-Za-z0-9_]+" | sort -u | while read -r sym; do
      c=$(grep -rl "\b$sym\b" apps/website/content/docs/$lib 2>/dev/null | wc -l | tr -d ' ')
      [ "$c" = "0" ] && echo "  UNDOCUMENTED: $sym"
    done
  echo "  (end $lib)"
done
```
Record notable undocumented exports as **P2** gaps (skip trivial/internal re-exported types).

- [ ] **Step 2: Reverse check.** From the Task 1–4 tables, confirm every API the docs claim each lib exports appears in that lib's `public-api.ts`/`index.ts`. Any that doesn't = **P0**.

## Task 6: Consolidate the findings report

**Files:** Create `docs/superpowers/specs/2026-06-06-small-libs-docs-review-findings.md`

- [ ] **Step 1: Re-verify borderline findings** against source; confirm source freshness (`git fetch origin main`; ensure the audit branch's `libs/*` matches `origin/main` — the ag-ui review hit a stale-local-`main` reducer). Drop/correct unverified findings.

- [ ] **Step 2: Assemble the report**

```markdown
# Small Libs Docs Technical Review — Findings

**Date:** 2026-06-06
**Pages audited:** 16 (a2ui 7, licensing 4, telemetry 5)  **Source:** libs/a2ui, libs/licensing, libs/telemetry

## Summary
- P0: <n>  P1: <n>  P2: <n>  P3: <n>  (per lib: a2ui …, licensing …, telemetry …)
- Systemic issues: <bullets>

## Findings by lib
### a2ui
#### P0 / P1 / P2 / P3
### licensing
#### P0 / P1 / P2 / P3
### telemetry
#### P0 / P1 / P2 / P3

## Structural / won't-fix-here
- <any libs/* source bug — flagged for separate follow-up, NOT fixed here>
- api-docs.json generator nuances (already tracked)

## Fix plan (per-lib PRs)
- a2ui PR: <findings> (skip if clean)
- licensing PR: <findings> (skip if clean)
- telemetry PR: <findings> (skip if clean)
P-level cutoff: default P0+P1+P2, P3 where it's a one-line change. Structural + source items listed, not actioned.
```
Merge the section tables verbatim into the per-lib buckets; keep every source citation.

- [ ] **Step 3: Commit the report**

```bash
cd /Users/blove/repos/angular-agent-framework
git add docs/superpowers/specs/2026-06-06-small-libs-docs-review-findings.md
git commit -m "docs(small-libs): technical review findings report"
```

- [ ] **Step 4: CHECKPOINT — surface the report to the user.** Present per-lib summary counts + systemic issues + the per-lib fix plan. Confirm the P-level cutoff and that structural/source items stay flagged-only, before Phase 2.

---

# PHASE 2 — FIX (subagent-driven, per-lib PRs)

> One PR per lib WITH findings (skip clean libs). Each branch cut from up-to-date `origin/main` (run `git fetch origin main` + verify the lib's source blob matches origin/main BEFORE cutting + before applying source-cited fixes — ag-ui lesson). Fix grouped by section; each group's edits gated by re-verification against the cited source line + an independent accuracy review before commit. Only supported `Callout` types (`tip`/`info`/`warning`/`danger`).

**Shared fix-gate (after each lib's edits, before commit):**

```bash
cd /Users/blove/repos/angular-agent-framework
# $FILES = edited .mdx paths for this lib
git --no-pager diff $FILES   # eyeball: each change matches a report finding; no unrelated heading/link/component churn
grep -rn 'type="note"' $FILES && echo "BAD note callout" || echo "callout types OK"
```
Then an independent accuracy-reviewer subagent confirms each edit matches its cited source line; loop until clean.

## Task 7: a2ui fix PR (if findings)

**Branch:** `claude/fix-a2ui-docs` off up-to-date `origin/main`.
**Files:** the a2ui pages with findings (per report).

- [ ] **Step 1:** `git fetch origin main`; create the branch off `origin/main`; confirm `libs/a2ui` matches origin/main.
- [ ] **Step 2:** Dispatch implementer with the a2ui findings (full rows, grouped by section). Apply each proposed fix EXACTLY; re-read the cited source line before each edit; do NOT touch anything not in a finding.
- [ ] **Step 3:** Shared fix-gate.
- [ ] **Step 4:** Independent accuracy reviewer subagent; loop until clean.
- [ ] **Step 5:** Render check — edited a2ui routes return 200.
- [ ] **Step 6:** Commit (`docs(a2ui): fix technical accuracy issues`), push, open PR, enable auto-merge (squash).

## Task 8: licensing fix PR (if findings)

**Branch:** `claude/fix-licensing-docs` off up-to-date `origin/main`.
**Files:** the licensing pages with findings (per report).

- [ ] **Step 1:** `git fetch origin main`; branch off `origin/main`; confirm `libs/licensing` matches.
- [ ] **Step 2:** Dispatch implementer with the licensing findings; apply exactly; re-verify each against `libs/licensing/src` cited lines (respect the browser-safe constraint — no Buffer/bare `process` in examples).
- [ ] **Step 3:** Shared fix-gate.
- [ ] **Step 4:** Independent accuracy reviewer; loop until clean.
- [ ] **Step 5:** Render check — edited licensing routes return 200.
- [ ] **Step 6:** Commit (`docs(licensing): fix technical accuracy issues`), push, open PR, enable auto-merge.

## Task 9: telemetry fix PR (if findings)

**Branch:** `claude/fix-telemetry-docs` off up-to-date `origin/main`.
**Files:** the telemetry pages with findings (per report).

- [ ] **Step 1:** `git fetch origin main`; branch off `origin/main`; confirm `libs/telemetry` matches.
- [ ] **Step 2:** Dispatch implementer with the telemetry findings; apply exactly; re-verify each against `libs/telemetry/src` cited lines (sink/tokens/events/deprecations).
- [ ] **Step 3:** Shared fix-gate.
- [ ] **Step 4:** Independent accuracy reviewer; loop until clean.
- [ ] **Step 5:** Render check — edited telemetry routes return 200.
- [ ] **Step 6:** Commit (`docs(telemetry): fix technical accuracy issues`), push, open PR, enable auto-merge.

## Task 10: Final verification + land planning artifacts

**Files:** none (verification) + the findings report + spec/plan.

- [ ] **Step 1: All 16 routes return 200** (serve website on :3000; curl each a2ui/licensing/telemetry page).
- [ ] **Step 2:** Mark each fixed finding ✅ in `2026-06-06-small-libs-docs-review-findings.md`; leave structural/source items open.
- [ ] **Step 3:** Land the planning artifacts (spec + plan + resolved findings report) to main via a small doc-only PR from `claude/small-libs-docs-technical-review` (rebased on up-to-date main), enable auto-merge.
- [ ] **Step 4: Spawn follow-ups** for any real `libs/*` source bug the report flagged.
- [ ] **Step 5:** Confirm all PRs merged (monitor; `gh pr update-branch` any that go BEHIND; serialize as they merge); sync local main; delete merged branches.

---

## Manual verification (before each merge)
- [ ] Every fix traces to a report finding with a source citation; no edit lacks a finding.
- [ ] The edited routes render; internal links resolve; no documented API attributed to the wrong package; only supported Callout types used.
- [ ] Findings report committed; structural + source items listed, not actioned.

## Self-Review (completed during planning)

- **Spec coverage:** 16 pages across 3 libs audited (Tasks 1–4, a2ui split core/reference) ✓; four dimensions in every audit prompt, with reference pages as priority ✓; per-lib completeness sweep + reverse check (Task 5) ✓; controller re-verification incl. source-freshness check (Task 6 Step 1) ✓; one severity-ranked report grouped by lib at the spec'd path (Task 6) ✓; triage checkpoint (Task 6 Step 4) ✓; per-lib fix PRs with up-to-date-source guard, source-cited review, render check, supported-Callout guard (Tasks 7–9) ✓; final verification + planning-artifact landing + follow-ups (Task 10) ✓; out-of-scope (chat/a2ui pages, other libs' docs, source changes, api-docs.json generator, restructuring) honored.
- **Placeholder scan:** No TBD/TODO. Phase 2 fix snippets are intentionally report-driven (the audit produces the exact corrected text); the gates (up-to-date source, source re-verification, fix-gate diff, reviewer loop, render 200, supported-Callout) make each edit checkable. Commands have expected output.
- **Consistency:** the ground-truth map, severity taxonomy, and row schema are defined once and referenced by every task; the page lists in Tasks 1–4 match the spec (a2ui 5+2, licensing 4, telemetry 5 = 16); per-lib PRs in Tasks 7–9 match the report's fix-plan and the spec's Phase 2; `claude/small-libs-docs-technical-review` is the audit/report + planning-artifact branch, with separate per-lib fix branches off `origin/main`; the up-to-date-source guard (ag-ui lesson) appears in Phase 2 + Task 6 + Task 10.
