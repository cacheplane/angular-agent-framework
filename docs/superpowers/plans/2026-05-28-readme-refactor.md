# README Refactor & Complete Update — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the root `README.md` and all 7 published `@threadplane/*` package READMEs so every claim traces to verified source, missing capabilities are surfaced, and reliability/production trust signals are present.

**Architecture:** Two phases. Phase 1 audits each package's public API and repo-wide facts into a "Ground Truth" inventory (the anti-drift gate). Phase 2 writes each README strictly from that inventory, verifying every named export against source before commit. This is a documentation task — there is no unit-test harness for prose, so each task's "test" is a **source-verification command** whose expected output is shown.

**Tech Stack:** Nx monorepo, Angular 20+/21 libraries, TypeScript, npm. Markdown READMEs published to npm. Verification via `grep` against `src` entry points and `npx nx build <project>`.

---

## Spec

Design spec: `docs/superpowers/specs/2026-05-28-readme-refactor-design.md`. The Ground Truth appendix in that spec is filled by Task 1.

## File Structure

Files this plan creates or modifies:

- Modify: `README.md` — root developer landing surface.
- Modify: `libs/langgraph/README.md` — LangGraph adapter.
- Modify: `libs/ag-ui/README.md` — AG-UI adapter.
- Modify: `libs/chat/README.md` — chat UI primitives + compositions (largest).
- Create/replace: `libs/a2ui/README.md` — **net-new** (currently absent).
- Modify: `libs/telemetry/README.md` — telemetry + transparency contract.
- Modify: `libs/render/README.md` — render primitives (small).
- Modify: `libs/licensing/README.md` — license verification (small).
- Modify: `docs/superpowers/specs/2026-05-28-readme-refactor-design.md` — Ground Truth appendix filled in Task 1.

Entry points to audit (confirmed present):

| Package | Entry point | package.json |
|---|---|---|
| a2ui | `libs/a2ui/src/index.ts` | `libs/a2ui/package.json` |
| ag-ui | `libs/ag-ui/src/public-api.ts` | `libs/ag-ui/package.json` |
| chat | `libs/chat/src/index.ts` | `libs/chat/package.json` |
| langgraph | `libs/langgraph/src/public-api.ts` | `libs/langgraph/package.json` |
| licensing | `libs/licensing/src/index.ts` | `libs/licensing/package.json` |
| render | `libs/render/src/public-api.ts` | `libs/render/package.json` |
| telemetry | `libs/telemetry/src/index.ts` | `libs/telemetry/package.json` |

Repo facts: CI workflow `.github/workflows/ci.yml` job `library` ("Library — lint / test / build"); release policy patch-only at `0.0.x` (current `0.0.47`); Angular peer support to confirm from each `package.json`.

---

## Task 1: Audit packages and fill the Ground Truth inventory

**Files:**
- Read: all 7 entry points + `package.json` files (table above).
- Read: `.github/workflows/ci.yml`, root `package.json`.
- Modify: `docs/superpowers/specs/2026-05-28-readme-refactor-design.md` (Ground Truth appendix).

This task is parallelizable — one audit per package. It produces the single source of truth every later task reads from.

- [ ] **Step 1: Dump every public export per package**

Run for each package (example shown for langgraph; repeat for all 7 using the entry points in the table):

```bash
grep -nE '^export ' libs/langgraph/src/public-api.ts
grep -nE '^export ' libs/ag-ui/src/public-api.ts
grep -nE '^export ' libs/chat/src/index.ts
grep -nE '^export ' libs/a2ui/src/index.ts
grep -nE '^export ' libs/telemetry/src/index.ts
grep -nE '^export ' libs/render/src/public-api.ts
grep -nE '^export ' libs/licensing/src/index.ts
```

Expected: a list of `export ... from './...'` / `export const|function|class|interface|type` lines. For barrel re-exports (`export * from`), follow into the referenced file and list the concrete symbols.

- [ ] **Step 2: Capture peer deps, version, sub-path exports, license per package**

Run for each package:

```bash
for p in a2ui ag-ui chat langgraph licensing render telemetry; do
  echo "=== $p ==="; node -e "const j=require('./libs/$p/package.json'); console.log(JSON.stringify({version:j.version, license:j.license, peerDependencies:j.peerDependencies, exports:Object.keys(j.exports||{})}, null, 2))";
done
```

Expected: per-package version (`0.0.47`), license string, exact `peerDependencies` ranges (verbatim — these go into Install sections), and sub-path export keys (e.g. `./themes/*` for chat).

- [ ] **Step 3: Capture repo-wide trust facts**

```bash
grep -nE "name:|nx (test|build|lint)" .github/workflows/ci.yml | head -40
ls libs/e2e-harness libs/cockpit-testing 2>/dev/null
grep -rl "MockAgentTransport" libs/langgraph/src libs/chat/src 2>/dev/null
```

Expected: confirm the `library` CI job runs lint/test/build; confirm `MockAgentTransport` exists and where; note E2E harness presence. Record: patch-only `0.0.x` release policy, Angular peer range (from Step 2).

- [ ] **Step 4: Write the inventory into the spec**

Replace each `_TBD_` block in the Ground Truth appendix of `docs/superpowers/specs/2026-05-28-readme-refactor-design.md` with the concrete findings: per package — exported symbols (one-line purpose each), shipped capabilities, peer-dep ranges, sub-path exports, license. Fill the repo-wide facts block (CI job, test/E2E harness, release policy, Angular peers).

- [ ] **Step 5: Verify no `_TBD_` remains**

Run:

```bash
grep -n "_TBD_" docs/superpowers/specs/2026-05-28-readme-refactor-design.md
```

Expected: no output (all placeholders filled).

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/specs/2026-05-28-readme-refactor-design.md
git commit -m "docs(spec): fill README refactor ground-truth inventory"
```

---

## Reusable verification pattern (used by Tasks 2–9)

After writing a README, every public symbol it names must exist in that package's entry point, and every peer dep it lists must match `package.json`. The check:

```bash
# 1. Each backticked export named in the README exists in source.
#    Manually list the symbols the README references, then:
for sym in agent provideAgent MockAgentTransport extractCitations; do
  grep -q "$sym" libs/langgraph/src/public-api.ts libs/langgraph/src/**/*.ts && echo "OK: $sym" || echo "MISSING: $sym";
done

# 2. Peer-dep ranges in the README match package.json verbatim.
node -e "console.log(JSON.stringify(require('./libs/langgraph/package.json').peerDependencies,null,2))"

# 3. No stale branding (ngaf:* event names are allowed; old framework name is not).
grep -niE "angular agent framework|@ngaf/" libs/langgraph/README.md || echo "clean"
```

Expected: every symbol `OK`, peer deps match what the README's Install section shows, branding `clean`.

---

## Task 2: Rewrite `libs/langgraph/README.md`

**Files:**
- Modify: `libs/langgraph/README.md`
- Read: inventory block for `@threadplane/langgraph` in the spec; `libs/langgraph/src/public-api.ts`

- [ ] **Step 1: Write the README from the inventory**

Apply the loose-convention template: Title + tagline → badges (npm version, Angular 20+/21, MIT) → What it does → Install (peer deps verbatim) → Quick start (`provideAgent` + `agent()`, verified signatures) → Capabilities (messages/status/isLoading/error/interrupt/toolCalls/subagents/queue/branch/history/regenerate/reload — only those that exist in source) → Reliability (`MockAgentTransport` testing story, runtime-neutral architecture, patch-only releases) → Documentation → License (MIT). Keep the citations example only if `extractCitations` exists in source.

- [ ] **Step 2: Verify every named export exists in source**

Run the reusable verification pattern (above) with the exact symbol list the README references against `libs/langgraph/src/public-api.ts`.
Expected: every symbol `OK`; peer deps match `package.json`; branding `clean`.

- [ ] **Step 3: Verify the package still builds (sub-path/export claims valid)**

Run:

```bash
npx nx build langgraph
```

Expected: build succeeds (README changes don't break build; this confirms the project name and that no example references a removed sub-path).

- [ ] **Step 4: Commit**

```bash
git add libs/langgraph/README.md
git commit -m "docs(langgraph): rewrite README from verified API inventory"
```

---

## Task 3: Rewrite `libs/ag-ui/README.md`

**Files:**
- Modify: `libs/ag-ui/README.md`
- Read: inventory block for `@threadplane/ag-ui`; `libs/ag-ui/src/public-api.ts`

- [ ] **Step 1: Write the README from the inventory**

Template applied: Title + tagline (adapter for any AG-UI backend; keep the backend list) → badges → What it does → Install (`@threadplane/ag-ui @threadplane/chat @ag-ui/client` + peer deps verbatim) → Quick start (`provideAgUiAgent` + `AG_UI_AGENT`, verified) → Capabilities (citations via `bridgeCitationsState`; surface interrupts/subagents/queue/branch/history **only if** present in source) → Reliability → Documentation → License (MIT).

- [ ] **Step 2: Verify every named export exists in source**

Run the reusable verification pattern with the README's symbol list against `libs/ag-ui/src/public-api.ts`.
Expected: every symbol `OK`; peer deps match; branding `clean`.

- [ ] **Step 3: Verify build**

```bash
npx nx build ag-ui
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add libs/ag-ui/README.md
git commit -m "docs(ag-ui): rewrite README from verified API inventory"
```

---

## Task 4: Rewrite `libs/chat/README.md`

**Files:**
- Modify: `libs/chat/README.md`
- Read: inventory block for `@threadplane/chat`; `libs/chat/src/index.ts`; `libs/chat/package.json` exports map

- [ ] **Step 1: Write the README from the inventory**

Largest surface — Capabilities stays rich. Template applied:
- Title + tagline → badges (npm version, Angular 20+/21, PolyForm/Commercial).
- **License story** (keep): source-available, PolyForm Noncommercial for free noncommercial use, Threadplane Commercial for production; commercial token via `provideChat({ license })`; offline verification, non-blocking warn.
- Install + peer deps verbatim.
- Quick start (`<chat [agent]="...">`).
- Capabilities: headless primitives + compositions (`<chat>`, `<chat-debug>`, GenUI surfaces), citations (`Citation`, `<chat-citations>`, inline markers, `CitationsResolverService`), interrupts/HITL, subagents — **only those confirmed in source**.
- **Theming**: collapse the ~50-token dump into a tight subsection — name the four shipped theme CSS files (verify against the `exports` map / `themes/` dir), the two agent-driven knobs (`font`, `primaryColor`), and link to docs for the full token list. Do **not** inline every `--a2ui-*` token.
- Reliability → Documentation → License block.

- [ ] **Step 2: Verify exports, theme sub-paths, and peer deps**

Run:

```bash
# Symbols named in the README exist:
for sym in ChatComponent provideChat Citation CitationsResolverService; do
  grep -rq "$sym" libs/chat/src && echo "OK: $sym" || echo "MISSING: $sym";
done
# Theme CSS sub-paths the README claims actually ship:
node -e "console.log(Object.keys(require('./libs/chat/package.json').exports||{}).filter(k=>k.includes('theme')))"
ls libs/chat/**/themes/*.css 2>/dev/null || find libs/chat -name '*.css' -path '*theme*'
# Peer deps:
node -e "console.log(JSON.stringify(require('./libs/chat/package.json').peerDependencies,null,2))"
```

Expected: every symbol `OK`; the theme files named in the README match the files/exports that actually exist; peer deps match the Install section.

- [ ] **Step 3: Verify build**

```bash
npx nx build chat
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add libs/chat/README.md
git commit -m "docs(chat): rewrite README from verified API inventory"
```

---

## Task 5: Create `libs/a2ui/README.md` (net-new)

**Files:**
- Create: `libs/a2ui/README.md`
- Read: inventory block for `@threadplane/a2ui`; `libs/a2ui/src/index.ts`; `libs/a2ui/package.json`

- [ ] **Step 1: Write the README from the inventory**

Full template, depth set by what the audit found a2ui actually exports: Title + tagline (what A2UI is — agent-to-UI spec rendering) → badges (npm version, Angular 20+/21, license from `package.json`) → What it does → Install (peer deps verbatim) → Quick start (using only confirmed exports) → Capabilities → Reliability → Documentation → License. If a2ui is a thin/internal-feeling surface, keep it short (collapsed template) rather than inventing features.

- [ ] **Step 2: Verify exports and peer deps**

Run the reusable verification pattern with the README's symbol list against `libs/a2ui/src/index.ts`, plus:

```bash
node -e "const j=require('./libs/a2ui/package.json'); console.log(j.license, JSON.stringify(j.peerDependencies))"
```

Expected: every symbol `OK`; license and peer deps in the README match `package.json`.

- [ ] **Step 3: Verify build and that README is packaged**

```bash
npx nx build a2ui
node -e "const f=require('./libs/a2ui/package.json').files; console.log(f? f : '(no files field — npm includes README by default)')"
```

Expected: build succeeds; confirm README.md will be published (either no `files` allowlist, or README is included).

- [ ] **Step 4: Commit**

```bash
git add libs/a2ui/README.md
git commit -m "docs(a2ui): add README from verified API inventory"
```

---

## Task 6: Rewrite `libs/telemetry/README.md`

**Files:**
- Modify: `libs/telemetry/README.md`
- Read: inventory block for `@threadplane/telemetry`; `libs/telemetry/src/index.ts`

- [ ] **Step 1: Write the README from the inventory**

Template applied, transparency contract preserved. Keep all `ngaf:*` event names verbatim (real wire format). Sections: Title + tagline → badges → What it does → the **event catalog** (`ngaf:postinstall`, `ngaf:runtime_instance_created`, `ngaf:runtime_request_created`, `ngaf:stream_started/ended/errored`, browser events) with the "what is NOT collected" guarantees → opt-out (`NGAF_TELEMETRY_DISABLED`, sample rate, ingest URL override) → Reliability/transparency framing → License (MIT). Verify each env var name and event name against source.

- [ ] **Step 2: Verify event names and env vars exist in source**

Run:

```bash
for sym in NGAF_TELEMETRY_DISABLED NGAF_TELEMETRY_SAMPLE_RATE NGAF_TELEMETRY_INGEST_URL; do
  grep -rq "$sym" libs/telemetry/src && echo "OK: $sym" || echo "MISSING: $sym";
done
grep -roE "ngaf:[a-z_]+" libs/telemetry/src | sort -u
```

Expected: every env var `OK`; the printed `ngaf:*` event list matches exactly the events the README documents (no extras, none missing).

- [ ] **Step 3: Verify build**

```bash
npx nx build telemetry
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add libs/telemetry/README.md
git commit -m "docs(telemetry): rewrite README from verified event inventory"
```

---

## Task 7: Rewrite `libs/render/README.md` (small)

**Files:**
- Modify: `libs/render/README.md`
- Read: inventory block for `@threadplane/render`; `libs/render/src/public-api.ts`

- [ ] **Step 1: Write the README from the inventory**

Collapsed template (sections 6–7 compressed to a few lines): Title + tagline → badges → What it does (2–3 bullets) → Install (peer deps verbatim) → Quick start (confirmed exports only) → short Reliability line → Documentation → License (MIT).

- [ ] **Step 2: Verify exports and peer deps**

Run the reusable verification pattern with the README's symbol list against `libs/render/src/public-api.ts`.
Expected: every symbol `OK`; peer deps match; branding `clean`.

- [ ] **Step 3: Verify build**

```bash
npx nx build render
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add libs/render/README.md
git commit -m "docs(render): rewrite README from verified API inventory"
```

---

## Task 8: Rewrite `libs/licensing/README.md` (small)

**Files:**
- Modify: `libs/licensing/README.md`
- Read: inventory block for `@threadplane/licensing`; `libs/licensing/src/index.ts`

- [ ] **Step 1: Write the README from the inventory**

Collapsed template. Frame as the browser-safe license-token verification primitive used by `@threadplane/chat`. Title + tagline → badges → What it does → Install (peer deps verbatim) → Quick start (confirmed exports only) → short Reliability line → Documentation → License (MIT). Do not imply Node-only APIs — this lib ships into Angular browser bundles.

- [ ] **Step 2: Verify exports and peer deps**

Run the reusable verification pattern with the README's symbol list against `libs/licensing/src/index.ts`.
Expected: every symbol `OK`; peer deps match; branding `clean`.

- [ ] **Step 3: Verify build**

```bash
npx nx build licensing
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add libs/licensing/README.md
git commit -m "docs(licensing): rewrite README from verified API inventory"
```

---

## Task 9: Rewrite root `README.md`

**Files:**
- Modify: `README.md`
- Read: all 7 inventory blocks in the spec

- [ ] **Step 1: Rewrite from the inventory**

Keep the hero SVG, tagline, and architecture explainer. Changes:
- Tighten the intro.
- **Verify the `agent()` vs `useStream()` comparison table** — every Angular-side method named (`messages()`, `status()`, `isLoading()`, `error()`, `interrupt()/interrupts()`, `toolCalls()`, `branch()/history()/experimentalBranchTree()`, `queue()`, `subagents()/getSubagent()`, `submit`, `stop`, `regenerate`, `reload`, `MockAgentTransport`) must exist in `libs/langgraph/src` or `libs/chat/src`. Drop any row whose Angular symbol no longer exists.
- Add a **Packages** table: each `@threadplane/*` package → one-line purpose (from inventory) → license.
- Weave in reliability/production framing (CI `library` job, MockAgentTransport, patch-only `0.0.x`, runtime-neutral architecture).
- Keep the License section accurate to the per-package licenses confirmed in the inventory.

- [ ] **Step 2: Verify every comparison-table and Packages-table claim**

Run:

```bash
for sym in messages status isLoading error interrupt interrupts toolCalls branch history experimentalBranchTree queue subagents getSubagent submit stop regenerate reload MockAgentTransport; do
  grep -rqE "\b$sym\b" libs/langgraph/src libs/chat/src && echo "OK: $sym" || echo "MISSING: $sym";
done
# Packages table: every package named is published (not private)
for p in a2ui ag-ui chat langgraph licensing render telemetry; do
  node -e "const j=require('./libs/$p/package.json'); console.log('$p', j.private?'PRIVATE-REMOVE':'ok', j.license)";
done
grep -niE "angular agent framework|@ngaf/" README.md || echo "branding clean"
```

Expected: every Angular symbol `OK` (rows with `MISSING` must have been dropped in Step 1); all 7 packages `ok` with correct license; no stale framework name in prose (the `cacheplane/angular-agent-framework` repo URL is allowed).

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: rewrite root README from verified API inventory"
```

---

## Task 10: Final consistency & link pass

**Files:**
- Read: all 8 READMEs

- [ ] **Step 1: Cross-README consistency check**

Run:

```bash
# Same install/peer-dep claims agree across root and package READMEs.
grep -rn "peer dep" -i README.md libs/*/README.md | head
# No leftover old branding anywhere; ngaf:* event names allowed only in telemetry.
grep -rniE "@ngaf/|angular agent framework" README.md libs/*/README.md
# Every package has a README.
for p in a2ui ag-ui chat langgraph licensing render telemetry; do test -f libs/$p/README.md && echo "OK: $p" || echo "MISSING: $p"; done
```

Expected: peer-dep claims consistent; no `@ngaf/` or old framework name; all 7 packages `OK`.

- [ ] **Step 2: Verify all libs still build together**

Run:

```bash
npx nx run-many -t build -p a2ui ag-ui chat langgraph licensing render telemetry
```

Expected: all builds succeed.

- [ ] **Step 3: Final commit (if Step 1 surfaced fixes)**

```bash
git add README.md libs/*/README.md
git commit -m "docs: README consistency pass"
```

---

## Self-Review (completed during planning)

- **Spec coverage:** Phase 1 audit → Task 1. Per-package rewrites → Tasks 2–8. Root README incl. Packages table + comparison-table verification → Task 9. Trust signals (version/Angular badges, MockAgentTransport/CI, production framing) → embedded in every write task's Step 1. a2ui net-new → Task 5. chat theming collapse + dual-license → Task 4. telemetry `ngaf:*` preservation → Task 6. Consistency → Task 10. All spec sections covered.
- **Placeholders:** The only `_TBD_` markers live in the spec's Ground Truth appendix and are explicitly filled by Task 1, Step 4 (verified empty in Step 5). No placeholders in executable steps.
- **Type/name consistency:** Symbol names in verification commands (`agent`, `provideAgent`, `provideAgUiAgent`, `AG_UI_AGENT`, `bridgeCitationsState`, `MockAgentTransport`, `extractCitations`, `provideChat`, `CitationsResolverService`) are treated as **claims to verify against source**, not assumed-correct — if a symbol reports `MISSING`, the README must not reference it. This is by design, since the audit (Task 1) is what establishes the true names.
