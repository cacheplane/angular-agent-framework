# TypeScript DX Audit — Methodology & Rubric

**Status:** Approved (brainstorm 2026-06-19)

**Goal:** Audit the developer-facing `@threadplane/*` public TypeScript surface for **intellisense accuracy and readability** — hover/quick-info, generic inference, inline JSDoc guidance, and misuse-error legibility — producing a **graded findings report** that we triage into fixes. Carries forward the DX bar from prior framework work.

## Scope

- **Libraries (dev-facing core only):** `@threadplane/chat`, `@threadplane/ag-ui`, `@threadplane/langgraph`, `@threadplane/render`. The other 14 published libs (cockpit-*, db, middleware, licensing, design-tokens, telemetry, a2ui) are internal/infra and out of scope.
- **Breadth:** every public export (302 symbols) graded; deeper detail on the authoring surface (functions, providers, injectables, tokens, option/return types).
- **Deliverable:** findings report → triage. Fixes are a *separate* effort decided after the report.

## Method (Approach B — TS-API extraction + rubric grading)

1. **Mechanical extraction.** Reuse the existing TypeDoc walk (`apps/website/scripts/generate-api-docs.ts`, already emits `apps/website/content/docs/<lib>/api/api-docs.json`) for per-export name, kind, signature, JSDoc summary, `@param` descriptions, `@returns`, `@example`. This grades the JSDoc + signature-shape dimensions across all 302 symbols.
2. **Real-hover verification.** For the type dimensions TypeDoc can't judge faithfully, probe the **actual TypeScript `quickInfo`** via the language service (`ts.createLanguageService().getQuickInfoAtPosition` against a synthetic usage file). This is what the IDE shows on hover — it catches leaked internal generics and confirms/refutes inference, and guards against TypeDoc rendering artifacts (e.g. TypeDoc renders `StandardSchemaV1<>` where the real hover is the clean `StandardSchemaV1`).
3. **Source confirmation.** For inference + misuse-error findings, read the definition site.

## Rubric — 5 dimensions, graded ✅ good / 🟡 minor / 🔴 needs-work per symbol

1. **Hover readability** — clean quick-info; no leaked internal generics (`__type`, deep conditional types, workspace-internal names).
2. **Generic inference** — generics flow as a developer expects (e.g. `action<S>` infers handler args from the schema ✅; `view`/`ask` do *not* infer component inputs 🔴).
3. **JSDoc** — summary present + accurate; `@param`/`@returns`/`@example` where they help.
4. **Misuse-error legibility** — wrong/missing args yield a readable TS error, not conditional-type noise.
5. **`.d.ts` leak / surface hygiene** — emitted declarations don't expose workspace-internal types; internal-only consts aren't in the public surface.

## Output

`2026-06-19-ts-dx-audit-findings.md`: exec summary (counts + top themes) → per-lib graded summary → detailed findings by theme with concrete recommendation + example → a final **triage table** (impact × effort) for picking fixes.

## Reusability

The extraction harness (TypeDoc gap-grading + the tsserver hover probe) can be promoted to a **CI guard** later so the DX bar holds — out of scope for the audit itself, noted as a follow-up.
