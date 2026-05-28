# README Refactor & Complete Update — Design

**Date:** 2026-05-28
**Status:** Approved (brainstorming) — pending implementation plan
**Scope:** Root `README.md` + the 7 published `@threadplane/*` npm package READMEs

## Problem

The README surfaces (root + per-package) have drifted from the framework. Two
gaps to close, confirmed with the user:

1. **Factual / API drift** — content may describe APIs, exports, or behavior that
   no longer matches the actual library source.
2. **Missing capabilities** — real shipped features (interrupts, subagents,
   GenUI/A2UI, theming, citations, queue/branch/history, etc.) may not be
   surfaced.

These are developer-facing surfaces (GitHub + npm). Beyond accuracy, they should
highlight **features/capabilities**, **reliability**, and **production-readiness /
continued maintenance**.

`@threadplane/a2ui` currently ships to npm (v0.0.47) with **no README at all** —
a concrete gap to fix.

## In Scope

Root `README.md` plus the 7 published packages:

| Package | Lib path | License |
|---|---|---|
| `@threadplane/a2ui` | `libs/a2ui` | MIT (verify) |
| `@threadplane/ag-ui` | `libs/ag-ui` | MIT |
| `@threadplane/chat` | `libs/chat` | PolyForm Noncommercial + Commercial (dual) |
| `@threadplane/langgraph` | `libs/langgraph` | MIT |
| `@threadplane/licensing` | `libs/licensing` | MIT |
| `@threadplane/render` | `libs/render` | MIT |
| `@threadplane/telemetry` | `libs/telemetry` | MIT |

## Out of Scope

- Private/internal libs: `cockpit-*`, `db`, `design-tokens`, `example-layouts`,
  `ui-react` (all `"private": true`).
- App-level READMEs: `apps/`, `examples/`, `cockpit/`, `marketing/`, `tools/`.

## Approach (C — Verified inventory first, then write)

Accuracy is the #1 concern, so ground truth is established **before** any prose is
written. Two phases.

### Phase 1 — Audit (parallelizable)

One audit per published package. Each reads:

- Public entry points: `src/public-api.ts` / `index.ts` and barrel exports.
- `package.json`: version, `peerDependencies`, `exports` map / sub-path exports,
  `files`, license.
- Capability surfaces: exported components, providers, services, functions.

Each produces an **inventory block** (see Ground Truth appendix):

- Public exported symbols, each with a one-line purpose.
- Shipped capabilities.
- Peer-dependency ranges (verbatim).
- Sub-path exports (e.g. `@threadplane/chat/themes/*`).
- License.

Capture repo-wide trust facts once: CI workflow names, test/E2E harness presence,
patch-only `0.0.x` release policy, Angular 20/21 peer support.

### Phase 2 — Write

Rewrite all 8 READMEs from the inventory. **Anti-drift gate: every claim in a
README must trace to an entry in the Ground Truth appendix.** If it is not in the
inventory, it does not go in a README. Load-bearing claims (method signatures,
provider names) are spot-checked directly against source, not trusted from a
summary alone.

## README Template (loose convention)

Common section order; each package flexes depth. Tiny packages collapse 6–7 into
a line or two.

1. **Title + one-line tagline** — what it is, who it's for.
2. **Badges** — npm version, Angular 20+/21 support, license. *(Trust: version &
   Angular support.)*
3. **What it does** — 2–4 bullets of real capabilities.
4. **Install** — command + peer-dependency ranges (verbatim from `package.json`).
5. **Quick start** — minimal working example, verified against the actual API.
6. **Capabilities / Features** — the meat; scaled to package size.
7. **Reliability** — testing story (`MockAgentTransport`, E2E harness),
   production-readiness framing, runtime-neutral architecture as stability
   guarantee. *(Trust: test/CI + production framing.)*
8. **Documentation** — links to threadplane.ai docs.
9. **License** — per-package (MIT for most; PolyForm/commercial block for `chat`).

**No changelog / release-cadence section** (not a selected trust signal).

### Trust signals to surface

- Version & Angular support: npm version badges, Angular 20/21 support matrix,
  peer-dep ranges, patch-only `0.0.x` release policy.
- Test & CI signals: test coverage / E2E harness, CI status, `MockAgentTransport`
  testing story.
- Production-readiness framing: "production-ready" lead language, real example
  apps, runtime-neutral architecture as a stability guarantee.

(Release cadence & changelog links intentionally excluded.)

## Per-Package Handling

- **`a2ui`** — net-new README, full template. Audit actual exports first to set
  depth.
- **`ag-ui`** — adapter framing is good. Verify `provideAgUiAgent()` / `AG_UI_AGENT`
  / `bridgeCitationsState()` against source; surface missing capabilities
  (interrupts, subagents, queue, branch/history) if present.
- **`chat`** — keep the dual-license story (PolyForm Noncommercial + commercial
  token via `provideChat({ license })`). Fold the ~50-token A2UI theming dump into
  a tighter "Theming" subsection that links to docs instead of listing every
  token inline. Largest surface (compositions, citations, GenUI, theming) —
  Capabilities stays rich.
- **`langgraph`** — verify `agent()` / `provideAgent()` / `MockAgentTransport` /
  `extractCitations()` signatures and citation paths; surface missing capabilities.
- **`telemetry`** — `ngaf:*` strings are real wire-format event names; keep them.
  The transparency / opt-out contract is a feature; keep it, align framing.
- **`licensing`** — small; verify exports, apply collapsed template. Must stay
  browser-safe in framing (consumed by Angular bundles).
- **`render`** — small; verify exports, apply collapsed template.

## Root README

The current root README is close. Refactor to:

- Tighten the intro.
- Keep the `agent()` vs `useStream()` comparison table — **verify each row against
  actual exports; drop rows that no longer match.**
- Add a **Packages** table mapping each `@threadplane/*` package to a one-line
  purpose and its license.
- Weave in reliability / production framing.
- Keep the architecture explainer and the SVG hero / arch-diagram references as-is.

## Ground Truth Appendix (filled during Phase 1)

> Populated by the audit phase. Each package gets a block below. Empty until
> Phase 1 runs.

### Repo-wide facts
- CI workflows: _TBD (audit)_
- Test / E2E harness: _TBD (audit)_
- Release policy: patch-only at `0.0.x` (e.g. 0.0.47 → 0.0.48), never minor-bump.
- Angular peer support: _TBD (audit — confirm 20 + 21)_

### Per-package inventories
- `@threadplane/a2ui` — _TBD_
- `@threadplane/ag-ui` — _TBD_
- `@threadplane/chat` — _TBD_
- `@threadplane/langgraph` — _TBD_
- `@threadplane/licensing` — _TBD_
- `@threadplane/render` — _TBD_
- `@threadplane/telemetry` — _TBD_

## Success Criteria

- All 8 READMEs rewritten; `a2ui` has a README.
- Every factual claim traces to a verified inventory entry (no unverified API
  references).
- Each README follows the loose-convention template, scaled to package size.
- Trust signals (version/Angular, test/CI, production framing) present where
  applicable.
- No stale branding; `ngaf:*` event names preserved as wire format.
- Private libs and app READMEs untouched.
