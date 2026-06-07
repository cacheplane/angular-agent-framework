# Small Libs Docs Technical Review (a2ui + licensing + telemetry) — Design

**Date:** 2026-06-06
**Status:** Draft for review
**Scope:** A combined technical-accuracy review of the three remaining non-adapter libs' docs — a2ui (7 pages), licensing (4), telemetry (5) — 16 pages / ~1,577 lines, cross-referenced against library source. One severity-ranked findings report; per-lib fix PRs. Completes the docs technical-review program (render #590, chat #594–597, langgraph #601–603, ag-ui #604–605).

## Goal

Make the a2ui, licensing, and telemetry docs technically correct: every code
snippet, import/package, API name and signature, behavioral claim, and internal
link matches the implementation — with the **reference pages** as the priority
(a2ui schema + parser/resolver/guards, licensing api, telemetry events). Catch
documented-but-nonexistent APIs and exported-but-undocumented ones. Discovery is
separated from fixing; findings are triaged before any edit.

This is a **docs accuracy** review. It does not change `libs/*` source and does not
restructure the docs.

## Surface under review (16 pages, all in scope)

- **a2ui** (`apps/website/content/docs/a2ui/`, 7): getting-started `introduction`, `quickstart`; guides `message-protocol`, `data-model`, `adapters-and-validation`; reference `schema`, `parser-resolver-guards`.
- **licensing** (`apps/website/content/docs/licensing/`, 4): getting-started `introduction`; guides `setup`, `ci-and-offline`; reference `api`.
- **telemetry** (`apps/website/content/docs/telemetry/`, 5): getting-started `introduction`; guides `browser`, `node`, `privacy-and-opt-out`; reference `events`.

(The `chat/a2ui/*` surface pages are NOT in scope — reviewed in #590/#594.)

## Ground-truth sources

| Auditor | Pages | Ground-truth source |
|---|---|---|
| a2ui-core | a2ui gs ×2 + guides ×3 (5) | `libs/a2ui/src` — `lib/types.ts` (A2uiMessage envelopes, A2uiSurface, components, dataModel), `lib/parser.ts`, `lib/resolver` / `lib/guards`, `src/index.ts` (exports) |
| a2ui-reference | a2ui reference: `schema`, `parser-resolver-guards` (2) | `libs/a2ui/src/lib/types.ts` (the schema), the parser/resolver/guard functions + their signatures (the API surface) |
| licensing | licensing gs + guides ×2 + reference (4) | `libs/licensing/src` — `evaluateLicense` + status/result types; the browser-safe constraint (no Buffer/bare `process`, bracket-access Record types per repo memory) |
| telemetry | telemetry gs + guides ×3 + reference (5) | `libs/telemetry/src` — `browser/*` (tokens incl. deprecated `posthogKey`/`posthogHost`, sink), `node/*`, `shared/*`, the emitted events catalog |

`libs/<lib>/src/(public-api.ts|index.ts)` is authoritative for each lib's exports.

## Methodology — two gated phases

### Phase 1 — Audit (read-only, parallel)

Four section audit subagents run concurrently (disjoint reads). Each is read-only
and returns findings as rows:
`page:line · dimension · severity · what's-wrong · source-evidence(libs/…:line) · proposed-fix`.

Then a **per-lib completeness sweep**: diff each lib's exports against what its docs
document — flag exported-but-undocumented and documented-but-nonexistent.

The controller re-verifies borderline/surprising findings against source (prior
reviews caught false alarms AND a stale-source bug this way — see the ag-ui
incident), consolidates one severity-ranked report grouped by lib, flags systemic
issues, and **pauses at a triage checkpoint**.

### Phase 2 — Fix (subagent-driven, per-lib PRs)

After triage, fixes ship as **up to 3 PRs** (one per lib with findings; skip clean
libs). Each PR is its own branch off the **latest** `origin/main` — explicit
`git fetch origin main` + an up-to-date check BEFORE cutting the branch and BEFORE
applying source-cited fixes (the ag-ui review hit a stale-local-`main` whose
`reducer.ts` predated real handling; this guard prevents a repeat). Within each PR,
fixes are grouped by section; the implementer re-verifies every changed snippet
against the cited source line, re-checks internal links against `docs-config.ts`,
and an independent accuracy reviewer confirms each fix matches source before
commit. Only supported `Callout` types (`tip`/`info`/`warning`/`danger` — never
`note`). Each PR ends with a render-200 check.

## The four audit dimensions

1. **Code-snippet accuracy** — import/package, exported symbol, signature, option
   keys, types match source exactly. Wrong package or nonexistent symbol = P0.
2. **Conceptual correctness** — prose claims about the A2UI protocol/parsing,
   license evaluation semantics, and telemetry sink/opt-out behavior match the
   implementation. Runs-but-wrong-model = P1.
3. **Links + runnability** — internal links resolve via `docs-config.ts`; examples
   are internally coherent and would compile/run as written.
4. **Completeness/gaps** — exported-but-undocumented APIs, documented-but-nonexistent
   APIs, missing options/behaviors, thin coverage. **Reference pages are the
   priority:** a2ui `schema` must match `types.ts`; `parser-resolver-guards` must
   match the real function signatures; licensing `api` and telemetry `events` must
   match source.

## Findings report format

One report: `docs/superpowers/specs/2026-06-06-small-libs-docs-review-findings.md`,
**grouped by lib**. Severity taxonomy (same as prior reviews): **P0 wrong** /
**P1 misleading** / **P2 gap** / **P3 polish**. Each row carries a source citation.
The report ends with a "Structural / won't-fix-here" section (any `libs/*` source
bug; api-docs.json generator nuances already tracked) and a per-lib "Fix plan"
with a P-level cutoff.

## Testing & verification

- **Phase 1:** every finding carries a concrete source citation; the controller
  spot-checks + re-verifies borderline findings (and confirms source freshness)
  before trusting them.
- **Phase 2 per PR:** each changed snippet re-verified against its cited source
  line on up-to-date source; internal links re-checked; edited pages return HTTP
  200; an independent accuracy reviewer signs off.
- **Final:** the edited routes return 200; no documented API attributed to the
  wrong package; planning artifacts landed.

## Out of scope

- Voice/prose-register edits (already shipped) — except where a P0/P1 fix rewrites a sentence.
- `libs/*` **source** changes — real code bugs flagged for separate follow-ups.
- Net-new pages/examples beyond filling documented gaps the report identifies.
- The `chat/a2ui/*` surface pages (already reviewed); other libraries' docs; restructuring.
- `api-docs.json` generator nuances (already spawned as follow-ups).

## Self-review notes

- **Placeholder scan:** none — every section names concrete files/sources.
- **Internal consistency:** the 4-auditor split matches the ground-truth table; the
  per-lib PR structure matches Phase 2 and the report's per-lib fix-plan; reference
  pages flagged as priority in both the methodology and dimension 4; the
  up-to-date-source guard appears in Phase 2 + verification (ag-ui lesson).
- **Scope:** three independent but small libs handled as one review program (per-lib
  audit tracks, per-lib fixes) — efficient without conflating the libs' findings.
- **Ambiguity:** "combined review, per-lib fix PRs" = one findings report grouped by
  lib, then up to 3 PRs; clean libs are skipped.
