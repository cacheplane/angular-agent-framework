# Docs Voice Pass — Beyond Getting-Started Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply Brian's technical-register voice pass to the remaining docs prose (guides/concepts/reference/components/api `.mdx` across all 7 libs, ~78 pages), prose-only, shipped as one per-lib PR each (7 PRs).

**Architecture:** Per-lib PRs. Within each PR, implementer work is grouped by section so no agent edits too much at once; each group is gated by a prose-only diff guard → voice review → render-200. Reference/api/component pages get YAGNI-hard treatment (prose-only; tables/signatures/props untouched; near-empty diffs are correct). Reuses the rubric + guardrails proven on the getting-started passes (#583, #585).

**Tech Stack:** MDX docs (Next.js App Router), `git diff` heading/fence guard as the accuracy gate, independent voice-review subagent, dev-server/curl for render checks. `docs/gtm/voice.md` = the register.

**Reference spec:** `docs/superpowers/specs/2026-06-07-docs-voice-beyond-gs-design.md`

---

## Voice rubric (apply surgically — don't churn in-voice prose)
- Title-as-lede (keep existing H1); contractions; one thought per line; short paragraphs.
- Guides: "Let's" lead-ins where a step intro reads flatly; a brief next-steps close where natural (reuse existing links; verify routes in `docs-config.ts`).
- Flag opinions ("For me", "In my experience") + a tradeoff — only where the page already recommends something. Don't invent opinions.
- Trim corporate stiffness/filler; concrete verbs.
- NO emojis, anecdotes, hype, or lecturing.

## Hard guardrails (NON-NEGOTIABLE)
1. Never change anything inside a fenced ``` code block, nor any inline `code`, command, API name, type, version, or link/href.
2. Never change heading text (`#`/`##`/`###`) — rehype-slug anchors + TOC depend on it. H1 titles stay exactly.
3. Preserve all MDX components + props, incl. every `<Step title="...">`. Use only supported `Callout` types (`tip`/`info`/`warning`/`danger` — never `note`).
4. YAGNI — leave already-in-voice passages alone.
5. NO technical corrections folded in. Flag any real error for a separate follow-up.

## Reference/api/component pages — YAGNI HARD
For `reference/*`, `api/*`, `chat/components/*`: voice ONLY the page intro + explanatory prose between code/tables. NEVER touch tables/rows, signatures, code, inline API tokens, selectors/props, `<Step title>`. A near-empty or empty diff on these pages is a SUCCESS.

## Shared per-section gate (run after each section's edits, before committing)

```bash
cd /Users/blove/repos/angular-agent-framework
# $FILES = the edited .mdx paths for this section
for p in $FILES; do
  echo "== $p =="
  echo "headings changed:"; git --no-pager diff "$p" | grep -E "^[+-]\s*#{1,6} " || echo "  (none — good)"
  echo "fences changed:";   git --no-pager diff "$p" | grep -E "^[+-]\s*\`\`\`"   || echo "  (none — good)"
  echo "Step titles changed:"; git --no-pager diff "$p" | grep -E "^[+-].*<Step " || echo "  (none — good)"
  echo "note callout:"; git --no-pager diff "$p" | grep -E "^\+.*type=\"note\"" && echo "  BAD" || echo "  (none — good)"
done
```
Every line must print "(none — good)". Then eyeball the full diff: every `+`/`-` pair is prose. Revert any code/heading/link/`<Step>`/component change.

Then dispatch an independent **voice-review subagent** for the section: confirm each page reads in Brian's technical register (contractions, one-thought-per-line; guides have "Let's" + next-steps where natural), no emojis/hype/anecdotes/lecturing, and the guardrails held. Loop until clean.

---

## Per-PR procedure (applies to every lib Task below)

Each lib Task follows the SAME shape:

- [ ] **Step A — branch:** `git fetch origin main`; create `claude/voice-<lib>-docs` off `origin/main` (stale-source guard).
- [ ] **Step B — read + edit by section:** dispatch implementer subagent(s), one per section group (the Task lists the groups). The implementer reads each page + `docs/gtm/voice.md`, applies the rubric surgically, and respects the guardrails + YAGNI-hard rule for reference/api/component pages.
- [ ] **Step C — section gate:** run the shared per-section gate (heading/fence/`<Step>`/note guard) on the edited files; fix violations.
- [ ] **Step D — voice review:** independent voice-review subagent per section group; loop until clean.
- [ ] **Step E — commit per section** (`docs(<lib>): voice pass on <section>`), grouped for clean history.
- [ ] **Step F — render check:** serve website on :3000; each edited route returns 200; `diff` headings of each edited page vs `origin/main` shows identical heading lines.
- [ ] **Step G — PR + auto-merge:** push, open PR (`docs(<lib>): voice pass on guides/concepts/reference`), enable squash auto-merge; monitor (`gh pr update-branch` if BEHIND).

---

## Task 1 — langgraph voice PR (18 pages)

**Branch:** `claude/voice-langgraph-docs`.
**Section groups (implementer per group):**
- **guides (9):** `lifecycle, streaming, subgraphs, time-travel, persistence, deployment, memory, interrupts, testing` — `apps/website/content/docs/langgraph/guides/*.mdx`. Tutorial/how-to register.
- **concepts (5):** `agent-contract, langgraph-basics, angular-signals, state-management, agent-architecture` — prose-dense; highest voice value; apply rubric to explanatory prose, leave code/diagrams.
- **api (4):** `inject-agent, provide-agent, fetch-stream-transport, mock-stream-transport` — YAGNI HARD (intros only; leave signatures/tables).

Run Steps A–G. Render routes: all 18 under `/docs/langgraph/{guides,concepts,api}/<slug>`.

## Task 2 — chat voice PR (30 pages)

**Branch:** `claude/voice-chat-docs`.
**Section groups:**
- **guides (9):** `layout-modes, theming, markdown, generative-ui, custom-catalogs, streaming, configuration, writing-an-adapter, lifecycle`.
- **concepts (2):** `primitives-vs-compositions, message-model`.
- **components A (7):** `chat, chat-popup, chat-sidebar, chat-message-list, chat-trace, chat-input, chat-reasoning` — YAGNI HARD (intro prose only; never the input/output tables, selectors, slots).
- **components B (7):** `chat-interrupt-panel, chat-tool-calls, chat-tool-call-template, chat-tool-call-card, chat-subagent-card, chat-debug, chat-select` — YAGNI HARD.
- **api (5):** `provide-chat, chat-config, mock-agent, content-classifier, parse-tree-store` — YAGNI HARD.
- (Skip `getting-started/changelog.mdx`; the `chat/a2ui/*` pages voice only if narrative — YAGNI HARD.)

Run Steps A–G.

## Task 3 — render voice PR (11 pages)

**Branch:** `claude/voice-render-docs`.
**Section groups:**
- **guides (5):** `registry, state-store, specs, events, lifecycle`.
- **concepts (1):** `json-render-vs-a2ui`.
- **api (5):** `render-spec-component, define-angular-registry, views, signal-state-store, provide-render` — YAGNI HARD.

Run Steps A–G.

## Task 4 — ag-ui voice PR (7 pages)

**Branch:** `claude/voice-ag-ui-docs`.
**Section groups:**
- **guides (5):** `fake-agent, citations, interrupts, testing, troubleshooting`.
- **concepts (1):** `architecture`.
- **reference (1):** `event-mapping` — YAGNI HARD (intro prose only; never the event→signal table).

Run Steps A–G.

## Task 5 — a2ui voice PR (5 pages)

**Branch:** `claude/voice-a2ui-docs`.
**Section groups:**
- **guides (3):** `message-protocol, data-model, adapters-and-validation`.
- **reference (2):** `schema, parser-resolver-guards` — YAGNI HARD (intro prose only; never the type/schema blocks or tables).

Run Steps A–G.

## Task 6 — telemetry voice PR (4 pages)

**Branch:** `claude/voice-telemetry-docs`.
**Section groups:**
- **guides (3):** `browser, node, privacy-and-opt-out`.
- **reference (1):** `events` — YAGNI HARD.

Run Steps A–G.

## Task 7 — licensing voice PR (3 pages)

**Branch:** `claude/voice-licensing-docs`.
**Section groups:**
- **guides (2):** `setup, ci-and-offline`.
- **reference (1):** `api` — YAGNI HARD.

Run Steps A–G.

## Task 8 — Land planning artifacts + close out

- [ ] **Step 1:** After all 7 lib PRs are merged, land the spec + plan to main via a small doc-only PR from `claude/docs-voice-beyond-gs` (rebased on up-to-date main), enable auto-merge.
- [ ] **Step 2:** Confirm all PRs merged (monitor; `gh pr update-branch` any BEHIND; serialize); sync local main; delete merged branches.
- [ ] **Step 3:** Spawn a follow-up for any real technical error a voice-review surfaced (do NOT fold corrections into voice PRs).

---

## Manual verification (per lib PR, before merge)
- [ ] Heading/fence/`<Step>`/note guard prints "(none — good)" for every edited file; headings byte-identical to `origin/main`.
- [ ] Voice review confirms the technical register; reference/api/component pages show prose-only (often near-empty) diffs.
- [ ] All edited routes render HTTP 200.

## Self-Review (completed during planning)

- **Spec coverage:** all 78 pages across 7 libs covered by per-lib Tasks 1–7 with section groups matching the spec's page counts (langgraph 18, chat 30, render 11, ag-ui 7, a2ui 5, telemetry 4, licensing 3) ✓; rubric + guardrails carried verbatim from the proven passes ✓; YAGNI-hard reference/api/component handling stated in the plan header + each relevant group ✓; per-section gate (heading/fence/`<Step>`/note) + voice review + render-200 ✓; per-lib PRs with stale-source guard + auto-merge + monitor ✓; planning-artifact landing + follow-up spawning (Task 8) ✓; order (langgraph→chat→render→ag-ui→a2ui→telemetry→licensing) matches the spec.
- **Placeholder scan:** No TBD/TODO. Voice edits are author-judgment (a voice pass) — bounded by the rubric, the off-limits guardrails, the automated heading/fence/`<Step>`/note guard, and the independent voice review; commands have expected output ("(none — good)").
- **Consistency:** the shared per-section gate + per-PR procedure (Steps A–G) are defined once and referenced by every lib Task; section group page lists match the spec; the supported-Callout-type guard (`note` 500'd a page in the langgraph review) is in the gate; `claude/docs-voice-beyond-gs` holds the spec/plan, with per-lib `claude/voice-<lib>-docs` branches off `origin/main`.
