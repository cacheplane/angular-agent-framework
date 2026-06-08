# Chat Docs Technical Review — Design

**Date:** 2026-06-06
**Status:** Draft for review
**Scope:** A full technical-accuracy review of the chat documentation (33 pages), cross-referenced against library source, producing one severity-ranked findings report and shipping fixes as batched PRs. Reuses the methodology proven on the render docs review (#590).

## Goal

Make the chat docs technically correct: every code snippet, import/package, component
selector, `@Input`/`@Output` name and type, function signature, behavioral claim, and
internal link matches the implementation. Catch documented-but-nonexistent APIs and
exported-but-undocumented ones. Discovery is separated from fixing so findings are
triaged before any edit lands.

This is a **docs accuracy** review. It does not change `libs/*` source and does not
restructure the docs; it corrects what the docs say so they match what the code does.

## Surface under review (33 pages)

`apps/website/content/docs/chat/` — ~5,600 lines across 6 sections; **2 sections excluded**.

- **getting-started** (3): `introduction.mdx`, `quickstart.mdx`, `installation.mdx` (skip `changelog.mdx` — generated/list).
- **guides** (9): `layout-modes`, `theming`, `markdown`, `generative-ui`, `custom-catalogs`, `streaming`, `configuration`, `writing-an-adapter`, `lifecycle`.
- **concepts** (2): `primitives-vs-compositions`, `message-model`.
- **components** (14): `chat`, `chat-popup`, `chat-sidebar`, `chat-message-list`, `chat-trace`, `chat-input`, `chat-reasoning`, `chat-interrupt-panel`, `chat-tool-calls`, `chat-tool-call-template`, `chat-tool-call-card`, `chat-subagent-card`, `chat-debug`, `chat-select`.
- **api** (5): `provide-chat`, `chat-config`, `mock-agent`, `content-classifier`, `parse-tree-store`.

**Excluded:** the 4 `chat/a2ui/*` pages (just reviewed + corrected in render review #590) and `getting-started/changelog.mdx` (generated).

## Ground-truth sources

`libs/chat/src` is authoritative (136 public exports in `libs/chat/src/public-api.ts`).
Components live under `libs/chat/src/lib/primitives/*` and `libs/chat/src/lib/compositions/*`.
Cross-lib references appear in some guides and must be verified against the owning lib:

| Section | Pages | Ground-truth source |
|---|---|---|
| getting-started | 3 | `libs/chat/src` — `public-api.ts`, `provide-chat`, the Agent contract under `lib/agent` |
| guides | 9 | `libs/chat/src` + cross-lib: `libs/render` (generative-ui), `libs/langgraph` & `libs/ag-ui` (writing-an-adapter, the Agent contract), `libs/a2ui` (streaming protocol refs) |
| concepts | 2 | `libs/chat/src` — `lib/primitives/*`, `lib/compositions/*`, message types |
| components A | 7 | the specific component class for each page in `lib/primitives/*` or `lib/compositions/*` |
| components B | 7 | same |
| api | 5 | `libs/chat/src/public-api.ts` + `provide-chat`, `chat-config`, `mock-agent`, `content-classifier`, `parse-tree-store` modules + generated `apps/website/content/docs/chat/api/api-docs.json` |

Component-page → source mapping is established per page during the audit (each page names a
component; the auditor locates its class file under `primitives/` or `compositions/`).

## Methodology — two gated phases

### Phase 1 — Audit (read-only, parallel)

Six section audit subagents run concurrently (disjoint reads, no conflict). The 14
component pages are split across **two** auditors (7 + 7) — the heaviest, highest-API-surface
section. Each subagent is read-only and returns findings as rows:
`page:line · dimension · severity · what's-wrong · source-evidence(libs/…:line) · proposed-fix`.

Then a **completeness sweep**: diff `libs/chat/src/public-api.ts` exports against what the
docs document (exported-but-undocumented and documented-but-nonexistent), scoped to the
components + api the chat docs claim to cover (the chat surface is large; the sweep flags
notable gaps, not every internal symbol).

The controller consolidates all findings into one severity-ranked report, flags
systemic/cross-page issues, and **pauses at a triage checkpoint** before Phase 2.

### Phase 2 — Fix (subagent-driven, batched PRs)

After triage, fixes ship as **3 PRs** to keep each reviewable:

- **PR-1 — components** (the 14 component pages).
- **PR-2 — guides + concepts** (11 pages).
- **PR-3 — api + getting-started** (8 pages).

Within each PR, fixes are grouped by section; each group's implementer re-verifies every
changed snippet against the cited source line, re-checks internal links against
`docs-config.ts`, and an independent accuracy reviewer confirms each fix matches source and
introduces no new error before the group is committed. Each PR ends with a render-200 check
on its pages.

## The four audit dimensions

1. **Code-snippet accuracy** — import path/package, exported symbol name, component
   **selector**, `@Input`/`@Output` (signal `input()`/`output()`) names and types,
   function signatures, generics, option keys, and types match source exactly.
   Wrong package or nonexistent symbol = P0.
2. **Conceptual correctness** — prose claims about component behavior, the message model,
   primitives vs compositions, streaming/classification, and the adapter/Agent contract
   match the implementation. Runs-but-wrong-model = P1.
3. **Links + runnability** — internal links resolve via `docs-config.ts`; each example is
   internally coherent (imports cover every symbol used; required providers present) and
   would compile/run as written.
4. **Completeness/gaps** — exported-but-undocumented APIs, documented-but-nonexistent
   APIs, missing inputs/outputs/options, thin coverage.

## Findings report format

One report: `docs/superpowers/specs/2026-06-06-chat-docs-review-findings.md`.

Severity taxonomy (same as render):
- **P0 — wrong:** breaks copy-paste (wrong import/package, nonexistent API, wrong
  selector/signature/type).
- **P1 — misleading:** runs but teaches a wrong mental model.
- **P2 — gap:** undocumented export, missing input/output/option, thin coverage.
- **P3 — polish:** stale wording, inconsistent naming, dead link.

Each row: `file:line · dimension · severity · what's-wrong · source-evidence(libs/…:line) ·
proposed-fix`. The report ends with a "Structural / won't-fix-here" section (e.g.
`api-docs.json` regeneration if needed, any `libs/*` source bug) listed but not actioned,
and a "Fix plan" grouping findings into the 3 PRs with a P-level cutoff.

## Testing & verification

- **Phase 1:** every finding carries a concrete source citation; the controller spot-checks
  a sample of citations + re-verifies any borderline finding before trusting it (as in the
  render review, which caught two auditor false alarms this way).
- **Phase 2 per PR:** each changed snippet re-verified against its cited source line;
  internal links re-checked against `docs-config.ts`; edited pages return HTTP 200; an
  independent accuracy reviewer signs off per section group.
- **Final per PR:** the PR's chat routes return 200; no documented chat API attributed to
  the wrong package.

## Out of scope

- The 4 `chat/a2ui/*` pages (reviewed in #590) and `getting-started/changelog.mdx`.
- Voice/prose-register edits (already shipped) — except where a P0/P1 fix rewrites a sentence.
- `libs/*` **source** changes — real code bugs get flagged for separate follow-ups, not fixed here.
- Net-new pages/examples beyond filling documented gaps the report identifies.
- Other libraries' docs; relocating/restructuring chat pages.

## Self-review notes

- **Placeholder scan:** none — every section names concrete files/sources; the per-page
  component→class mapping is resolved during the audit (each page names its component).
- **Internal consistency:** the 6-auditor split (components ×2) in the methodology matches
  the ground-truth table; the 3-PR batching matches the Phase 2 description and the report's
  fix-plan section; excluded sets (a2ui, changelog) are stated identically in scope and
  out-of-scope.
- **Scope:** one product's docs; large but coherent — one audit/report, batched fixes with a
  triage gate between. Decomposition (components ×2 auditors, 3 fix PRs) handles the size.
- **Ambiguity:** "audit + fix in PR(s)" = one findings report committed, then corrections
  shipped as 3 batched PRs; cross-lib references verified against the owning lib but those
  libs' own pages stay out of scope.
