---
workstream: analytics-foundation-1a-dashboards-as-code
status: approved
owner: brian
phase: 0
spec: docs/superpowers/specs/gtm/2026-05-14-analytics-foundation-1a-dashboards-as-code-design.md
plan: docs/superpowers/plans/gtm/2026-05-14-analytics-foundation-1a-dashboards-as-code.md
parent: docs/superpowers/specs/gtm/2026-05-13-gtm-meta-design.md
---

# Analytics Foundation 1A — Dashboards-as-code (Design)

> Spec 1A of the Cacheplane GTM motion. Decomposed from the meta-spec's `analytics-foundation` workstream into 4 sub-specs (1A–1D). This spec covers **dashboards-as-code infrastructure only** — the `@ngaf/telemetry` library (1B), cockpit instrumentation (1C), and website reconciliation (1D) are their own specs.

## 1. Goal

Establish a PostHog dashboards-as-code pipeline so every dashboard, insight, and cohort the GTM motion depends on is a committed JSON file, reconciled to PostHog via a typed CLI. Ship one sample dashboard (`developer-funnel`) end-to-end as round-trip proof that future dashboards plug in without infra changes.

## 2. Context

- The meta-spec (`docs/superpowers/specs/gtm/2026-05-13-gtm-meta-design.md`) bundled the entire analytics surface into a single `analytics-foundation` workstream. After re-scoping, that workstream is decomposed into 4 specs that ship and review independently:
  - **1A (this spec):** dashboards-as-code infrastructure + 1 sample dashboard
  - **1B:** `@ngaf/telemetry` library (Node + browser surfaces, postinstall, publish)
  - **1C:** cockpit instrumentation (six-signal events from `apps/cockpit`)
  - **1D:** website reconciliation (audit May-2 plan; add `marketing:lead_qualified` server enrichment; build `/api/ingest` proxy)
- Why 1A first: it's independent of 1B/1C/1D, it produces a measurable artifact (a dashboard in PostHog), and it unblocks future specs from needing to invent their own dashboard storage.
- PostHog does not publish a Node SDK for its management API. The Public API is REST-only. We will not hand-type response shapes; we generate them from PostHog's published OpenAPI spec.
- "api/cli-first" (per meta-spec) is satisfied by: every dashboard a JSON file in git; the only way to mutate PostHog is via `nx run posthog-tools:sync:apply`; the weekly report is a CLI that writes markdown.

## 3. Scope

**In scope:**

- New Nx project `posthog-tools` at `tools/posthog/`
- Generated TypeScript types from PostHog's OpenAPI spec (`tools/posthog/types/posthog-api.gen.ts`)
- Typed PostHog client (`tools/posthog/client.ts`) using `openapi-fetch`
- Zod schemas for local JSON files (`tools/posthog/schema.ts`)
- `sync` CLI with `--plan` and `--apply` modes, atomic writeback (`tools/posthog/sync.ts`)
- `report` CLI producing weekly markdown snapshot (`tools/posthog/report.ts`)
- Env-var config + validation (`tools/posthog/env.ts`)
- One sample dashboard JSON + 4 insight JSONs (the `developer-funnel` content)
- CI workflow job with Nx-affected gating + soft-skip on missing secrets
- Tests: schema validation, sync engine, report engine, taxonomy guard (~22 tests)
- Decomposition update to `gtm.md §6` / §7 and meta-spec §6 reflecting 1A–1D
- Documentation refresh: `tools/posthog/README.md` updates that align with this design

**Out of scope:**

- Telemetry library (Spec 1B)
- Cockpit instrumentation (Spec 1C)
- Website reconciliation, `/api/ingest` proxy, `marketing:lead_qualified` server enrichment (Spec 1D)
- The remaining 4 dashboards (`enterprise-funnel`, `activation-six-signals` expanded, `content-intent`, `package-telemetry`) — follow-up `dashboards-content` spec after 1B/1C/1D unlock the events those dashboards depend on
- Cohort definitions (empty `cohorts/` directory ships; cohorts come after data flows)
- Feature flags / experiments / session replay sync (post-Phase-4 deferred)
- Read-only scoped CI key (option A.ii — production hardening TODO documented in README)
- Auto-merge of weekly snapshot PRs (Cowork skill drafts; human merges)

## 4. Architecture

### 4.1 Three-layer separation

```
┌────────────────────────────────────────────────────────────────┐
│ AUTHORING LAYER — Pure data, edited by humans                  │
│ tools/posthog/dashboards/  /insights/  /cohorts/               │
└──────────────────────────┬─────────────────────────────────────┘
                           │ read + validate (zod)
                           ▼
┌────────────────────────────────────────────────────────────────┐
│ ENGINE LAYER — Domain logic, no HTTP                           │
│ tools/posthog/schema.ts   — shape validation (zod)             │
│ tools/posthog/sync.ts     — match + apply order + writeback    │
│ tools/posthog/report.ts   — pull insights + render markdown    │
│ tools/posthog/env.ts      — config + secrets                   │
└──────────────────────────┬─────────────────────────────────────┘
                           │ openapi-fetch (typed)
                           ▼
┌────────────────────────────────────────────────────────────────┐
│ TRANSPORT LAYER — Pure PostHog REST wrapper                    │
│ tools/posthog/client.ts                                        │
│ tools/posthog/types/posthog-api.gen.ts (generated)             │
└──────────────────────────┬─────────────────────────────────────┘
                           │ HTTP (Bearer token)
                           ▼
                     PostHog Public API
```

Each layer has one job. The transport layer doesn't know about GTM, slugs, or our taxonomy. The engine layer doesn't know about HTTP shapes. The authoring layer is pure data.

### 4.2 Lifecycle

```
   1. Author edits a JSON file in tools/posthog/
   2. git commit + PR opens
   3. CI: Nx affected detects posthog-tools changed → runs `sync:plan`
        - Soft-skips if POSTHOG_PERSONAL_API_KEY_READONLY not in PR's secrets (forks)
        - Hard-fails if local JSON is invalid or drift detected
   4. Merge to main
   5. Maintainer runs `nx run posthog-tools:sync:apply` locally with write-scoped key
   6. PostHog mutates; engine writes assigned `posthog_id` back into JSON
   7. Maintainer commits the writeback as `chore(posthog): writeback ids for <slugs>`
   8. Every Monday, /gtm Cowork skill runs `nx run posthog-tools:report`
      → docs/gtm/reports/<date>-weekly.md → PR for review + merge
```

### 4.3 File layout

```
tools/posthog/
├── README.md                     # Updated to align with this design
├── project.json                  # NEW: Nx project (sync:plan, sync:apply, report, lint, test)
├── package.json                  # NEW: devDeps (openapi-fetch, openapi-typescript, zod)
├── tsconfig.json                 # NEW: extends root tsconfig
├── eslint.config.mjs             # NEW: minimal eslint config
├── env.ts                        # NEW: zod-validated process.env parsing
├── client.ts                     # NEW: openapi-fetch client (~30 LOC)
├── schema.ts                     # NEW: zod schemas for local JSON shapes
├── sync.ts                       # NEW: CLI — plan / apply / writeback
├── report.ts                     # NEW: CLI — pull insights → markdown
├── *.spec.ts                     # NEW: test files (4)
├── types/
│   ├── README.md                 # NEW: explains why posthog-api.gen.ts is committed
│   └── posthog-api.gen.ts        # NEW: generated TypeScript from OpenAPI
├── scripts/
│   └── generate-types.ts         # NEW: regenerates posthog-api.gen.ts from PostHog spec
├── dashboards/
│   └── developer-funnel.json     # NEW: the sample dashboard
├── insights/
│   ├── pageviews-by-landing.json
│   ├── install-command-clicks.json
│   ├── cockpit-recipe-completion.json
│   └── six-signal-activation-funnel.json
└── cohorts/
    └── .gitkeep                  # NEW: empty for 1A
```

Plus repo-root touches:
- `package.json`: scripts `posthog:sync`, `posthog:report`, `posthog:generate-types`
- `package.json`: devDeps `openapi-fetch`, `openapi-typescript`, `zod`
- `.github/workflows/ci.yml`: new `posthog-sync-plan` job with affected gate + soft-skip
- `.env.example`: documented `POSTHOG_PERSONAL_API_KEY`, `POSTHOG_HOST`, `POSTHOG_PROJECT_ID`
- `gtm.md` §6 / §7: replace `analytics-foundation` row with rows 1A–1D
- `docs/superpowers/specs/gtm/2026-05-13-gtm-meta-design.md` §6: same decomposition
- `tools/posthog/README.md`: align with implemented shape

## 5. Sync engine semantics

### 5.1 Matching local ↔ remote

1. **By `posthog_id`** if local JSON has one.
2. **By case-sensitive `name`** if local has `posthog_id: null` AND exactly one remote artifact has that name. Two-or-more remote name matches force a create (no accidental adoption).
3. No match → create.

After first `--apply`, every artifact has a `posthog_id` and we never fall back to name matching.

### 5.2 Create vs update — no drift computation

```
for each local artifact:
  if posthog_id is null:
    → CREATE  (POST; writeback id)
  else:
    → UPDATE  (PATCH full declarative body; PostHog dedupes)
```

PostHog's PATCH is idempotent. We do not compute drift hashes; we let PostHog decide whether anything actually changed. Tradeoff: `--plan` loses the `[no-op]` category. Acceptable at our scale.

### 5.3 Apply order

```
1. cohorts    (creates first, then updates within tier)
2. insights   (resolves cohort.posthog_id refs before POST/PATCH)
3. dashboards (resolves insight.posthog_id refs in tile list before POST/PATCH)
```

Within each tier, creates before updates.

### 5.4 Slug → posthog_id resolution

When a dashboard references an insight by slug, the engine resolves at apply time:

```ts
function resolveTiles(local: DashboardLocal, allInsights: Map<string, number>): TilePayload[] {
  return local.tiles.map(t => {
    const id = allInsights.get(t.insight);
    if (!id) throw new Error(`dashboards/${local.slug}.json references unknown insight slug "${t.insight}"`);
    return { insight: id };
  });
}
```

### 5.5 Writeback

After successful create: atomic temp-file write + `fs.rename` (POSIX-atomic). Stable 2-space JSON to keep diffs minimal. Skip on `--plan`. If create succeeds but writeback fails, print a recovery hint with the assigned id.

### 5.6 Error semantics

| Mode | On schema failure | On API error | On missing key |
|------|-------------------|--------------|----------------|
| `--plan` | exit 1 | exit 0 + stderr warning | engine: exit 1; CI workflow soft-skips |
| `--apply` | exit 1 | exit 1, partial state allowed | exit 1 |

Partial apply: successful creates keep their writeback. Final summary: *"applied: 2, failed: 1 — see error log."*

### 5.7 Orphans

Orphans (remote artifacts with no local match) are reported in `--plan` output, never auto-deleted. `--apply --delete-orphans` is the only deletion path. Documented in `tools/posthog/README.md` along with the tombstone-JSON alternative.

## 6. Report engine

### 6.1 Flow

```ts
async function generateReport(): Promise<string> {
  const dashboards = (await ph.GET('/dashboards/', { params: { query: { limit: 200 } } }))
    .data.results.filter(d => d.tags?.includes('gtm'));

  const sections: ReportSection[] = [];
  for (const d of dashboards) {
    const rows: ReportRow[] = [];
    for (const tile of d.tiles) {
      const result = await ph.GET('/insights/{id}/', {
        params: { path: { id: tile.insight }, query: { refresh: 'force_cache' } },
      });
      rows.push(extractRow(result.data));
    }
    sections.push({ name: d.name, rows });
  }
  return renderMarkdown(sections, todayUtc());
}
```

### 6.2 Markdown template

```markdown
# GTM weekly snapshot — YYYY-MM-DD

> Generated by `nx run posthog-tools:report`. Notes below are hand-edited.

## <Dashboard name>

| Metric | This week | Last week | Δ | 4-wk |
|--------|----------:|----------:|--:|------|
| ...    |      ...  |     ...   |   |  ▁▂▃▅ |

## Notes

<!-- HUMAN: edit this section before merging the PR. Three bullets max. -->
- _Add observations here before merging._
```

### 6.3 Time windows

- **This week** = trailing 7 days ending at run time, UTC.
- **Last week** = the prior 7 days, UTC.
- **4-wk sparkline** = four most recent complete 7-day buckets, normalized per metric.

### 6.4 Insight kind → row extraction

| Kind | "This week" value |
|------|-------------------|
| `trends` | Sum of event counts in window |
| `funnel` | Count completing final step in window |
| `retention` | Day-7 retention rate (decimal) |
| any other | `?` + stderr warning (no crash) |

### 6.5 Sparkline

```ts
const BARS = ['▁','▂','▃','▄','▅','▆','▇','█'];
function sparkline(values: readonly number[]): string {
  if (!values.length) return '—';
  const max = Math.max(...values, 1);
  return values.map(v => BARS[Math.min(7, Math.round((v / max) * 7))]).join('');
}
```

### 6.6 Output safety

- Always writes a file, even if all values are zero.
- If `<date>-weekly.md` exists, appends `-2`, `-3` — never overwrites.
- Notes section ships with a `<!-- HUMAN: -->` marker.

### 6.7 What the report engine does not do

- No cross-week math beyond the 4-wk sparkline.
- No anomaly detection.
- No commit / no PR. The Cowork skill orchestrates git operations; the engine is a pure function of PostHog.

## 7. Sample dashboard content

### 7.1 `dashboards/developer-funnel.json`

```jsonc
{
  "slug": "developer-funnel",
  "posthog_id": null,
  "name": "GTM · Developer funnel",
  "description": "Pageview → install → cockpit activation. Source: gtm.md §4.",
  "tags": ["gtm", "developer-track", "phase-1"],
  "tiles": [
    { "insight": "pageviews-by-landing" },
    { "insight": "install-command-clicks" },
    { "insight": "cockpit-recipe-completion" },
    { "insight": "six-signal-activation-funnel" }
  ]
}
```

### 7.2 Four insight JSONs

**`insights/pageviews-by-landing.json`** — top of funnel; `$pageview` totals by `$pathname`, 30d/daily.

**`insights/install-command-clicks.json`** — developer-track CTA signal; `marketing:cta_click` filtered to `track=developer`, broken out by `cta_id`, 30d/daily.

**`insights/cockpit-recipe-completion.json`** — mid-funnel; two trends (`cockpit:recipe_start`, `cockpit:chat_first_message`), 30d/daily. Will be zero until Spec 1C ships.

**`insights/six-signal-activation-funnel.json`** — north-star funnel; the six cockpit signals in order, 30-minute window, 30d. Will be zero until Spec 1C ships.

### 7.3 What's not in 1A's content

- No cohorts (`cohorts/` ships empty with `.gitkeep`).
- No retention insights.
- The other 4 dashboards (`enterprise-funnel`, `activation-six-signals` expanded, `content-intent`, `package-telemetry`) are explicitly deferred to a follow-up `dashboards-content` spec after 1B/1C/1D unlock their events.

## 8. Tooling decisions (locked)

| Decision | Choice |
|----------|--------|
| TS runtime | `tsx` (already in deps) |
| API client | `openapi-fetch` (~3KB runtime) |
| Types | `openapi-typescript` (generated, committed) |
| Schema validation | `zod` (local JSON only) |
| Drift detection | None (always-PATCH; PostHog dedupes) |
| Test runner | `tsx --test` (Node built-in) |
| Auth | Single write-scoped `POSTHOG_PERSONAL_API_KEY` in local `.env` + GitHub Actions secrets. Read-only CI key deferred (production hardening TODO) |
| CI gating | Nx affected + soft-skip on missing secret |

## 9. Nx integration

### 9.1 `tools/posthog/project.json`

```jsonc
{
  "name": "posthog-tools",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "tools/posthog",
  "projectType": "library",
  "tags": ["scope:gtm", "type:tool"],
  "namedInputs": {
    "taxonomy": ["{workspaceRoot}/docs/gtm/taxonomy.md"]
  },
  "targets": {
    "lint":  { "executor": "@nx/eslint:lint" },
    "test":  { "executor": "nx:run-commands",
               "options": { "command": "npx tsx --test tools/posthog/*.spec.ts" } },
    "sync:plan":  { "executor": "nx:run-commands",
                    "inputs": ["default", "taxonomy"],
                    "options": { "command": "npx tsx tools/posthog/sync.ts --plan" } },
    "sync:apply": { "executor": "nx:run-commands",
                    "inputs": ["default", "taxonomy"],
                    "options": { "command": "npx tsx tools/posthog/sync.ts --apply" } },
    "report":     { "executor": "nx:run-commands",
                    "options": { "command": "npx tsx tools/posthog/report.ts" } },
    "generate-types": { "executor": "nx:run-commands",
                        "options": { "command": "npx tsx tools/posthog/scripts/generate-types.ts" } }
  }
}
```

`namedInputs.taxonomy` ensures edits to `docs/gtm/taxonomy.md` mark `posthog-tools` as affected — keeps event references honest.

### 9.2 CI workflow job

```yaml
posthog-sync-plan:
  name: PostHog — dashboards-as-code drift check
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
      with: { fetch-depth: 0 }
    - uses: actions/setup-node@v4
      with: { node-version: '20', cache: 'npm' }
    - run: npm ci
    - name: Detect affected
      id: affected
      run: |
        base_sha=$(git merge-base origin/main HEAD)
        head_sha=$(git rev-parse HEAD)
        affected="$(npx nx show projects --affected --base=$base_sha --head=$head_sha)"
        if printf '%s\n' "$affected" | grep -Fx 'posthog-tools' >/dev/null; then
          echo "is_affected=yes" >> "$GITHUB_OUTPUT"
        else
          echo "is_affected=no" >> "$GITHUB_OUTPUT"
        fi
    - name: posthog:sync --plan
      if: steps.affected.outputs.is_affected == 'yes'
      env:
        POSTHOG_PERSONAL_API_KEY: ${{ secrets.POSTHOG_PERSONAL_API_KEY }}
        POSTHOG_HOST:             https://us.i.posthog.com
        POSTHOG_PROJECT_ID:       ${{ secrets.POSTHOG_PROJECT_ID }}
      run: |
        if [ -z "$POSTHOG_PERSONAL_API_KEY" ]; then
          echo "::notice::POSTHOG_PERSONAL_API_KEY not set — soft skip for contributor PRs."
          exit 0
        fi
        npx nx run posthog-tools:sync:plan
```

Two gates: Nx-affected (skip if irrelevant) + secret availability (skip on forks).

## 10. Testing strategy

### 10.1 Surfaces

| Surface | File | Style | Approx tests |
|---------|------|-------|--------------|
| Schema | `schema.spec.ts` | Unit + fixture validator | 6 |
| Sync engine | `sync.spec.ts` | Unit with fake openapi-fetch client | 8 |
| Report engine | `report.spec.ts` | Unit (pure functions) | 7 |
| Taxonomy guard | `taxonomy.spec.ts` | Permanent contract test | 1 |
| **Total** | | | **~22 tests** |

### 10.2 Critical behaviors covered

- Every committed JSON file parses against its zod schema (fixture validator).
- First apply creates all artifacts and writes back `posthog_id` to disk.
- Apply order: insights POSTed before dashboards.
- Second apply with same JSON makes only PATCH calls, no POST.
- Dashboard tile referencing unknown insight slug throws clearly.
- `--plan` never writes to disk.
- Writeback is atomic (crash mid-write leaves file intact).
- Apply continues past one failure; partial success reported.
- Orphans reported, never auto-deleted.
- Sparkline math (empty, all-zero, normalization, edge cases).
- Markdown template structure (header, Notes section, HUMAN marker).
- Week-over-week delta with zero last-week reports "new" not "+Inf%".
- **Permanent taxonomy guard: every event referenced in any insight JSON is documented in `docs/gtm/taxonomy.md`.**

### 10.3 What we deliberately don't test

- `openapi-fetch` transport against real PostHog (too flaky in CI, requires secrets).
- Generated types regeneration (build catches invalid output).
- Nx project targets themselves (CI exercises them).
- `--apply` end-to-end against real PostHog (manual maintainer step on first apply + Chrome MCP verification post-merge).

## 11. Risks & non-goals

### 11.1 Risks

| # | Risk | Mitigation |
|--:|------|------------|
| 1 | PostHog OpenAPI spec drift between regenerations | Quarterly regeneration is a documented maintenance task. Type errors surface at compile time, not runtime. |
| 2 | Write-scoped `POSTHOG_PERSONAL_API_KEY` in CI is broad | CI only runs `--plan` (read-only effect even with write key). Documented production-hardening TODO. |
| 3 | Always-PATCH masks subtle drift | PATCH response is shape-checked; taxonomy guard catches event renames; hash-based diff can be added later. |
| 4 | Slug rename loses `posthog_id` linkage | Documented rename procedure (edit slug, keep posthog_id, do not move the file). |
| 5 | Writeback creates noisy commits | `--apply` prints the exact `git commit` command on completion. |
| 6 | PostHog API rate limits | Client retries 429 with exponential backoff (3 attempts, max 8s). |
| 7 | Time zones in weekly windows confuse maintainers | Documented as UTC. Notes section handles time-zone-sensitive observations. |
| 8 | Generated artifact in source control | README at `tools/posthog/types/README.md` explains the choice. |

### 11.2 Risks deferred (out of scope but real)

- Only 1 dashboard ships; "5 dashboards live" exit gate met by 1A + follow-up `dashboards-content` spec.
- No cohorts ship.
- `/api/ingest` reverse proxy lands in Spec 1D.
- Read-only CI key deferred.
- No auto-merge of weekly snapshot PRs.

### 11.3 Non-goals (Spec 1A)

- No telemetry library code (Spec 1B).
- No cockpit instrumentation (Spec 1C).
- No website analytics modifications (Spec 1D).
- No remaining 4 dashboards (follow-up).
- No feature flags / experiments / session replay sync.
- No generic PostHog SDK — `client.ts` is scoped to ~10 endpoints.
- No auto-merge of report PRs.

## 12. Deliverables of this spec

Implementation plan (`docs/superpowers/plans/gtm/2026-05-14-analytics-foundation-1a-dashboards-as-code.md`) checks off:

- [ ] **Decomposition update first** — `gtm.md §6` / §7 and meta-spec §6 reflect 1A–1D (otherwise downstream readers see stale "analytics-foundation" row).
- [ ] `tools/posthog/{project,package,tsconfig}.json` + lint config + Nx wiring
- [ ] `openapi-typescript` regeneration script + `posthog-api.gen.ts` committed
- [ ] `client.ts` (openapi-fetch instance, ~30 LOC)
- [ ] `env.ts` (zod-validated env vars)
- [ ] `schema.ts` (zod schemas for dashboard/insight/cohort local shapes)
- [ ] `sync.ts` with `--plan` / `--apply` / `--delete-orphans` / writeback (~250 LOC)
- [ ] `report.ts` with markdown template + sparkline + 7-day windows (~150 LOC)
- [ ] `dashboards/developer-funnel.json` + 4 `insights/*.json`
- [ ] `cohorts/.gitkeep`
- [ ] Test files: `schema.spec.ts`, `sync.spec.ts`, `report.spec.ts`, `taxonomy.spec.ts` (~22 tests)
- [ ] Root `package.json` script aliases + dev deps
- [ ] `.env.example` documented env vars
- [ ] `.github/workflows/ci.yml` new `posthog-sync-plan` job (Nx-affected + soft-skip)
- [ ] `tools/posthog/README.md` updates aligning with this design (drop `$schema` JSON Schema references; align CLI commands with `nx run posthog-tools:*`; document write-scoped key + read-only CI key TODO)
- [ ] Chrome MCP end-to-end verification: after `--apply` runs (locally or in CI), navigate to the rendered dashboard in PostHog and confirm 1 dashboard + 4 tiles render.

## 13. References

- Parent spec: [docs/superpowers/specs/gtm/2026-05-13-gtm-meta-design.md](2026-05-13-gtm-meta-design.md)
- Strategy: [gtm.md](../../../../gtm.md)
- Taxonomy (contract): [docs/gtm/taxonomy.md](../../../gtm/taxonomy.md)
- Cowork skill that runs this CLI: [cowork/gtm/SKILL.md](../../../../cowork/gtm/SKILL.md)
- PostHog OpenAPI: `https://us.posthog.com/api/schema/`
- `openapi-fetch`: https://openapi-ts.dev/openapi-fetch/
- `openapi-typescript`: https://openapi-ts.dev/
- Subsumed: [docs/superpowers/plans/2026-05-02-posthog-gtm-analytics.md](../../../superpowers/plans/2026-05-02-posthog-gtm-analytics.md) — May-2 instrumentation plan, partly shipped on the website. Spec 1D handles reconciliation; Spec 1A is independent of that work.
