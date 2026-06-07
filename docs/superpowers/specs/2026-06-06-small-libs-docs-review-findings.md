# Small Libs Docs Technical Review — Findings

**Date:** 2026-06-06
**Pages audited:** 16 (a2ui 7, licensing 4, telemetry 5)
**Source verified against:** `libs/a2ui`, `libs/licensing`, `libs/telemetry`
**Method:** 4 parallel read-only auditors + per-lib completeness sweep; controller re-verified every high-impact finding against source (dropped 1 auditor false alarm).

## Summary

- **P0: 1** · **P1: 1** · **P2: 5** · **P3: 1** (a2ui: 1 P2; licensing: 1 P0 + 1 P1 + 1 P2 + 1 P3; telemetry: 2 P2)
- **a2ui is nearly clean** (the protocol/schema/parser references are accurate); **licensing** has the only P0 (a wrong `LicenseTier` union) plus a missing exported type and a wrong idempotency claim; **telemetry** is missing a whole event (`ngaf:runtime_request_created`) + its capture method from the docs.
- **Dropped (false alarm):** a2ui `introduction.mdx:5` "`@threadplane/chat`/`@threadplane/render` don't exist" — they do; the prose ("those jobs sit in chat and render") is correct.

---

## Findings by lib

### a2ui

| # | page:line | dim | severity | what's wrong | source evidence | fix |
|---|---|---|---|---|---|---|
| A1 | `reference/schema.mdx` (A2uiSurface section, ~line 173) | completeness | P2 | `theme?: A2uiTheme` is referenced but `A2uiTheme`'s fields are never documented | `libs/a2ui/src/lib/types.ts:5-9` (`primaryColor?`, `iconUrl?`, `agentDisplayName?` — all optional strings) | Add a short `A2uiTheme` block: `{ primaryColor?: string; iconUrl?: string; agentDisplayName?: string }` |

(Optional polish, not blocking — surfaced by the core auditor, low value: nested `valueMap` recursion in `A2uiDataModelEntry`, the `sendDataModel` opt-in flow, and `styles` format guidance. Include only if cheap; otherwise leave — the pages are accurate as-is.)

### licensing

| # | page:line | dim | severity | what's wrong | source evidence | fix |
|---|---|---|---|---|---|---|
| L1 | `reference/api.mdx:8` | accuracy | **P0** | `LicenseTier` documented as `'developer-seat' \| 'app-deployment' \| 'enterprise'` | `libs/licensing/src/lib/license-token.ts:4` → `'developer_seat' \| 'team' \| 'enterprise'` | Change to `'developer_seat' \| 'team' \| 'enterprise'` |
| L2 | `reference/api.mdx:5-35` | completeness | P2 | `EvaluateResult` is exported and used in the documented function signatures but missing from the Types section | `libs/licensing/src/index.ts:5` (exported); `libs/licensing/src/lib/evaluate-license.ts:22` (`interface EvaluateResult { status: LicenseStatus; claims?: ... }`) | Add the `EvaluateResult` interface to the Types section (read evaluate-license.ts:22-26 for exact fields) |
| L3 | `reference/api.mdx:101` | conceptual | P1 | Claims a repeated `runLicenseCheck` returns `'licensed'`; it actually returns the **cached original status** (any status) | `libs/licensing/src/lib/run-license-check.ts:26-31` (returns `cached`; source comment: "not a hard-coded 'licensed'") | Reword to "returns the same status computed on the first call" |
| L4 | `guides/setup.mdx:26`, `guides/ci-and-offline.mdx:18`, `getting-started/introduction.mdx:63` | accuracy | P3 | Inconsistent `process.env.X` vs `process.env['X']` access in examples | lib uses bracket-access for `noPropertyAccessFromIndexSignature` (`libs/licensing/src/lib/infer-noncommercial.ts:16-19`) | Optional: standardize on bracket-access in env examples for strict-mode consistency |

### telemetry

| # | page:line | dim | severity | what's wrong | source evidence | fix |
|---|---|---|---|---|---|---|
| T1 | `reference/events.mdx:12-47` | completeness | P2 | `ngaf:runtime_request_created` is missing from the documented event-type unions (Node + browser) and the events table | `libs/telemetry/src/shared/events.ts:4`, `libs/telemetry/src/browser/tokens.ts:7` (event exists); node adapter/client emit it | Add `'ngaf:runtime_request_created'` to the documented unions + a table row (payload: `transport`, `requestType`, `provider`, `model` when supplied) |
| T2 | `guides/browser.mdx` (~63-77) + `guides/node.mdx` (~5-59) | completeness | P2 | `captureRuntimeRequestCreated()` (browser service + node adapter) is undocumented | `libs/telemetry/src/browser/service.ts:83-84`; `libs/telemetry/src/node/adapter.ts:36-37` (+ exported from `node/index.ts`) | Document the method in both guides (import + a usage example with `transport`/`requestType`/`provider`/`model`) |

---

## Structural / won't-fix-here

- No `libs/*` source bugs identified.
- `api-docs.json` generator nuances — already tracked as follow-ups from prior reviews.

## Verified NON-issues (no change)

- a2ui `introduction.mdx:5` — `@threadplane/chat`/`@threadplane/render` exist; prose is correct (dropped false-alarm P0).
- a2ui guards — docs correctly list only the 4 exported guards (`isLiteralArray` is internal-only); accurate.
- a2ui schema/parser/resolver/pointer references — verified accurate vs `types.ts`/`parser.ts`/`resolve.ts`/`guards.ts`/`pointer.ts`.
- telemetry `posthogKey`/`posthogHost` deprecation + opt-out env vars — accurately documented.

---

## Fix plan (per-lib PRs)

Default cutoff: **P0+P1+P2; cheap P3** (L4 optional). Per-lib PRs (all three have findings):
- **PR a2ui:** A1 (+ optional polish only if trivial).
- **PR licensing:** L1 (P0), L2, L3 (+ L4 if cheap).
- **PR telemetry:** T1, T2.
