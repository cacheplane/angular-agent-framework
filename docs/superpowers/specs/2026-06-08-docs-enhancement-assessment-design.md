# Docs Enhancement Assessment — Design

**Date:** 2026-06-08
**Status:** Draft for review
**Scope:** Assess and then improve the prose + examples quality of all 7 published-lib doc sets (105 `.mdx` pages). Enhancement-focused: gaps, missing/weak code examples, clarity, structure. Accuracy is assumed largely settled by the just-completed per-lib technical review (#594–#612) and voice pass (#618–#629); real accuracy errors found incidentally are flagged as separate follow-ups, not folded in.

## Goal

Raise the docs from "accurate and in-voice" to "accurate, in-voice, and genuinely useful": no obvious gaps, a runnable code example everywhere a reader needs one, clear explanations, and clean structure/navigation. Produce a prioritized backlog first (gated), then implement the approved improvements as per-lib PRs.

## Context (why this isn't a re-run of the recent reviews)

- The technical-accuracy program (#594–#612) checked **correctness**; the voice pass (#618–#629) checked **register**. Neither targeted **enhancement** — gaps, example coverage, clarity, structure.
- Two doc-touching changes landed **after** the review and were never assessed: **#630** (cockpit ag-ui/json-render guide) and **#632** (new ag-ui API pages `fake-agent`/`inject-agent`/`provide-agent`/`to-agent` + `custom-events` guide).
- **v0.0.49 is now published**, so example code can be validated against the real npm API rather than only `main`.

## Surface (105 `.mdx`, published libs only)

| Lib | Pages |
|---|---|
| langgraph | 21 |
| chat | 38 |
| render | 14 |
| ag-ui | 15 |
| a2ui | 7 |
| telemetry | 5 |
| licensing | 4 |

Out of scope: cockpit docs, marketing/site content, generated `api/api-docs.json` (JSON, not prose).

## Enhancement rubric (the assessment lens)

Each page is scored on these dimensions. The lens is *improvement*, not correctness.

1. **Gaps** — topics/sections a reader needs but the docs omit; concepts referenced but never explained; missing "how do I X" answers.
2. **Code examples** — places that need a copy-paste-ready example and lack one; examples too thin/abstract to be useful; examples that wouldn't compile/run against published 0.0.49.
3. **Clarity** — undefined jargon, buried key information, poor ordering, walls of text, ambiguous phrasing.
4. **Structure/navigation** — page that should split (or merge), weak/absent intro, missing next-steps, missing or stale cross-links.
5. **Drift spot-check (light)** — the #630/#632 additions get a correctness spot-check; flag any page referencing pre-0.0.49 API.

**Finding shape:** `{ lib, page, dimension, severity, recommendation, est_effort }`
- **Severity:** `P0` = broken/misleading for a reader (e.g., example that can't work, missing critical step); `P1` = high-value improvement (missing example, real clarity win, real gap); `P2` = nice-to-have (polish, minor restructure).
- **Recommendation:** concrete and actionable ("add a runnable `provideAgent` + `injectAgent` snippet to chat/getting-started showing the full wiring"), not vague ("improve clarity").

## Phase 1 — Audit (produces the gated backlog)

**1a. Per-lib page audit (subagent fan-out).** One audit agent per lib; the large libs split by section-group to keep each agent's context focused:
- chat (38) → getting-started+concepts / guides / components / api
- langgraph (21) → getting-started+concepts / guides / api
- render (14) → guides+concepts / api
- ag-ui (15) → guides+concepts / api+reference
- a2ui (7), telemetry (5), licensing (4) → one agent each

Each agent reads its pages against the rubric and emits the structured findings list. Agents read the **lib source** (`libs/<lib>/src`) and `examples/chat` to judge whether an example is missing or wrong, and to ground recommendations in real API.

**1b. Thin cross-cutting pass** (a handful of agents, not per-page):
- **Example-parity:** does each lib's getting-started have a runnable end-to-end example? Do equivalent concepts across libs get equivalent example depth?
- **Terminology/cross-link consistency:** same terms used the same way; key cross-links present (chat↔langgraph adapter, render↔a2ui, ag-ui↔chat).
- **Journey walk** on the two highest-traffic libs (langgraph, chat): follow getting-started → guide → production and note flow gaps and missing-example-in-context.

**1c. Aggregate** all findings into a single committed **findings report**: a prioritized backlog grouped by lib, with a short cross-cutting section, P0/P1/P2 counts, and an effort rollup.

## Gate

User reviews the findings report and selects what to action.
**Default:** P0 + P1 in scope for Phase 2; P2 deferred (user may pull specific P2s in). Any incidental accuracy errors become separate follow-up tasks.

## Phase 2 — Implementation (gated, per-lib PRs)

- **One PR per lib**, implementing that lib's approved findings (matches the recent review cadence; clean history, independent merges).
- **Example validation:** new/changed TypeScript example snippets are typechecked against **published 0.0.49** in a throwaway consumer harness (the smoke-consumer technique: a scratch app with `@threadplane/* @0.0.49` + peers installed; extract fenced `ts`/`typescript` snippets; `tsc --noEmit`). Snippets that are intentionally partial/conceptual are reviewed against lib source instead and labeled as such. This keeps "more examples" from meaning "more broken examples."
- **Guardrails (carried from the proven passes):**
  - Prose + example edits only. No lib source changes.
  - Don't churn heading text (`#`/`##`/`###`) — `rehype-slug` anchors + TOC depend on it. New sections may add headings; existing ones stay byte-identical unless a finding explicitly calls for a rename (rare; flag separately).
  - Preserve MDX components/props; supported `Callout` types only (`tip`/`info`/`warning`/`danger`).
  - No technical corrections folded in — flag separately.
  - Each edited route renders HTTP 200; per-lib auto-merge on green + monitor.
- **Order:** highest-traffic first — langgraph → chat → render → ag-ui → a2ui → telemetry → licensing.

## Architecture / mechanics

Reuses the two-phase, subagent-driven structure proven across #594–#612:
spec → plan → Phase 1 audit fan-out → committed findings report → **gate** → Phase 2 per-lib fix PRs (auto-merge + monitor) → land planning artifacts + spawn accuracy follow-ups.

## Testing & verification

- Phase 1: findings are concrete and grounded in real API/source (each cites a page + a specific recommendation). The report is reviewable as a standalone artifact.
- Phase 2 per page: example snippets typecheck against 0.0.49 (or are labeled conceptual); headings byte-identical to `main` except deliberate additions; HTTP 200; an independent review confirms the change matches the finding and respects guardrails.

## Out of scope

- Accuracy corrections (recent program covered this; flag new errors separately).
- Voice/register churn (recent voice pass covered this; only fix clarity issues that are genuine comprehension problems, not tone).
- Cockpit docs, marketing/site content, generated JSON.
- Heading/anchor/link/MDX-prop changes except deliberate, finding-driven additions.
- Lib source / API changes.

## Artifacts

- This spec: `docs/superpowers/specs/2026-06-08-docs-enhancement-assessment-design.md`
- Plan: `docs/superpowers/plans/2026-06-08-docs-enhancement-assessment.md`
- Findings report: `docs/superpowers/specs/2026-06-08-docs-enhancement-findings.md` (committed at end of Phase 1)

## Self-review notes

- **Placeholder scan:** none — rubric, severities, surface counts, and per-lib agent grouping are concrete.
- **Internal consistency:** enhancement-only lens is stated in goal, rubric, and out-of-scope; the "flag accuracy separately" rule appears in context, gate, Phase 2, and out-of-scope consistently; two-phase + gate matches the recent program.
- **Scope:** large but decomposed — Phase 1 is read-only fan-out producing one artifact; Phase 2 is independent per-lib PRs. The gate prevents over-building (P2 deferred by default).
- **Ambiguity:** "improvement" is bounded by the 5 rubric dimensions + severity definitions + concrete-recommendation requirement; example validity is bounded by the typecheck-against-0.0.49 rule.
