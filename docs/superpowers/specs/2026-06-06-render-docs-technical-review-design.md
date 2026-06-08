# Render Docs Technical Review — Design

**Date:** 2026-06-06
**Status:** Draft for review
**Scope:** A full technical-accuracy review of all 18 render documentation pages, cross-referenced against library source, producing a severity-ranked findings report and shipping the fixes as PR(s).

## Goal

Make the render docs technically correct: every code snippet, API name,
signature, import path, behavioral claim, and internal link matches the actual
implementation. Catch documented-but-nonexistent APIs and exported-but-undocumented
ones. Discovery is separated from fixing so findings can be triaged before any
edit lands.

This is a **docs accuracy** review. It does not change `libs/render` source and
does not restructure the docs; it corrects what the docs say so they match what
the code does.

## Surface under review (18 pages, ~3,670 lines)

`apps/website/content/docs/render/`:

- **getting-started** (3): `introduction.mdx`, `quickstart.mdx`, `installation.mdx`
- **guides** (5): `registry.mdx`, `state-store.mdx`, `specs.mdx`, `events.mdx`, `lifecycle.mdx`
- **concepts** (1): `json-render-vs-a2ui.mdx`
- **a2ui** (4): `overview.mdx`, `surface-component.mdx`, `surface-store.mdx`, `catalog.mdx`
- **api** (5): `render-spec-component.mdx`, `define-angular-registry.mdx`, `views.mdx`, `signal-state-store.mdx`, `provide-render.mdx` (+ generated `api/api-docs.json`)

## Ground-truth sources (per section)

The audit compares docs against source. The mapping matters because the **a2ui
pages document `@threadplane/chat` APIs, not `@threadplane/render`**:

| Section | Ground-truth source |
|---|---|
| getting-started | `libs/render/src` (watch quickstart's stray `@threadplane/langgraph` `provideAgent` import) |
| guides | `libs/render/src` — `define-angular-registry.ts`, `signal-state-store.ts`, `render.types.ts`, `render-element.component.ts`, `render-event.ts`, `lifecycle.ts`, `render-lifecycle.service.ts` |
| concepts | `libs/render/src` + `libs/chat/src/lib/a2ui` (it's a comparison page) |
| a2ui | **`libs/chat/src/lib/a2ui`** — `surface.component.ts`, `surface-store.ts`, and the catalog/component registry there; exports confirmed in `libs/chat/src/public-api.ts` |
| api | `libs/render/src/public-api.ts` + each named module + the generated `api-docs.json` |

Confirmed facts from exploration:
- `A2uiSurfaceComponent` → `libs/chat/src/public-api.ts:171` (from `./lib/a2ui/surface.component`).
- `createA2uiSurfaceStore` → `libs/chat/src/public-api.ts:163` (from `./lib/a2ui/surface-store`).
- Render docs reference `@threadplane/render` ×29, `@threadplane/chat` ×9 (the a2ui pages), `@threadplane/langgraph` ×1 (the quickstart error).
- `libs/render/src/public-api.ts` is the authoritative render export list (registry, state, provider, components, views, events, lifecycle, fallback).

## Methodology — two gated phases

### Phase 1 — Audit (read-only, parallel)

Five section audit subagents run concurrently. Each is read-only (NO edits) and
returns a structured findings list. Each subagent:

1. Reads every page in its section in full.
2. Reads the mapped ground-truth source.
3. Checks the four dimensions (below) for every snippet, claim, and link.
4. Returns findings as rows: `page:line` · dimension · severity · what's wrong ·
   source evidence (`libs/…:line`) · proposed fix.

Then a **completeness sweep** (one subagent or inline): diff `libs/render/src/public-api.ts`
exports against what the api/guides pages document — list exported-but-undocumented
symbols and documented-but-nonexistent ones. For a2ui, do the same against the
a2ui-related exports in `libs/chat/src/public-api.ts`.

The controller consolidates all findings into one severity-ranked report and
flags systemic/cross-page issues (e.g., a2ui package attribution, repeated wrong
imports).

### Phase 2 — Fix (subagent-driven-development)

After the report is reviewed, fix **grouped by section**. Each group:
implementer applies the report's proposed fixes → re-verifies each changed
snippet against the cited source line → re-checks internal links against
`docs-config.ts` → edited pages return HTTP 200. A spec/accuracy reviewer
confirms each fix matches source and introduces no new mis-attribution before the
next group.

## The four audit dimensions

1. **Code-snippet accuracy** — every import path/package, API name, signature,
   generic parameter, option key, and type matches source exactly. Wrong package
   (e.g. `@threadplane/render` for an a2ui API) or nonexistent symbol = P0.
2. **Conceptual correctness** — prose claims about registry resolution, signal
   state semantics, specs/elements structure, event/handler flow, and lifecycle
   behavior match the implementation. A claim that runs but teaches a wrong model
   = P1.
3. **Links + runnability** — every internal link resolves via `docs-config.ts`
   (product/section/slug entries exist); each example is internally coherent
   (imports cover every symbol used; required providers present) and would
   compile/run as written.
4. **Completeness/gaps** — exported-but-undocumented APIs, documented-but-nonexistent
   APIs, missing options/behaviors, thin coverage.

## Findings report format

One markdown report: `docs/superpowers/specs/2026-06-06-render-docs-review-findings.md`.

Severity taxonomy:
- **P0 — wrong:** breaks copy-paste. Wrong import/package, nonexistent API, wrong
  signature/type. (e.g. the langgraph import; any a2ui page citing
  `@threadplane/render` for a chat API.)
- **P1 — misleading:** runs but teaches the wrong mental model (incorrect behavior
  claim, wrong option semantics).
- **P2 — gap:** undocumented export, missing option, thin coverage.
- **P3 — polish:** stale wording, inconsistent naming, dead link.

Each finding row: `file:line` · dimension · severity · what's wrong · source
evidence (`libs/…:line`) · proposed fix. The report ends with a
"Structural / won't-fix-here" section (e.g. a2ui relocation) listed but not
actioned.

## Testing & verification

- **Phase 1:** every finding carries a concrete source citation; a reviewer
  spot-checks a sample of citations to confirm the audit isn't hallucinating.
- **Phase 2 per group:** each changed snippet re-verified against its cited
  source line; internal links re-checked against `docs-config.ts`; edited pages
  return HTTP 200; a repo-wide check confirms no a2ui page imports an a2ui surface
  API from `@threadplane/render`.
- **Final:** all 18 render routes return 200; the completeness gaps the report
  chose to fill are filled; the structural findings remain listed in the report.

## Out of scope

- **Relocating** the a2ui pages out of the render docs tree (structural decision;
  flagged in the report only).
- Voice/prose-register edits (already shipped) — except where a P0/P1 correction
  necessarily rewrites a sentence.
- `libs/render` (or `libs/chat`) **source** changes — real code bugs get flagged
  for a separate follow-up, not fixed in this docs review.
- Net-new pages or examples beyond filling documented gaps the report identifies.
- Other libraries' docs (langgraph, chat, ag-ui, a2ui top-level, licensing,
  telemetry).

## Self-review notes

- **Placeholder scan:** none — every section names concrete files and sources.
- **Internal consistency:** the a2ui→`libs/chat` mapping is used consistently in
  the ground-truth table, the dimensions (P0 example), and the verification gate.
- **Scope:** single focused effort (one lib's docs); audit and fix are one
  pipeline with a triage gate between, suitable for one plan.
- **Ambiguity:** "fix in PR" = audit findings report committed, then corrections
  shipped; a2ui accuracy fixed in place, relocation only flagged.
