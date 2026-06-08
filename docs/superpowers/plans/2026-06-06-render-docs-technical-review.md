# Render Docs Technical Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Audit all 18 render documentation pages against library source, produce a severity-ranked findings report, then ship the accuracy fixes — every snippet, API name, signature, import, behavioral claim, and link matching the implementation.

**Architecture:** Two gated phases. Phase 1 fans out five read-only section-audit subagents (plus a completeness sweep) that cross-reference docs against ground-truth source and emit structured findings; the controller consolidates them into one report. Phase 2 fixes the report's findings grouped by section via subagent-driven development, each group re-verified against the cited source line. The a2ui pages document `@threadplane/chat` APIs, so they are audited against `libs/chat/src/lib/a2ui`, not `libs/render`.

**Tech Stack:** MDX docs (Next.js App Router), Angular libraries (`libs/render`, `libs/chat`), `docs-config.ts` for link/nav resolution, `git diff` + source citation as the accuracy gate, dev-server/curl for render checks.

**Reference spec:** `docs/superpowers/specs/2026-06-06-render-docs-technical-review-design.md`

---

## Ground-truth source map (used by every audit task)

| Docs section | Pages | Ground-truth source |
|---|---|---|
| getting-started | `introduction.mdx`, `quickstart.mdx`, `installation.mdx` | `libs/render/src` |
| guides | `registry.mdx`, `state-store.mdx`, `specs.mdx`, `events.mdx`, `lifecycle.mdx` | `libs/render/src` |
| concepts | `json-render-vs-a2ui.mdx` | `libs/render/src` + `libs/chat/src/lib/a2ui` |
| a2ui | `overview.mdx`, `surface-component.mdx`, `surface-store.mdx`, `catalog.mdx` | `libs/chat/src/lib/a2ui` (+ `libs/chat/src/public-api.ts`) |
| api | `render-spec-component.mdx`, `define-angular-registry.mdx`, `views.mdx`, `signal-state-store.mdx`, `provide-render.mdx` | `libs/render/src/public-api.ts` + named modules + `apps/website/content/docs/render/api/api-docs.json` |

Confirmed exports: `A2uiSurfaceComponent` = `libs/chat/src/public-api.ts:171`; `createA2uiSurfaceStore` = `libs/chat/src/public-api.ts:163`. The render public API list is `libs/render/src/public-api.ts`.

## Findings severity taxonomy (used by report + fix gating)

- **P0 — wrong:** breaks copy-paste (wrong import/package, nonexistent API, wrong signature/type).
- **P1 — misleading:** runs but teaches a wrong model (incorrect behavior claim, wrong option semantics).
- **P2 — gap:** undocumented export, missing option, thin coverage.
- **P3 — polish:** stale wording, inconsistent naming, dead link.

Finding row schema (every finding MUST use this):
`page:line` · dimension · severity · what's-wrong · source-evidence(`libs/…:line`) · proposed-fix

Dimensions: `accuracy` | `conceptual` | `links` | `completeness`.

---

# PHASE 1 — AUDIT (read-only, parallel)

> Phase 1 produces NO docs edits. Audit subagents only read and report. The controller dispatches Tasks 1–5 concurrently (disjoint reads, no conflict), then runs Task 6, then writes the report in Task 7.

## Tasks 1–5: Section audit subagents

Each task dispatches ONE read-only audit subagent. The prompt template below is identical except for the **section name**, **page list**, and **ground-truth source** (from the map above). The controller fills those three fields.

**Shared subagent prompt template:**

```
You are a READ-ONLY technical-docs auditor. DO NOT edit, write, or commit any file. You only read and return findings.

Repo root: /Users/blove/repos/angular-agent-framework. Branch: claude/render-docs-technical-review.

## Your section: <SECTION>
## Pages to audit (read each in full):
<ABSOLUTE PAGE PATHS>
## Ground-truth source (read what you need to verify claims):
<SOURCE PATHS>

## Method
For every code fence, inline `code`, prose claim, and internal link in your pages, verify it against the ground-truth source. Open the source files and confirm: import paths/packages, exported symbol names, function/class signatures, generic params, option/property keys, types, and documented behavior. For internal links (href="/docs/..."), confirm the target exists in apps/website/src/lib/docs-config.ts (it builds hrefs from product/section/slug — check the entry exists, do not grep literal href strings).

## The four dimensions to check
1. accuracy — import path/package, API name, signature, generic, option key, type matches source EXACTLY. Wrong package (e.g. @threadplane/render for an API actually exported by @threadplane/chat) or nonexistent symbol = P0.
2. conceptual — prose claims about how the thing behaves match the implementation. Runs-but-wrong-model = P1.
3. links — internal links resolve via docs-config.ts; each example is internally coherent (imports cover every symbol used; required providers present) and would compile/run as written.
4. completeness — note any obviously missing option/behavior a reader would need. (Full export-vs-docs diff is done separately — you just flag gaps you notice.)

## Severity
P0 wrong (breaks copy-paste) | P1 misleading | P2 gap | P3 polish.

## Return format — a markdown table, one row per finding, columns EXACTLY:
| page:line | dimension | severity | what's wrong | source evidence | proposed fix |
- page:line = relative path + line number, e.g. render/guides/registry.mdx:42
- source evidence = libs/…:line you verified against, e.g. libs/render/src/lib/define-angular-registry.ts:88
- proposed fix = the concrete corrected text/snippet (be specific enough to apply)
If a page is clean, write a row: | <page> | — | clean | no issues found | <source checked> | none |
Do NOT speculate — every finding must cite a real source line. If you cannot find the source for a documented symbol, that itself is a P0 finding ("documented symbol not found in source").
End with a short "Systemic notes" paragraph: any pattern repeated across pages (e.g. wrong package used everywhere, a whole page documenting another lib's API).
```

- [ ] **Task 1 — getting-started.** Pages: `apps/website/content/docs/render/getting-started/{introduction,quickstart,installation}.mdx`. Source: `libs/render/src`. (Expected hit: `quickstart.mdx` imports `provideAgent` from `@threadplane/langgraph` — render has no agent concept; verify and propose the correct render snippet or removal.) Dispatch the subagent; save its returned table verbatim for Task 7.

- [ ] **Task 2 — guides.** Pages: `apps/website/content/docs/render/guides/{registry,state-store,specs,events,lifecycle}.mdx`. Source: `libs/render/src` (esp. `define-angular-registry.ts`, `signal-state-store.ts`, `render.types.ts`, `render-element.component.ts`, `render-event.ts`, `lifecycle.ts`, `render-lifecycle.service.ts`, `contexts/repeat-scope.ts`). Dispatch; save table.

- [ ] **Task 3 — concepts.** Page: `apps/website/content/docs/render/concepts/json-render-vs-a2ui.mdx`. Source: `libs/render/src` + `libs/chat/src/lib/a2ui`. (Verify both sides of the comparison are accurately characterized.) Dispatch; save table.

- [ ] **Task 4 — a2ui.** Pages: `apps/website/content/docs/render/a2ui/{overview,surface-component,surface-store,catalog}.mdx`. Source: **`libs/chat/src/lib/a2ui`** (`surface.component.ts`, `surface-store.ts`, plus the component catalog/registry there) and `libs/chat/src/public-api.ts`. Explicitly check the import package on every snippet: an a2ui surface API shown as `from '@threadplane/render'` is a P0 (correct is `@threadplane/chat`). Dispatch; save table.

- [ ] **Task 5 — api.** Pages: `apps/website/content/docs/render/api/{render-spec-component,define-angular-registry,views,signal-state-store,provide-render}.mdx`. Source: `libs/render/src/public-api.ts` + each named module + `apps/website/content/docs/render/api/api-docs.json`. Verify each documented signature/option against both the source AND the generated api-docs.json (flag drift between them). Dispatch; save table.

## Task 6: Completeness sweep (export-vs-docs diff)

**Files:** none (analysis). Run inline or as one subagent.

- [ ] **Step 1: List render public exports**

```bash
cd /Users/blove/repos/angular-agent-framework
grep -E "^export" libs/render/src/public-api.ts
```
Expected: the full export list (types, RENDER_CONTEXT, REPEAT_SCOPE, defineAngularRegistry, signalStateStore, provideRender, RENDER_CONFIG, RenderElementComponent, RenderSpecComponent, views/withViews/overrideViews/withoutViews/toRenderRegistry, ViewRegistry, provideViews, VIEW_REGISTRY, RenderEvent family, RENDER_LIFECYCLE, RenderLifecycle, DefaultFallbackComponent, RenderViewEntry).

- [ ] **Step 2: Cross-check each export against the docs**

For every exported symbol, grep the render docs for a mention:
```bash
cd /Users/blove/repos/angular-agent-framework
for sym in defineAngularRegistry signalStateStore provideRender RENDER_CONFIG RenderElementComponent RenderSpecComponent views withViews overrideViews withoutViews toRenderRegistry ViewRegistry provideViews VIEW_REGISTRY RENDER_CONTEXT REPEAT_SCOPE RENDER_LIFECYCLE RenderLifecycle DefaultFallbackComponent RenderViewEntry AngularComponentInputs AngularComponentRenderer AngularRegistry RenderConfig RenderEvent RenderHandlerEvent RenderStateChangeEvent RenderLifecycleEvent RepeatScope RenderContext; do
  c=$(grep -rl "\b$sym\b" apps/website/content/docs/render 2>/dev/null | wc -l | tr -d ' ')
  echo "$c  $sym"
done | sort -n
```
Any symbol with count `0` is a **P2 completeness gap** (exported but undocumented). Record each as a finding.

- [ ] **Step 3: Reverse check — documented APIs that don't exist**

From the Task 1–5 tables, collect every API name the docs claim to export from `@threadplane/render`, and confirm each appears in `libs/render/src/public-api.ts`. Any that doesn't (and isn't a known `@threadplane/chat` a2ui API) is a **P0**. Record findings.

- [ ] **Step 4: a2ui export check**

```bash
cd /Users/blove/repos/angular-agent-framework
grep -nE "A2ui|a2ui" libs/chat/src/public-api.ts
```
Confirm the a2ui symbols the docs reference are exactly these exports; record drift as findings.

## Task 7: Consolidate the findings report

**Files:** Create `docs/superpowers/specs/2026-06-06-render-docs-review-findings.md`

- [ ] **Step 1: Assemble the report**

Structure:
```markdown
# Render Docs Technical Review — Findings

**Date:** 2026-06-06
**Pages audited:** 18  **Source verified against:** libs/render, libs/chat/src/lib/a2ui

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
- a2ui pages document @threadplane/chat APIs while living under render docs (relocation = separate decision). Accuracy fixed in place; placement flagged.
- <any libs/* source bug noticed — flagged for separate follow-up, NOT fixed here>

## Fix plan
Group fixes by section (getting-started, guides, concepts, a2ui, api). List which P-levels will be fixed (default: P0+P1+P2; P3 if cheap). Structural + source-bug items are listed, not actioned.
```
Merge the section tables verbatim into the severity buckets. Keep every source citation.

- [ ] **Step 2: Commit the report**

```bash
cd /Users/blove/repos/angular-agent-framework
git add docs/superpowers/specs/2026-06-06-render-docs-review-findings.md
git commit -m "docs(render): technical review findings report"
```

- [ ] **Step 3: CHECKPOINT — surface the report to the user**

Present the summary counts + systemic issues + the proposed fix plan. Confirm the P-level cutoff (default P0+P1+P2, P3 if cheap) and that structural/source items stay flagged-only, before starting Phase 2.

---

# PHASE 2 — FIX (subagent-driven, grouped by section)

> One implementer task per section that HAS findings to fix (skip clean sections). Each is gated by re-verification against the cited source line. Use the report from Task 7 as the source of truth for what to change.

**Shared fix-gate (run after each section's edits, before commit):**

```bash
cd /Users/blove/repos/angular-agent-framework
# $FILES = edited .mdx paths for this section
git --no-pager diff $FILES        # eyeball: each change matches a report finding's proposed fix
# Link re-check: every internal href in the edited pages exists in docs-config.ts (manual confirm against the product/section/slug entries)
# Import sanity: no a2ui surface API attributed to @threadplane/render
grep -rn "@threadplane/render" $FILES | grep -iE "A2uiSurface|createA2uiSurfaceStore" && echo "BAD: a2ui API mis-attributed to render" || echo "import attribution OK"
```

## Task 8: Fix getting-started findings

**Files:** the getting-started pages with findings (per report).

- [ ] **Step 1:** Dispatch an implementer subagent with the report's getting-started findings (full rows). Instruction: apply each proposed fix EXACTLY; for the `provideAgent`/`@threadplane/langgraph` snippet, replace with the correct render usage the audit specified (or remove if the example doesn't belong). Do NOT touch anything not in a finding. Re-read the cited source line before each edit to confirm.
- [ ] **Step 2:** Run the shared fix-gate on the edited files.
- [ ] **Step 3:** Spec/accuracy reviewer subagent: confirm every edit matches its cited source and no finding was missed or over-applied. Loop until clean.
- [ ] **Step 4:** Commit: `git commit -m "docs(render): fix getting-started technical accuracy issues"`

## Task 9: Fix guides findings

**Files:** the guides pages with findings (per report).

- [ ] **Step 1:** Dispatch implementer with the guides findings rows; apply proposed fixes exactly; re-verify each against `libs/render/src` cited lines.
- [ ] **Step 2:** Shared fix-gate.
- [ ] **Step 3:** Reviewer subagent; loop until clean.
- [ ] **Step 4:** Commit: `git commit -m "docs(render): fix guides technical accuracy issues"`

## Task 10: Fix concepts findings

**Files:** `apps/website/content/docs/render/concepts/json-render-vs-a2ui.mdx` (if it has findings).

- [ ] **Step 1:** Dispatch implementer with the concepts findings; verify both render and a2ui claims against `libs/render/src` and `libs/chat/src/lib/a2ui`.
- [ ] **Step 2:** Shared fix-gate.
- [ ] **Step 3:** Reviewer subagent; loop until clean.
- [ ] **Step 4:** Commit: `git commit -m "docs(render): fix concepts technical accuracy issues"`

## Task 11: Fix a2ui findings

**Files:** the a2ui pages with findings (per report).

- [ ] **Step 1:** Dispatch implementer with the a2ui findings; ground every snippet in `libs/chat/src/lib/a2ui` + `libs/chat/src/public-api.ts`. Correct any `@threadplane/render` → `@threadplane/chat` for a2ui surface APIs. Do NOT relocate pages (structural — out of scope).
- [ ] **Step 2:** Shared fix-gate (the import-attribution grep MUST print "import attribution OK").
- [ ] **Step 3:** Reviewer subagent; loop until clean.
- [ ] **Step 4:** Commit: `git commit -m "docs(render): fix a2ui page technical accuracy (chat-lib APIs)"`

## Task 12: Fix api findings

**Files:** the api pages with findings (per report); possibly regenerate `api-docs.json` if drift is the issue.

- [ ] **Step 1:** Dispatch implementer with the api findings; verify each signature/option against `libs/render/src/public-api.ts` + named modules. If a finding is "doc drifted from generated api-docs.json", fix the doc prose to match source; if the generated JSON itself is stale, note whether `npm run generate-api-docs` is the fix (run it ONLY if the report says the generator output is wrong, and scope the commit to the render api-docs.json).
- [ ] **Step 2:** Shared fix-gate.
- [ ] **Step 3:** Reviewer subagent; loop until clean.
- [ ] **Step 4:** Commit: `git commit -m "docs(render): fix api reference technical accuracy issues"`

## Task 13: Fill P2 gaps (only those the report chose to fill)

**Files:** the pages where the report decided to document an exported-but-undocumented API.

- [ ] **Step 1:** For each gap the checkpoint approved filling, dispatch an implementer to add a concise, source-accurate section/snippet (grounded in `libs/render/src`). Keep it minimal — document the API as it exists; no speculative features.
- [ ] **Step 2:** Shared fix-gate + confirm the new snippet's symbols all exist in `public-api.ts`.
- [ ] **Step 3:** Reviewer subagent; loop until clean.
- [ ] **Step 4:** Commit: `git commit -m "docs(render): document previously-undocumented exports"`

---

## Task 14: Final verification

**Files:** none (verification)

- [ ] **Step 1: All 18 render routes return 200**

```bash
cd /Users/blove/repos/angular-agent-framework
lsof -ti tcp:3000 >/dev/null 2>&1 || (export PATH=/Users/blove/.nvm/versions/node/v22.14.0/bin:$PATH && npx nx serve website --port 3000 > /tmp/render-review.log 2>&1 &)
sleep 25
for p in \
  getting-started/introduction getting-started/quickstart getting-started/installation \
  guides/registry guides/state-store guides/specs guides/events guides/lifecycle \
  concepts/json-render-vs-a2ui \
  a2ui/overview a2ui/surface-component a2ui/surface-store a2ui/catalog \
  api/render-spec-component api/define-angular-registry api/views api/signal-state-store api/provide-render; do
  curl -s -o /dev/null -w "%{http_code}  render/$p\n" "http://localhost:3000/docs/render/$p"
done
```
Expected: all `200`.

- [ ] **Step 2: No new mis-attribution + no unresolved P0**

```bash
cd /Users/blove/repos/angular-agent-framework
# No a2ui surface API imported from render anywhere in render docs:
grep -rn "@threadplane/render" apps/website/content/docs/render | grep -iE "A2uiSurface|createA2uiSurfaceStore" && echo "BAD" || echo "OK: no a2ui mis-attribution"
# No stray langgraph provideAgent left in render docs (unless report justified keeping it):
grep -rn "provideAgent" apps/website/content/docs/render || echo "OK: no provideAgent in render docs"
```

- [ ] **Step 3: Update the findings report status**

Mark each fixed finding as ✅ in `2026-06-06-render-docs-review-findings.md`; leave structural/source-bug items as open. Commit: `git commit -m "docs(render): mark resolved review findings"`.

- [ ] **Step 4: Spawn follow-ups for flagged-but-unfixed items**

For each real `libs/*` source bug or the a2ui-relocation decision, note it for a separate task (do not fix here).

---

## Manual verification (before merge)
- [ ] Every fix traces to a report finding with a source citation; no edit lacks a finding.
- [ ] All 18 routes render; internal links resolve; no a2ui→render mis-attribution; no stray `provideAgent` in render docs.
- [ ] Findings report committed and updated with resolution status; structural + source items listed, not actioned.

## Self-Review (completed during planning)

- **Spec coverage:** 18 pages across 5 sections audited (Tasks 1–5) ✓; four dimensions in every audit prompt ✓; completeness sweep export-vs-docs (Task 6) ✓; severity-ranked report at the spec'd path (Task 7) ✓; two-phase gated methodology with triage checkpoint (Task 7 Step 3) ✓; section-grouped fixes with source re-verification gate (Tasks 8–12) ✓; gap-fill bounded to approved items (Task 13) ✓; a2ui audited against libs/chat, relocation flagged-not-done (Tasks 4, 11; report Structural section) ✓; final render-200 + mis-attribution checks (Task 14) ✓; out-of-scope (relocation, voice, source changes, other libs) honored ✓.
- **Placeholder scan:** No TBD/TODO. Phase 2 fix snippets are intentionally report-driven (the audit produces the exact corrected text) — this is inherent to a review whose fixes aren't known until discovery; the gates (source re-verification, fix-gate grep, reviewer loop) make each edit checkable. Commands have expected output.
- **Consistency:** the ground-truth source map, severity taxonomy, and finding-row schema are defined once and referenced by every task; the a2ui→`libs/chat` mapping is identical in the map, Task 4, Task 11, and the Task 14 grep; the 18-page route list in Task 14 matches the section breakdown in Tasks 1–5; `claude/render-docs-technical-review` branch used throughout.
