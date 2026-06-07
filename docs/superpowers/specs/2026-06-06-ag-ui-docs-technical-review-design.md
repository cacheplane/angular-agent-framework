# AG-UI Docs Technical Review — Design

**Date:** 2026-06-06
**Status:** Draft for review
**Scope:** A full technical-accuracy review of the ag-ui documentation (10 pages, ~1,210 lines), cross-referenced against library source, producing one severity-ranked findings report and shipping fixes (1 PR, split only if large). Reuses the methodology proven on the render (#590), chat (#594–597), and langgraph (#601–603) reviews.

## Goal

Make the ag-ui docs technically correct: every code snippet, import/package, API
name and signature, behavioral claim, and internal link matches the
implementation — with special attention to the **event-mapping reference**, which
maps AG-UI protocol events to neutral `Agent` signals and must match
`to-agent.ts`. Catch documented-but-nonexistent APIs and exported-but-undocumented
ones. Discovery is separated from fixing; findings are triaged before any edit.

This is a **docs accuracy** review. It does not change `libs/*` source and does not
restructure the docs.

## Surface under review (10 pages, all in scope)

`apps/website/content/docs/ag-ui/`:

- **getting-started** (3): `introduction.mdx`, `quickstart.mdx`, `installation.mdx`.
- **concepts** (1): `architecture.mdx`.
- **guides** (5): `testing.mdx`, `fake-agent.mdx`, `citations.mdx`, `troubleshooting.mdx`, `interrupts.mdx`.
- **reference** (1): `event-mapping.mdx`.

The ag-ui docs use `injectAgent()`/`provideAgent()` (no legacy `agent()` factory).

## Ground-truth sources

`libs/ag-ui/src` is authoritative. Public exports (`libs/ag-ui/src/public-api.ts`):
`toAgent` + `ToAgentOptions`; `provideAgent`, `injectAgent`, `AgentConfig`;
`FakeAgent`, `provideFakeAgent`; `bridgeCitationsState`.

| Auditor | Pages | Ground-truth source |
|---|---|---|
| getting-started | `getting-started/{introduction,quickstart,installation}.mdx` | `libs/ag-ui/src` (`provideAgent`/`injectAgent`/`AgentConfig`, `toAgent`) |
| guides | `guides/{testing,fake-agent,citations,troubleshooting,interrupts}.mdx` | `libs/ag-ui/src` (`FakeAgent`/`provideFakeAgent`, `bridgeCitationsState`, `toAgent`) + `libs/chat/src/lib/agent/*` (Agent contract) |
| concepts + reference | `concepts/architecture.mdx`, `reference/event-mapping.mdx` | `libs/ag-ui/src/lib/to-agent.ts` (AG-UI-event → neutral-`Agent` translation — the core of event-mapping) + the AG-UI protocol event types it consumes |

Verify the single `@threadplane/langgraph` reference in the ag-ui docs against
`libs/langgraph` (it may be a legitimate cross-adapter comparison).

## Methodology — two gated phases

### Phase 1 — Audit (read-only, parallel)

Three section audit subagents run concurrently (disjoint reads). Each is read-only
and returns findings as rows:
`page:line · dimension · severity · what's-wrong · source-evidence(libs/…:line) · proposed-fix`.

Then a **completeness sweep**: diff `libs/ag-ui/src/public-api.ts` exports (8
symbols) against what the docs document — flag exported-but-undocumented and
documented-but-nonexistent.

The controller re-verifies borderline/surprising findings against source (prior
reviews caught auditor false alarms this way), consolidates one severity-ranked
report, flags systemic issues, and **pauses at a triage checkpoint**.

### Phase 2 — Fix (subagent-driven)

After triage, fixes ship as **1 PR** (the surface is small); split into 2 only if
the finding count is unexpectedly large. Fixes are grouped by section; the
implementer re-verifies every changed snippet against the cited source line,
re-checks internal links against `docs-config.ts`, and an independent accuracy
reviewer confirms each fix matches source before commit. The PR ends with a
render-200 check on the edited pages.

## The four audit dimensions

1. **Code-snippet accuracy** — import/package, exported symbol, signature, option
   keys (`AgentConfig`, `ToAgentOptions`, `FakeAgent` config), types match source
   exactly. Wrong package or nonexistent symbol = P0.
2. **Conceptual correctness** — prose claims about the AG-UI adapter architecture,
   the `toAgent` translation, citations bridging, interrupts, and the
   event→signal mapping match the implementation. Runs-but-wrong-model = P1.
   `architecture.mdx` gets conceptual-correctness weighting.
3. **Links + runnability** — internal links resolve via `docs-config.ts`; examples
   are internally coherent and would compile/run as written.
4. **Completeness/gaps** — exported-but-undocumented APIs, documented-but-nonexistent
   APIs, missing options/behaviors, thin coverage. The **event-mapping** table is
   the priority: every documented event→signal row must match `to-agent.ts`, and
   material events handled in source should appear.

## Findings report format

One report: `docs/superpowers/specs/2026-06-06-ag-ui-docs-review-findings.md`.

Severity taxonomy (same as prior reviews): **P0 wrong** / **P1 misleading** /
**P2 gap** / **P3 polish**. Each row carries a source citation. The report ends
with a "Structural / won't-fix-here" section (any `libs/*` source bug; api-docs.json
generator nuances already tracked) and a "Fix plan" with a P-level cutoff.

## Testing & verification

- **Phase 1:** every finding carries a concrete source citation; the controller
  spot-checks + re-verifies borderline findings before trusting them.
- **Phase 2:** each changed snippet re-verified against its cited source line;
  internal links re-checked against `docs-config.ts`; edited pages return HTTP 200;
  an independent accuracy reviewer signs off.
- **Final:** the edited ag-ui routes return 200; no documented API attributed to
  the wrong package.

## Out of scope

- Voice/prose-register edits (already shipped) — except where a P0/P1 fix rewrites a sentence.
- `libs/*` **source** changes — real code bugs flagged for separate follow-ups.
- Net-new pages/examples beyond filling documented gaps the report identifies.
- Other libraries' docs; relocating/restructuring ag-ui pages.
- `api-docs.json` generator nuances (already spawned as follow-ups).

## Self-review notes

- **Placeholder scan:** none — every section names concrete files/sources.
- **Internal consistency:** the 3-auditor split matches the ground-truth table;
  the single-PR default + split-if-large matches Phase 2 and the report's fix-plan;
  event-mapping priority is stated in both the methodology and dimension 4.
- **Scope:** small, coherent — one audit/report, 1 fix PR, triage gate between.
- **Ambiguity:** "audit + fix" = one findings report committed, then corrections
  shipped; the `@threadplane/langgraph` reference is verified against langgraph but
  that lib's docs stay out of scope.
