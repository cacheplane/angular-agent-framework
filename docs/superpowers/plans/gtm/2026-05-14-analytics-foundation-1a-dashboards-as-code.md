# Analytics Foundation 1A — Dashboards-as-code Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a typed, Nx-integrated PostHog dashboards-as-code pipeline (`sync` + `report` CLIs) plus one sample dashboard (`developer-funnel`) as round-trip proof, with Nx-affected CI gating and a permanent taxonomy guard test.

**Architecture:** Three layers — authoring (JSON files), engine (zod schema + sync/report TS), transport (openapi-fetch over PostHog's OpenAPI-generated types). Sync uses `posthog_id` writeback for stable matching and always-PATCH for updates (PostHog dedupes; we don't compute drift). New Nx project `posthog-tools` at `tools/posthog/`; CI gate uses `nx show projects --affected`.

**Tech Stack:** TypeScript via `tsx`; `openapi-fetch` (typed HTTP); `openapi-typescript` (generated types); `zod` (local JSON validation); Node built-in `node:test`; Nx 21.x; GitHub Actions.

---

## Context for the implementer

- **Spec:** `docs/superpowers/specs/gtm/2026-05-14-analytics-foundation-1a-dashboards-as-code-design.md`. Read §4–§11 before starting any task. Anchor source of truth.
- **Parent meta-spec:** `docs/superpowers/specs/gtm/2026-05-13-gtm-meta-design.md`. Read §7 (analytics architecture) for the original design context.
- **Existing taxonomy:** `docs/gtm/taxonomy.md`. Every event referenced in insight JSONs must appear there. The permanent guard test enforces this.
- **Existing README:** `tools/posthog/README.md` was authored speculatively in Spec 0; Task 17 of this plan aligns it with what's actually implemented.
- **PostHog access:** subagents do NOT have `POSTHOG_PERSONAL_API_KEY`. Tasks 1–17 are all completable without it. Task 18 (first `--apply`) is a manual maintainer step. Task 19 (Chrome MCP verification) happens after the human runs Task 18.
- **TDD discipline:** every code task follows write-test → run-and-fail → implement → run-and-pass → commit. Subagents must not skip the failing-test step.
- **Commits:** small, frequent, conventional. After each task: one commit (or two if a writeback is needed). Commit message format matches existing repo: `feat(posthog-tools): ...` / `test(posthog-tools): ...` / `chore(gtm): ...`.

## File structure (locked)

Created or modified by this plan:

```
tools/posthog/
├── README.md                         # MODIFY (Task 17)
├── project.json                      # CREATE (Task 3)
├── package.json                      # CREATE (Task 3)
├── tsconfig.json                     # CREATE (Task 3)
├── eslint.config.mjs                 # CREATE (Task 3)
├── env.ts                            # CREATE (Task 5)
├── env.spec.ts                       # CREATE (Task 5)
├── schema.ts                         # CREATE (Task 6)
├── schema.spec.ts                    # CREATE (Task 6)
├── client.ts                         # CREATE (Task 7)
├── sync.ts                           # CREATE (Tasks 8 + 9 + 10)
├── sync.spec.ts                      # CREATE (Tasks 8 + 9)
├── report.ts                         # CREATE (Tasks 11 + 12)
├── report.spec.ts                    # CREATE (Tasks 11 + 12)
├── taxonomy.spec.ts                  # CREATE (Task 14)
├── types/
│   ├── README.md                     # CREATE (Task 4)
│   └── posthog-api.gen.ts            # CREATE generated (Task 4)
├── scripts/
│   └── generate-types.ts             # CREATE (Task 4)
├── dashboards/
│   └── developer-funnel.json         # CREATE (Task 13)
├── insights/
│   ├── pageviews-by-landing.json
│   ├── install-command-clicks.json
│   ├── cockpit-recipe-completion.json
│   └── six-signal-activation-funnel.json
└── cohorts/
    └── .gitkeep                      # CREATE (Task 13)

gtm.md                                # MODIFY §6 + §7 (Task 1)
docs/superpowers/specs/gtm/2026-05-13-gtm-meta-design.md   # MODIFY §6 (Task 1)
package.json                          # MODIFY scripts + devDeps (Tasks 2, 15)
.env.example                          # CREATE/MODIFY (Task 15)
.github/workflows/ci.yml              # MODIFY add posthog-sync-plan job (Task 16)
```

---

## Task 1: Decomposition update — gtm.md §6/§7 and meta-spec §6 reflect 1A–1D

**Files:**
- Modify: `gtm.md` §6 (phases table) and §7 (workstream agents table)
- Modify: `docs/superpowers/specs/gtm/2026-05-13-gtm-meta-design.md` §6 (workstream decomposition table)

### Step 1.1 — Update `gtm.md` §6 phases table

- [ ] Open `gtm.md`. Find the §6 phases table row for Phase 0 (currently reads `analytics-foundation`).
- [ ] Replace that row's "Specs" cell with `analytics-foundation-1a (dashboards-as-code), 1b (telemetry library), 1c (cockpit instrumentation), 1d (website reconciliation)`.

The full row should read:

```markdown
| 0     | Measurement foundation        | analytics-foundation-1a, 1b, 1c, 1d                                     | 5 dashboards live, 3 event namespaces emitting, `@ngaf/telemetry@0.0.1` published, weekly report runnable. |
```

### Step 1.2 — Update `gtm.md` §7 workstream agents table

- [ ] Find the `analytics-foundation` row in §7. Replace it with four rows for 1A–1D.

The new rows:

```markdown
| 0     | analytics-foundation-1a    | `cowork/gtm/SKILL.md`                     | [spec](docs/superpowers/specs/gtm/2026-05-14-analytics-foundation-1a-dashboards-as-code-design.md) | `developer-funnel` (sample)  |
| 0     | analytics-foundation-1b    | `cowork/gtm/SKILL.md`                     | (pending)                                                                      | `package-telemetry`        |
| 0     | analytics-foundation-1c    | `cowork/gtm/SKILL.md`                     | (pending)                                                                      | `activation-six-signals`   |
| 0     | analytics-foundation-1d    | `cowork/gtm/SKILL.md`                     | (pending)                                                                      | `enterprise-funnel`        |
```

### Step 1.3 — Update meta-spec §6 workstream table

- [ ] Open `docs/superpowers/specs/gtm/2026-05-13-gtm-meta-design.md`. Find the §6 table with column header `# | Spec | Phase | Depends on | Exit`. Replace the row for `analytics-foundation` (currently row 1) with four rows:

```markdown
| 1a | analytics-foundation-1a — dashboards-as-code  | 0 | — | Sync CLI works locally; `developer-funnel` dashboard renders in PostHog after `--apply`; CI affected gate green. |
| 1b | analytics-foundation-1b — `@ngaf/telemetry`    | 0 | — | `@ngaf/telemetry@0.0.1` on npm; Node opt-out + browser opt-in surfaces ship; trust-contract silence test stays green. |
| 1c | analytics-foundation-1c — cockpit instrumentation | 0 | 1b | All six cockpit signals fire; `cockpit:six_signals_complete` aggregation works. |
| 1d | analytics-foundation-1d — website reconciliation  | 0 | — | Audit of May-2 plan complete; `marketing:lead_qualified` server enrichment ships; `/api/ingest` proxy live. |
```

Renumber the table's row numbers below (was 2,3,4,5,6,7 → now 2,3,4,5,6,7 remain identical since we replaced row 1 with rows 1a-1d).

### Step 1.4 — Verify and commit

- [ ] Run: `grep -n "analytics-foundation" gtm.md docs/superpowers/specs/gtm/2026-05-13-gtm-meta-design.md`

Expected: every match references `-1a`, `-1b`, `-1c`, or `-1d`. No bare `analytics-foundation` (without sub-suffix) remains except in headings/prose where it refers to the parent.

- [ ] Commit:

```bash
git add gtm.md docs/superpowers/specs/gtm/2026-05-13-gtm-meta-design.md
git commit -m "$(cat <<'EOF'
chore(gtm): decompose analytics-foundation into 1a-1d sub-specs

Updates gtm.md §6/§7 and meta-spec §6 to reflect the 4-spec decomposition
agreed during Spec 1A brainstorm.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Add workspace devDependencies

**Files:**
- Modify: `package.json` (root)
- Modify: `package-lock.json` (root, auto)

The repo uses npm workspaces and the user's persistent memory says: **never regenerate package-lock.json on macOS** (drops Linux @next/swc-* bindings, breaks CI). Use targeted `npm install <pkg>` commands; npm preserves existing lockfile entries.

### Step 2.1 — Install the three devDeps explicitly

- [ ] From repo root, run:

```bash
npm install --save-dev --workspaces=false openapi-fetch@^0.13.0 openapi-typescript@^7.4.0 zod@^3.23.0
```

The `--workspaces=false` flag scopes install to the root package only (we don't want these inside every workspace).

### Step 2.2 — Verify lockfile diff is bounded

- [ ] Run:

```bash
git diff --stat package.json package-lock.json
```

Expected: `package.json` shows 3 added lines under `devDependencies`. `package-lock.json` shows additions for the 3 packages and their dependencies, **no deletions of `@next/swc-linux-*` bindings**.

- [ ] If deletions appear, **STOP**. Restore the lockfile (`git checkout package-lock.json`) and re-run with `--no-save` then manually edit package.json (per the project memory note about platform bindings).

### Step 2.3 — Commit

- [ ] Run:

```bash
git add package.json package-lock.json
git commit -m "$(cat <<'EOF'
chore(deps): add openapi-fetch, openapi-typescript, zod for posthog-tools

Devdeps for the Spec 1A dashboards-as-code pipeline.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Nx project scaffold for `posthog-tools`

**Files:**
- Create: `tools/posthog/package.json`
- Create: `tools/posthog/tsconfig.json`
- Create: `tools/posthog/project.json`
- Create: `tools/posthog/eslint.config.mjs`

### Step 3.1 — Create `tools/posthog/package.json`

- [ ] Write file:

```json
{
  "name": "@ngaf/posthog-tools",
  "private": true,
  "version": "0.0.0",
  "type": "module"
}
```

### Step 3.2 — Create `tools/posthog/tsconfig.json`

- [ ] Write file:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "esnext",
    "moduleResolution": "bundler",
    "target": "es2022",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true,
    "resolveJsonModule": true
  },
  "include": ["**/*.ts"],
  "exclude": ["node_modules"]
}
```

### Step 3.3 — Create `tools/posthog/project.json`

- [ ] Write file:

```json
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
    "lint": {
      "executor": "@nx/eslint:lint"
    },
    "test": {
      "executor": "nx:run-commands",
      "options": {
        "command": "npx tsx --test tools/posthog/*.spec.ts"
      }
    },
    "sync:plan": {
      "executor": "nx:run-commands",
      "inputs": ["default", "taxonomy"],
      "options": {
        "command": "npx tsx tools/posthog/sync.ts --plan"
      }
    },
    "sync:apply": {
      "executor": "nx:run-commands",
      "inputs": ["default", "taxonomy"],
      "options": {
        "command": "npx tsx tools/posthog/sync.ts --apply"
      }
    },
    "report": {
      "executor": "nx:run-commands",
      "options": {
        "command": "npx tsx tools/posthog/report.ts"
      }
    },
    "generate-types": {
      "executor": "nx:run-commands",
      "options": {
        "command": "npx tsx tools/posthog/scripts/generate-types.ts"
      }
    }
  }
}
```

### Step 3.4 — Create `tools/posthog/eslint.config.mjs`

- [ ] Write file:

```javascript
import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn'
    }
  },
  {
    files: ['**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off'
    }
  }
];
```

### Step 3.5 — Verify Nx recognizes the project

- [ ] Run:

```bash
npx nx show projects | grep -Fx posthog-tools
```

Expected: prints `posthog-tools`. If it doesn't, check the JSON files for syntax errors.

- [ ] Run:

```bash
npx nx show project posthog-tools --json | head -30
```

Expected: JSON output showing the targets (`lint`, `test`, `sync:plan`, `sync:apply`, `report`, `generate-types`).

### Step 3.6 — Commit

- [ ] Run:

```bash
git add tools/posthog/{package,tsconfig,project}.json tools/posthog/eslint.config.mjs
git commit -m "$(cat <<'EOF'
feat(posthog-tools): scaffold Nx project with sync/report/test targets

namedInputs.taxonomy includes docs/gtm/taxonomy.md so taxonomy edits
mark this project as affected.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Generate PostHog API types from OpenAPI spec

**Files:**
- Create: `tools/posthog/scripts/generate-types.ts`
- Create: `tools/posthog/types/README.md`
- Create: `tools/posthog/types/posthog-api.gen.ts` (generated)

### Step 4.1 — Write the generator script

- [ ] Create `tools/posthog/scripts/generate-types.ts`:

```typescript
#!/usr/bin/env tsx
/**
 * Regenerates tools/posthog/types/posthog-api.gen.ts from PostHog's published
 * OpenAPI spec. Run quarterly or whenever PostHog changes their API surface.
 *
 * Usage: nx run posthog-tools:generate-types
 */
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import openapiTS, { astToString } from 'openapi-typescript';

const POSTHOG_SCHEMA_URL = 'https://us.posthog.com/api/schema/';
const OUTPUT_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'types',
  'posthog-api.gen.ts',
);

async function main(): Promise<void> {
  console.log(`Fetching OpenAPI spec from ${POSTHOG_SCHEMA_URL}...`);
  const ast = await openapiTS(new URL(POSTHOG_SCHEMA_URL));
  const contents = astToString(ast);
  const header = `/* eslint-disable */\n// Generated by tools/posthog/scripts/generate-types.ts.\n// DO NOT EDIT MANUALLY. Run: npx nx run posthog-tools:generate-types\n// Source: ${POSTHOG_SCHEMA_URL}\n\n`;
  await writeFile(OUTPUT_PATH, header + contents, 'utf8');
  console.log(`Wrote ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

### Step 4.2 — Write the types README

- [ ] Create `tools/posthog/types/README.md`:

```markdown
# Generated PostHog API types

`posthog-api.gen.ts` is generated from PostHog's published OpenAPI spec at
https://us.posthog.com/api/schema/. It is committed to the repo deliberately:

- Avoids a build-time network call to PostHog (faster, more reliable).
- Makes type-shift visible in PRs (you can `git blame` field renames).
- Keeps `tsx` startup fast (no runtime codegen step).

## Regenerating

Run quarterly or whenever PostHog announces an API change:

```bash
npx nx run posthog-tools:generate-types
```

This rewrites `posthog-api.gen.ts` in place. Commit the diff if PostHog's API
changed; review the diff carefully — field renames or required-field additions
will surface here.
```

### Step 4.3 — Run the generator

- [ ] Run:

```bash
npx tsx tools/posthog/scripts/generate-types.ts
```

Expected output:
```
Fetching OpenAPI spec from https://us.posthog.com/api/schema/...
Wrote /Users/blove/repos/.../tools/posthog/types/posthog-api.gen.ts
```

The generated file should be 5,000–50,000 lines depending on PostHog's current spec size. If it's under 1000 lines, the fetch likely returned an error page — inspect the file.

### Step 4.4 — Verify the generated types compile

- [ ] Run:

```bash
npx tsc --noEmit --project tools/posthog/tsconfig.json
```

Expected: no errors. (At this stage there's no consumer code yet; this just confirms the generated file is syntactically valid TypeScript.)

### Step 4.5 — Commit

- [ ] Run:

```bash
git add tools/posthog/scripts/generate-types.ts tools/posthog/types/
git commit -m "$(cat <<'EOF'
feat(posthog-tools): add OpenAPI type generation + initial types

Commits the generated posthog-api.gen.ts. Regenerate quarterly via
nx run posthog-tools:generate-types.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `env.ts` with TDD

**Files:**
- Create: `tools/posthog/env.spec.ts`
- Create: `tools/posthog/env.ts`

### Step 5.1 — Write the failing test

- [ ] Create `tools/posthog/env.spec.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseEnv } from './env.js';

test('parseEnv accepts a valid environment', () => {
  const env = parseEnv({
    POSTHOG_PERSONAL_API_KEY: 'phx_'.padEnd(40, 'a'),
    POSTHOG_PROJECT_ID: '12345',
  });
  assert.equal(env.POSTHOG_PERSONAL_API_KEY, 'phx_'.padEnd(40, 'a'));
  assert.equal(env.POSTHOG_HOST, 'https://us.i.posthog.com');
  assert.equal(env.POSTHOG_PROJECT_ID, 12345);
});

test('parseEnv coerces POSTHOG_PROJECT_ID to a number', () => {
  const env = parseEnv({
    POSTHOG_PERSONAL_API_KEY: 'phx_'.padEnd(40, 'a'),
    POSTHOG_PROJECT_ID: '987',
  });
  assert.equal(env.POSTHOG_PROJECT_ID, 987);
  assert.equal(typeof env.POSTHOG_PROJECT_ID, 'number');
});

test('parseEnv respects POSTHOG_HOST override', () => {
  const env = parseEnv({
    POSTHOG_PERSONAL_API_KEY: 'phx_'.padEnd(40, 'a'),
    POSTHOG_PROJECT_ID: '12345',
    POSTHOG_HOST: 'https://eu.i.posthog.com',
  });
  assert.equal(env.POSTHOG_HOST, 'https://eu.i.posthog.com');
});

test('parseEnv throws on missing required POSTHOG_PERSONAL_API_KEY', () => {
  assert.throws(
    () => parseEnv({ POSTHOG_PROJECT_ID: '12345' }),
    /POSTHOG_PERSONAL_API_KEY/,
  );
});

test('parseEnv throws on short key', () => {
  assert.throws(
    () => parseEnv({ POSTHOG_PERSONAL_API_KEY: 'short', POSTHOG_PROJECT_ID: '1' }),
    /POSTHOG_PERSONAL_API_KEY/,
  );
});

test('parseEnv throws on non-numeric POSTHOG_PROJECT_ID', () => {
  assert.throws(
    () => parseEnv({ POSTHOG_PERSONAL_API_KEY: 'phx_'.padEnd(40, 'a'), POSTHOG_PROJECT_ID: 'abc' }),
    /POSTHOG_PROJECT_ID/,
  );
});
```

### Step 5.2 — Run the test, see it fail

- [ ] Run:

```bash
npx tsx --test tools/posthog/env.spec.ts
```

Expected: ERROR — cannot resolve module `./env.js`.

### Step 5.3 — Implement `env.ts`

- [ ] Create `tools/posthog/env.ts`:

```typescript
import { z } from 'zod';

const envSchema = z.object({
  POSTHOG_PERSONAL_API_KEY: z
    .string()
    .min(20, 'POSTHOG_PERSONAL_API_KEY must be at least 20 characters'),
  POSTHOG_HOST: z
    .string()
    .url()
    .default('https://us.i.posthog.com'),
  POSTHOG_PROJECT_ID: z.coerce
    .number({ invalid_type_error: 'POSTHOG_PROJECT_ID must be numeric' })
    .int('POSTHOG_PROJECT_ID must be an integer')
    .positive('POSTHOG_PROJECT_ID must be positive'),
});

export type PosthogEnv = z.infer<typeof envSchema>;

export function parseEnv(source: NodeJS.ProcessEnv | Record<string, string | undefined>): PosthogEnv {
  return envSchema.parse(source);
}

// Lazy singleton for runtime use. Tests pass their own source to parseEnv directly.
let cached: PosthogEnv | null = null;
export function env(): PosthogEnv {
  if (!cached) cached = parseEnv(process.env);
  return cached;
}
```

### Step 5.4 — Run the test, see it pass

- [ ] Run:

```bash
npx tsx --test tools/posthog/env.spec.ts
```

Expected: `✔ 6 tests passing`.

### Step 5.5 — Commit

- [ ] Run:

```bash
git add tools/posthog/env.ts tools/posthog/env.spec.ts
git commit -m "$(cat <<'EOF'
feat(posthog-tools): env.ts with zod-validated POSTHOG_* parsing

6 tests covering required key, host default, project id coercion,
and rejection of missing/short/non-numeric values.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: `schema.ts` (zod schemas for local JSON shapes) with TDD

**Files:**
- Create: `tools/posthog/schema.spec.ts`
- Create: `tools/posthog/schema.ts`

### Step 6.1 — Write the failing test

- [ ] Create `tools/posthog/schema.spec.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { glob } from 'node:fs/promises';
import { join } from 'node:path';
import { DashboardLocal, InsightLocal, CohortLocal } from './schema.js';

const TOOLS_POSTHOG = new URL('.', import.meta.url).pathname;

test('DashboardLocal accepts minimal valid input', () => {
  const result = DashboardLocal.safeParse({
    slug: 'developer-funnel',
    posthog_id: null,
    name: 'GTM · Developer funnel',
    description: 'Pageview → install → activation.',
    tiles: [{ insight: 'pageviews-by-landing' }],
  });
  assert.equal(result.success, true);
  if (result.success) assert.deepEqual(result.data.tags, []);  // default
});

test('DashboardLocal rejects uppercase slug', () => {
  const result = DashboardLocal.safeParse({
    slug: 'Bad-Slug',
    posthog_id: null,
    name: 'x',
    description: 'x',
    tiles: [],
  });
  assert.equal(result.success, false);
});

test('InsightLocal accepts a trend with breakdown', () => {
  const result = InsightLocal.safeParse({
    slug: 'pageviews-by-landing',
    posthog_id: null,
    kind: 'trends',
    name: 'Pageviews by landing path',
    events: [{ event: '$pageview', math: 'total' }],
    breakdown: '$pathname',
    date_from: '-30d',
  });
  assert.equal(result.success, true);
});

test('InsightLocal funnel requires steps', () => {
  const result = InsightLocal.safeParse({
    slug: 'six-signal',
    posthog_id: null,
    kind: 'funnel',
    name: 'six',
    window_minutes: 30,
    date_from: '-30d',
  });
  assert.equal(result.success, false);
});

test('InsightLocal funnel with steps validates', () => {
  const result = InsightLocal.safeParse({
    slug: 'six-signal',
    posthog_id: null,
    kind: 'funnel',
    name: 'six',
    window_minutes: 30,
    steps: [{ event: 'cockpit:install_command_copied' }],
    date_from: '-30d',
  });
  assert.equal(result.success, true);
});

test('CohortLocal accepts pass-through query', () => {
  const result = CohortLocal.safeParse({
    slug: 'activated-developers',
    posthog_id: null,
    name: 'Activated developers',
    description: 'last 30d',
    query: { kind: 'ActorsQuery', source: {} },
  });
  assert.equal(result.success, true);
});

test('every committed JSON in dashboards/insights/cohorts parses', async () => {
  const root = TOOLS_POSTHOG;
  const checks = [
    { dir: 'dashboards', schema: DashboardLocal },
    { dir: 'insights', schema: InsightLocal },
    { dir: 'cohorts', schema: CohortLocal },
  ];
  for (const { dir, schema } of checks) {
    for await (const path of glob(`${join(root, dir)}/*.json`)) {
      const json = JSON.parse(await readFile(path, 'utf8'));
      const result = schema.safeParse(json);
      assert.equal(result.success, true, `${path}: ${result.success ? '' : JSON.stringify(result.error.issues)}`);
    }
  }
});
```

### Step 6.2 — Run, see fail

- [ ] Run:

```bash
npx tsx --test tools/posthog/schema.spec.ts
```

Expected: ERROR — cannot resolve `./schema.js`.

### Step 6.3 — Implement `schema.ts`

- [ ] Create `tools/posthog/schema.ts`:

```typescript
import { z } from 'zod';

const slug = z.string().regex(/^[a-z0-9-]+$/, 'slug must be lowercase kebab-case');

export const DashboardLocal = z.object({
  slug,
  posthog_id: z.number().nullable(),
  name: z.string().min(1),
  description: z.string(),
  tags: z.array(z.string()).default([]),
  tiles: z.array(z.object({ insight: z.string() })),
});
export type DashboardLocal = z.infer<typeof DashboardLocal>;

export const InsightLocal = z
  .object({
    slug,
    posthog_id: z.number().nullable(),
    kind: z.enum(['trends', 'funnel', 'retention']),
    name: z.string().min(1),
    // trends-specific
    events: z
      .array(
        z.object({
          event: z.string(),
          math: z.enum(['total', 'dau', 'unique_session']).optional(),
          properties: z
            .array(
              z.object({
                key: z.string(),
                value: z.union([z.string(), z.number(), z.boolean()]),
                operator: z.enum(['exact', 'is_not', 'icontains']).default('exact'),
              }),
            )
            .optional(),
        }),
      )
      .optional(),
    breakdown: z.string().optional(),
    breakdown_limit: z.number().int().positive().optional(),
    interval: z.enum(['minute', 'hour', 'day', 'week', 'month']).default('day'),
    // funnel-specific
    window_minutes: z.number().int().positive().optional(),
    steps: z
      .array(z.object({ event: z.string(), name: z.string().optional() }))
      .optional(),
    date_from: z.string().default('-30d'),
  })
  .refine((v) => (v.kind === 'funnel' ? Array.isArray(v.steps) && v.steps.length > 0 : true), {
    message: 'funnel insights require non-empty steps',
    path: ['steps'],
  });
export type InsightLocal = z.infer<typeof InsightLocal>;

export const CohortLocal = z.object({
  slug,
  posthog_id: z.number().nullable(),
  name: z.string().min(1),
  description: z.string(),
  query: z.unknown(),
});
export type CohortLocal = z.infer<typeof CohortLocal>;
```

### Step 6.4 — Run, see pass

- [ ] Run:

```bash
npx tsx --test tools/posthog/schema.spec.ts
```

Expected: `✔ 7 tests passing`. (Final test scans `dashboards/insights/cohorts` — they don't exist yet, so the loop is empty and the test passes trivially.)

### Step 6.5 — Commit

```bash
git add tools/posthog/schema.ts tools/posthog/schema.spec.ts
git commit -m "$(cat <<'EOF'
feat(posthog-tools): zod schemas for dashboard/insight/cohort JSON

Schemas validate slug format, required fields, funnel-specific
constraints. Fixture validator parses every committed JSON file.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: `client.ts` — openapi-fetch wrapper with 429 retry

**Files:**
- Create: `tools/posthog/client.ts`

### Step 7.1 — Implement

- [ ] Create `tools/posthog/client.ts`:

```typescript
import createClient, { type Middleware } from 'openapi-fetch';
import type { paths } from './types/posthog-api.gen.js';
import { env } from './env.js';

const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);
const MAX_ATTEMPTS = 3;

const retryMiddleware: Middleware = {
  async onResponse({ response, request }) {
    let attempt = 1;
    let res = response;
    while (RETRYABLE_STATUSES.has(res.status) && attempt < MAX_ATTEMPTS) {
      const backoffMs = Math.min(8000, 500 * 2 ** (attempt - 1));
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
      res = await fetch(request.clone());
      attempt += 1;
    }
    return res;
  },
};

export function createPosthogClient() {
  const e = env();
  const client = createClient<paths>({
    baseUrl: `${e.POSTHOG_HOST}/api/projects/${e.POSTHOG_PROJECT_ID}`,
    headers: {
      Authorization: `Bearer ${e.POSTHOG_PERSONAL_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });
  client.use(retryMiddleware);
  return client;
}

// Lazy singleton.
let cached: ReturnType<typeof createPosthogClient> | null = null;
export function ph() {
  if (!cached) cached = createPosthogClient();
  return cached;
}
```

### Step 7.2 — Sanity check it compiles

- [ ] Run:

```bash
npx tsc --noEmit --project tools/posthog/tsconfig.json
```

Expected: no errors.

### Step 7.3 — Commit

```bash
git add tools/posthog/client.ts
git commit -m "$(cat <<'EOF'
feat(posthog-tools): openapi-fetch client with 429/503 backoff

Three-attempt retry with exponential backoff (500ms, 1s, 2s, max 8s)
for transient PostHog errors. Lazy singleton via ph().

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: `sync.ts` — plan computation with TDD

**Files:**
- Create: `tools/posthog/sync.spec.ts`
- Create: `tools/posthog/sync.ts` (partial — plan only)

This task implements `loadLocal()`, `loadRemote()`, and `computePlan()`. The next task implements `applyPlan()` and writeback. The task after wires the CLI.

### Step 8.1 — Write the failing plan tests

- [ ] Create `tools/posthog/sync.spec.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { computePlan, type SyncClient } from './sync.js';

async function fixtureRoot(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'posthog-tools-test-'));
  await mkdir(join(dir, 'dashboards'), { recursive: true });
  await mkdir(join(dir, 'insights'), { recursive: true });
  await mkdir(join(dir, 'cohorts'), { recursive: true });
  return dir;
}

function fakeClient(remote: { dashboards?: any[]; insights?: any[]; cohorts?: any[] } = {}): SyncClient {
  return {
    listDashboards: async () => remote.dashboards ?? [],
    listInsights: async () => remote.insights ?? [],
    listCohorts: async () => remote.cohorts ?? [],
    createDashboard: async (body) => ({ ...body, id: 1000 }),
    createInsight: async (body) => ({ ...body, id: 2000 }),
    createCohort: async (body) => ({ ...body, id: 3000 }),
    updateDashboard: async (id, body) => ({ ...body, id }),
    updateInsight: async (id, body) => ({ ...body, id }),
    updateCohort: async (id, body) => ({ ...body, id }),
    deleteDashboard: async () => undefined,
    deleteInsight: async () => undefined,
    deleteCohort: async () => undefined,
  };
}

test('computePlan: all-new local artifacts produce [create] for each', async () => {
  const root = await fixtureRoot();
  await writeFile(join(root, 'dashboards/d1.json'), JSON.stringify({
    slug: 'd1', posthog_id: null, name: 'D1', description: '', tiles: [{ insight: 'i1' }],
  }));
  await writeFile(join(root, 'insights/i1.json'), JSON.stringify({
    slug: 'i1', posthog_id: null, kind: 'trends', name: 'I1', events: [{ event: '$pageview', math: 'total' }],
  }));
  const plan = await computePlan({ root, client: fakeClient() });
  assert.equal(plan.create.length, 2);  // 1 dashboard + 1 insight
  assert.equal(plan.update.length, 0);
  assert.equal(plan.orphan.length, 0);
});

test('computePlan: existing posthog_id matches remote and produces [update]', async () => {
  const root = await fixtureRoot();
  await writeFile(join(root, 'insights/i1.json'), JSON.stringify({
    slug: 'i1', posthog_id: 42, kind: 'trends', name: 'I1', events: [{ event: '$pageview' }],
  }));
  const plan = await computePlan({
    root,
    client: fakeClient({ insights: [{ id: 42, name: 'I1', filters: {} }] }),
  });
  assert.equal(plan.update.length, 1);
  assert.equal(plan.update[0].local.slug, 'i1');
});

test('computePlan: remote without local match becomes [orphan]', async () => {
  const root = await fixtureRoot();
  const plan = await computePlan({
    root,
    client: fakeClient({ dashboards: [{ id: 999, name: 'Stray dashboard' }] }),
  });
  assert.equal(plan.orphan.length, 1);
  assert.equal(plan.orphan[0].remote.name, 'Stray dashboard');
});

test('computePlan: name-fallback match when posthog_id is null', async () => {
  const root = await fixtureRoot();
  await writeFile(join(root, 'insights/by-name.json'), JSON.stringify({
    slug: 'by-name', posthog_id: null, kind: 'trends', name: 'Existing Insight',
    events: [{ event: '$pageview' }],
  }));
  const plan = await computePlan({
    root,
    client: fakeClient({ insights: [{ id: 77, name: 'Existing Insight' }] }),
  });
  assert.equal(plan.update.length, 1);
  assert.equal(plan.update[0].remoteId, 77);
});

test('computePlan: ambiguous name match (two remotes same name) forces create', async () => {
  const root = await fixtureRoot();
  await writeFile(join(root, 'insights/x.json'), JSON.stringify({
    slug: 'x', posthog_id: null, kind: 'trends', name: 'Same Name',
    events: [{ event: '$pageview' }],
  }));
  const plan = await computePlan({
    root,
    client: fakeClient({
      insights: [{ id: 1, name: 'Same Name' }, { id: 2, name: 'Same Name' }],
    }),
  });
  assert.equal(plan.create.length, 1);
  assert.equal(plan.orphan.length, 2);  // both ambiguous remotes become orphans
});

test('computePlan: invalid local JSON throws with file path in message', async () => {
  const root = await fixtureRoot();
  await writeFile(join(root, 'insights/bad.json'), JSON.stringify({ slug: 'BAD-SLUG', posthog_id: null }));
  await assert.rejects(
    () => computePlan({ root, client: fakeClient() }),
    /insights\/bad\.json/,
  );
});
```

### Step 8.2 — Run, see fail

- [ ] Run:

```bash
npx tsx --test tools/posthog/sync.spec.ts
```

Expected: ERROR — cannot resolve `./sync.js`.

### Step 8.3 — Implement plan computation in `sync.ts`

- [ ] Create `tools/posthog/sync.ts`:

```typescript
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { DashboardLocal, InsightLocal, CohortLocal } from './schema.js';
import { z } from 'zod';

// Minimal remote shapes — we only read fields we use, so we keep these loose.
export interface RemoteDashboard { id: number; name: string; tags?: string[] }
export interface RemoteInsight { id: number; name: string; filters?: unknown }
export interface RemoteCohort { id: number; name: string }

// Transport interface. The real client adapts openapi-fetch to this shape.
export interface SyncClient {
  listDashboards(): Promise<RemoteDashboard[]>;
  listInsights(): Promise<RemoteInsight[]>;
  listCohorts(): Promise<RemoteCohort[]>;
  createDashboard(body: any): Promise<RemoteDashboard>;
  createInsight(body: any): Promise<RemoteInsight>;
  createCohort(body: any): Promise<RemoteCohort>;
  updateDashboard(id: number, body: any): Promise<RemoteDashboard>;
  updateInsight(id: number, body: any): Promise<RemoteInsight>;
  updateCohort(id: number, body: any): Promise<RemoteCohort>;
  deleteDashboard(id: number): Promise<void>;
  deleteInsight(id: number): Promise<void>;
  deleteCohort(id: number): Promise<void>;
}

export type Kind = 'dashboard' | 'insight' | 'cohort';

export interface PlanItem {
  kind: Kind;
  local?: any;
  remote?: any;
  remoteId?: number;
  path?: string;
}

export interface SyncPlan {
  create: PlanItem[];
  update: PlanItem[];
  orphan: PlanItem[];
}

async function loadLocalDir<T>(
  root: string,
  subdir: string,
  schema: z.ZodType<T>,
): Promise<Array<{ data: T; path: string }>> {
  const dir = join(root, subdir);
  let files: string[];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }
  const out: Array<{ data: T; path: string }> = [];
  for (const f of files) {
    const path = join(subdir, f);
    const json = JSON.parse(await readFile(join(root, path), 'utf8'));
    const result = schema.safeParse(json);
    if (!result.success) {
      throw new Error(`${path}: ${JSON.stringify(result.error.issues)}`);
    }
    out.push({ data: result.data, path });
  }
  return out;
}

function matchRemoteById<R extends { id: number; name: string }>(
  local: { posthog_id: number | null; name: string },
  remotes: R[],
): { remote: R | null; ambiguous: R[] } {
  if (local.posthog_id !== null) {
    const remote = remotes.find((r) => r.id === local.posthog_id) ?? null;
    return { remote, ambiguous: [] };
  }
  const named = remotes.filter((r) => r.name === local.name);
  if (named.length === 1) return { remote: named[0], ambiguous: [] };
  if (named.length > 1) return { remote: null, ambiguous: named };
  return { remote: null, ambiguous: [] };
}

export async function computePlan({
  root,
  client,
}: {
  root: string;
  client: SyncClient;
}): Promise<SyncPlan> {
  const localDashboards = await loadLocalDir(root, 'dashboards', DashboardLocal);
  const localInsights = await loadLocalDir(root, 'insights', InsightLocal);
  const localCohorts = await loadLocalDir(root, 'cohorts', CohortLocal);
  const remoteDashboards = await client.listDashboards();
  const remoteInsights = await client.listInsights();
  const remoteCohorts = await client.listCohorts();

  const plan: SyncPlan = { create: [], update: [], orphan: [] };
  const matchedRemoteIds = { dashboard: new Set<number>(), insight: new Set<number>(), cohort: new Set<number>() };

  const apply = <L extends { slug: string; posthog_id: number | null; name: string }, R extends { id: number; name: string }>(
    kind: Kind,
    locals: Array<{ data: L; path: string }>,
    remotes: R[],
    matched: Set<number>,
  ) => {
    for (const { data, path } of locals) {
      const { remote, ambiguous } = matchRemoteById(data, remotes);
      if (remote) {
        plan.update.push({ kind, local: data, remote, remoteId: remote.id, path });
        matched.add(remote.id);
      } else if (ambiguous.length > 0) {
        plan.create.push({ kind, local: data, path });
        for (const r of ambiguous) {
          plan.orphan.push({ kind, remote: r });
          matched.add(r.id);
        }
      } else {
        plan.create.push({ kind, local: data, path });
      }
    }
    for (const r of remotes) {
      if (!matched.has(r.id)) {
        plan.orphan.push({ kind, remote: r });
      }
    }
  };

  apply('dashboard', localDashboards, remoteDashboards, matchedRemoteIds.dashboard);
  apply('insight', localInsights, remoteInsights, matchedRemoteIds.insight);
  apply('cohort', localCohorts, remoteCohorts, matchedRemoteIds.cohort);

  return plan;
}
```

### Step 8.4 — Run, see pass

- [ ] Run:

```bash
npx tsx --test tools/posthog/sync.spec.ts
```

Expected: `✔ 6 tests passing`.

### Step 8.5 — Commit

```bash
git add tools/posthog/sync.ts tools/posthog/sync.spec.ts
git commit -m "$(cat <<'EOF'
feat(posthog-tools): computePlan() for sync engine

Loads local JSON, validates via zod, matches against remote by
posthog_id (or unique name fallback), classifies into
create/update/orphan. Ambiguous name matches force create.

6 tests covering match-by-id, name fallback, ambiguous case,
orphan detection, invalid JSON error handling.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: `sync.ts` — apply + writeback with TDD

**Files:**
- Modify: `tools/posthog/sync.spec.ts` (add tests)
- Modify: `tools/posthog/sync.ts` (add apply + writeback)

### Step 9.1 — Add the failing apply tests

- [ ] Append to `tools/posthog/sync.spec.ts`:

```typescript
import { applyPlan, type ApplyResult } from './sync.js';

test('applyPlan: apply order — insights POSTed before dashboards', async () => {
  const root = await fixtureRoot();
  await writeFile(join(root, 'dashboards/d.json'), JSON.stringify({
    slug: 'd', posthog_id: null, name: 'D', description: '', tiles: [{ insight: 'i' }],
  }));
  await writeFile(join(root, 'insights/i.json'), JSON.stringify({
    slug: 'i', posthog_id: null, kind: 'trends', name: 'I', events: [{ event: '$pageview' }],
  }));
  const createCalls: string[] = [];
  const client: SyncClient = {
    ...fakeClient(),
    createInsight: async (body) => { createCalls.push('insight'); return { ...body, id: 2001 }; },
    createDashboard: async (body) => { createCalls.push('dashboard'); return { ...body, id: 1001 }; },
  };
  const plan = await computePlan({ root, client });
  await applyPlan({ root, client, plan });
  assert.deepEqual(createCalls, ['insight', 'dashboard']);
});

test('applyPlan: writeback updates posthog_id in source JSON', async () => {
  const root = await fixtureRoot();
  await writeFile(join(root, 'insights/i.json'), JSON.stringify({
    slug: 'i', posthog_id: null, kind: 'trends', name: 'I', events: [{ event: '$pageview' }],
  }, null, 2));
  const client: SyncClient = { ...fakeClient(), createInsight: async (body) => ({ ...body, id: 7777 }) };
  const plan = await computePlan({ root, client });
  await applyPlan({ root, client, plan });
  const updated = JSON.parse(await readFile(join(root, 'insights/i.json'), 'utf8'));
  assert.equal(updated.posthog_id, 7777);
});

test('applyPlan: dashboard with unknown insight slug throws', async () => {
  const root = await fixtureRoot();
  await writeFile(join(root, 'dashboards/d.json'), JSON.stringify({
    slug: 'd', posthog_id: null, name: 'D', description: '', tiles: [{ insight: 'missing-insight' }],
  }));
  const client = fakeClient();
  const plan = await computePlan({ root, client });
  await assert.rejects(
    () => applyPlan({ root, client, plan }),
    /missing-insight/,
  );
});

test('applyPlan: partial success — failed insight does not block other creates', async () => {
  const root = await fixtureRoot();
  await writeFile(join(root, 'insights/a.json'), JSON.stringify({
    slug: 'a', posthog_id: null, kind: 'trends', name: 'A', events: [{ event: '$pageview' }],
  }));
  await writeFile(join(root, 'insights/fail.json'), JSON.stringify({
    slug: 'fail', posthog_id: null, kind: 'trends', name: 'Fail', events: [{ event: '$pageview' }],
  }));
  let calls = 0;
  const client: SyncClient = {
    ...fakeClient(),
    createInsight: async (body) => {
      calls += 1;
      if (body.name === 'Fail') throw new Error('500');
      return { ...body, id: 100 + calls };
    },
  };
  const plan = await computePlan({ root, client });
  const result: ApplyResult = await applyPlan({ root, client, plan });
  assert.equal(result.applied, 1);
  assert.equal(result.failed, 1);
});

test('applyPlan: --plan mode never writes to disk', async () => {
  const root = await fixtureRoot();
  await writeFile(join(root, 'insights/i.json'), JSON.stringify({
    slug: 'i', posthog_id: null, kind: 'trends', name: 'I', events: [{ event: '$pageview' }],
  }));
  const before = await readFile(join(root, 'insights/i.json'), 'utf8');
  const client = fakeClient();
  const plan = await computePlan({ root, client });
  // computePlan never writes; applyPlan({ dryRun: true }) also never writes
  await applyPlan({ root, client, plan, dryRun: true });
  const after = await readFile(join(root, 'insights/i.json'), 'utf8');
  assert.equal(before, after);
});

test('applyPlan: orphans are never deleted unless deleteOrphans:true', async () => {
  const root = await fixtureRoot();
  const deleteCalls: number[] = [];
  const client: SyncClient = {
    ...fakeClient({ dashboards: [{ id: 999, name: 'Stray' }] }),
    deleteDashboard: async (id) => { deleteCalls.push(id); },
  };
  const plan = await computePlan({ root, client });
  await applyPlan({ root, client, plan });
  assert.deepEqual(deleteCalls, []);
  await applyPlan({ root, client, plan, deleteOrphans: true });
  assert.deepEqual(deleteCalls, [999]);
});
```

### Step 9.2 — Run, see fail

- [ ] Run:

```bash
npx tsx --test tools/posthog/sync.spec.ts
```

Expected: error — `applyPlan` not exported.

### Step 9.3 — Add apply + writeback to `sync.ts`

- [ ] Append to `tools/posthog/sync.ts`:

```typescript
import { writeFile, rename } from 'node:fs/promises';

export interface ApplyResult {
  applied: number;
  failed: number;
  errors: Array<{ kind: Kind; slug: string; error: string }>;
}

export interface ApplyOptions {
  root: string;
  client: SyncClient;
  plan: SyncPlan;
  dryRun?: boolean;
  deleteOrphans?: boolean;
}

async function atomicWriteJson(path: string, data: unknown): Promise<void> {
  const tmpPath = `${path}.tmp`;
  await writeFile(tmpPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  await rename(tmpPath, path);
}

function resolveTiles(
  dashboard: any,
  insightSlugToId: Map<string, number>,
): Array<{ insight: number }> {
  return (dashboard.tiles ?? []).map((t: { insight: string }) => {
    const id = insightSlugToId.get(t.insight);
    if (id === undefined) {
      throw new Error(
        `dashboards/${dashboard.slug}.json references unknown insight slug "${t.insight}"`,
      );
    }
    return { insight: id };
  });
}

export async function applyPlan(options: ApplyOptions): Promise<ApplyResult> {
  const { root, client, plan, dryRun = false, deleteOrphans = false } = options;
  const result: ApplyResult = { applied: 0, failed: 0, errors: [] };
  const insightSlugToId = new Map<string, number>();

  // Pre-populate insight slug→id map from existing posthog_ids (for dashboards referencing already-synced insights).
  for (const item of plan.update.filter((p) => p.kind === 'insight')) {
    insightSlugToId.set(item.local.slug, item.remoteId!);
  }

  // Apply order: cohorts → insights → dashboards. Creates within a tier before updates.
  const tiers: Array<{ kind: Kind; create: PlanItem[]; update: PlanItem[] }> = [
    { kind: 'cohort', create: plan.create.filter((p) => p.kind === 'cohort'), update: plan.update.filter((p) => p.kind === 'cohort') },
    { kind: 'insight', create: plan.create.filter((p) => p.kind === 'insight'), update: plan.update.filter((p) => p.kind === 'insight') },
    { kind: 'dashboard', create: plan.create.filter((p) => p.kind === 'dashboard'), update: plan.update.filter((p) => p.kind === 'dashboard') },
  ];

  for (const tier of tiers) {
    for (const item of tier.create) {
      if (dryRun) continue;
      try {
        let created: any;
        if (item.kind === 'cohort') created = await client.createCohort(item.local);
        else if (item.kind === 'insight') created = await client.createInsight(item.local);
        else {
          const tiles = resolveTiles(item.local, insightSlugToId);
          created = await client.createDashboard({ ...item.local, tiles });
        }
        if (item.kind === 'insight') insightSlugToId.set(item.local.slug, created.id);
        // Writeback posthog_id into local JSON.
        if (item.path) {
          const fullPath = join(root, item.path);
          await atomicWriteJson(fullPath, { ...item.local, posthog_id: created.id });
        }
        result.applied += 1;
      } catch (err) {
        result.failed += 1;
        result.errors.push({
          kind: item.kind,
          slug: item.local.slug,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    for (const item of tier.update) {
      if (dryRun) continue;
      try {
        if (item.kind === 'cohort') await client.updateCohort(item.remoteId!, item.local);
        else if (item.kind === 'insight') await client.updateInsight(item.remoteId!, item.local);
        else {
          const tiles = resolveTiles(item.local, insightSlugToId);
          await client.updateDashboard(item.remoteId!, { ...item.local, tiles });
        }
        result.applied += 1;
      } catch (err) {
        result.failed += 1;
        result.errors.push({
          kind: item.kind,
          slug: item.local.slug,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  if (deleteOrphans && !dryRun) {
    for (const item of plan.orphan) {
      try {
        if (item.kind === 'cohort') await client.deleteCohort(item.remote.id);
        else if (item.kind === 'insight') await client.deleteInsight(item.remote.id);
        else await client.deleteDashboard(item.remote.id);
      } catch (err) {
        result.errors.push({
          kind: item.kind,
          slug: `(orphan id=${item.remote.id})`,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  return result;
}
```

### Step 9.4 — Run, see pass

- [ ] Run:

```bash
npx tsx --test tools/posthog/sync.spec.ts
```

Expected: all 12 tests pass (6 from Task 8 + 6 new).

### Step 9.5 — Commit

```bash
git add tools/posthog/sync.ts tools/posthog/sync.spec.ts
git commit -m "$(cat <<'EOF'
feat(posthog-tools): applyPlan() with writeback + slug resolution

Apply order: cohorts → insights → dashboards. Creates before updates
within a tier. Atomic writeback via temp-file + rename. Partial success
tracked. Orphans only deleted with deleteOrphans:true.

6 new tests cover apply order, writeback persistence, slug resolution
failure, partial success, dry-run no-write, orphan protection.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: `sync.ts` CLI entry + adapter from openapi-fetch to SyncClient

**Files:**
- Modify: `tools/posthog/sync.ts` (add adapter + CLI main)

### Step 10.1 — Add the openapi-fetch → SyncClient adapter and CLI entrypoint

- [ ] Append to `tools/posthog/sync.ts`:

```typescript
import { fileURLToPath } from 'node:url';
import { dirname, resolve as resolvePath } from 'node:path';
import { ph } from './client.js';

function makeRealClient(): SyncClient {
  const c = ph();
  const ok = <T>(r: { data?: T; error?: unknown }, op: string): T => {
    if (r.error || r.data === undefined) {
      throw new Error(`PostHog ${op} failed: ${JSON.stringify(r.error)}`);
    }
    return r.data;
  };
  return {
    listDashboards: async () => {
      const r = await c.GET('/dashboards/' as any, { params: { query: { limit: 200 } } } as any);
      return ((ok(r as any, 'list dashboards') as any).results ?? []) as RemoteDashboard[];
    },
    listInsights: async () => {
      const r = await c.GET('/insights/' as any, { params: { query: { limit: 200 } } } as any);
      return ((ok(r as any, 'list insights') as any).results ?? []) as RemoteInsight[];
    },
    listCohorts: async () => {
      const r = await c.GET('/cohorts/' as any, { params: { query: { limit: 200 } } } as any);
      return ((ok(r as any, 'list cohorts') as any).results ?? []) as RemoteCohort[];
    },
    createDashboard: async (body) => ok(await c.POST('/dashboards/' as any, { body } as any), 'create dashboard') as RemoteDashboard,
    createInsight: async (body) => ok(await c.POST('/insights/' as any, { body } as any), 'create insight') as RemoteInsight,
    createCohort: async (body) => ok(await c.POST('/cohorts/' as any, { body } as any), 'create cohort') as RemoteCohort,
    updateDashboard: async (id, body) => ok(await c.PATCH(`/dashboards/{id}/` as any, { params: { path: { id } }, body } as any), 'update dashboard') as RemoteDashboard,
    updateInsight: async (id, body) => ok(await c.PATCH(`/insights/{id}/` as any, { params: { path: { id } }, body } as any), 'update insight') as RemoteInsight,
    updateCohort: async (id, body) => ok(await c.PATCH(`/cohorts/{id}/` as any, { params: { path: { id } }, body } as any), 'update cohort') as RemoteCohort,
    deleteDashboard: async (id) => { await c.DELETE(`/dashboards/{id}/` as any, { params: { path: { id } } } as any); },
    deleteInsight: async (id) => { await c.DELETE(`/insights/{id}/` as any, { params: { path: { id } } } as any); },
    deleteCohort: async (id) => { await c.DELETE(`/cohorts/{id}/` as any, { params: { path: { id } } } as any); },
  };
}

function formatPlanSummary(plan: SyncPlan): string {
  const lines: string[] = [];
  for (const item of plan.create) lines.push(`[create]  ${item.kind} ${item.local.slug}`);
  for (const item of plan.update) lines.push(`[update]  ${item.kind} ${item.local.slug}  (posthog_id=${item.remoteId})`);
  for (const item of plan.orphan) lines.push(`[orphan]  ${item.kind} "${item.remote.name}" (posthog_id=${item.remote.id})`);
  if (lines.length === 0) lines.push('(nothing to do)');
  return lines.join('\n');
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const wantPlan = args.includes('--plan');
  const wantApply = args.includes('--apply');
  const deleteOrphans = args.includes('--delete-orphans');
  if (!wantPlan && !wantApply) {
    console.error('Usage: sync.ts (--plan | --apply [--delete-orphans])');
    return 1;
  }
  if (wantPlan && wantApply) {
    console.error('Cannot combine --plan and --apply');
    return 1;
  }

  const here = dirname(fileURLToPath(import.meta.url));
  const root = resolvePath(here);  // tools/posthog/

  let client: SyncClient;
  try {
    client = makeRealClient();
  } catch (err) {
    console.error(`Failed to initialize PostHog client: ${err instanceof Error ? err.message : err}`);
    return 1;
  }

  let plan: SyncPlan;
  try {
    plan = await computePlan({ root, client });
  } catch (err) {
    console.error(`Plan computation failed: ${err instanceof Error ? err.message : err}`);
    return 1;
  }

  console.log(formatPlanSummary(plan));

  if (wantPlan) return 0;

  const result = await applyPlan({ root, client, plan, deleteOrphans });
  console.log(`\napplied: ${result.applied}, failed: ${result.failed}`);
  if (result.errors.length > 0) {
    for (const e of result.errors) {
      console.error(`  ${e.kind} ${e.slug}: ${e.error}`);
    }
    return 1;
  }

  // Helpful next-step hint after apply with writeback.
  const writeback = plan.create.filter((p) => p.kind !== 'cohort' || p.path);
  if (writeback.length > 0) {
    const slugs = writeback.map((p) => p.local.slug).join(', ');
    console.log(`\nWriteback complete. Commit with:`);
    console.log(`  git add tools/posthog/{dashboards,insights,cohorts}/`);
    console.log(`  git commit -m "chore(posthog): writeback ids for ${slugs}"`);
  }
  return 0;
}

// Only run main when executed directly (not when imported by tests).
const isDirectRun = process.argv[1] && resolvePath(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main().then((code) => process.exit(code));
}
```

### Step 10.2 — Smoke test the CLI usage error path

- [ ] Run (no env vars; just exercise argv parsing):

```bash
npx tsx tools/posthog/sync.ts
```

Expected: prints `Usage: sync.ts (--plan | --apply [--delete-orphans])` and exits 1.

- [ ] Run:

```bash
npx tsx tools/posthog/sync.ts --plan --apply
```

Expected: prints `Cannot combine --plan and --apply` and exits 1.

### Step 10.3 — Verify tests still pass

- [ ] Run:

```bash
npx tsx --test tools/posthog/sync.spec.ts
```

Expected: 12 tests pass. (We added new code to sync.ts but it's CLI/adapter only; the test surface is unchanged.)

### Step 10.4 — Commit

```bash
git add tools/posthog/sync.ts
git commit -m "$(cat <<'EOF'
feat(posthog-tools): sync.ts CLI entry + openapi-fetch adapter

CLI accepts --plan, --apply, --apply --delete-orphans. Adapter wraps
openapi-fetch in the SyncClient interface used by tests. Direct-run
guard prevents tests from triggering main().

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: `report.ts` — pure functions with TDD

**Files:**
- Create: `tools/posthog/report.spec.ts`
- Create: `tools/posthog/report.ts` (partial — pure functions only)

### Step 11.1 — Write the failing tests

- [ ] Create `tools/posthog/report.spec.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sparkline, formatDeltaCell, renderReport } from './report.js';

test('sparkline: empty array returns dash', () => {
  assert.equal(sparkline([]), '—');
});

test('sparkline: maps values to 8-bar palette', () => {
  assert.equal(sparkline([0, 1, 2, 4, 8]), '▁▂▃▅█');
});

test('sparkline: all zeros returns flat low bars', () => {
  assert.equal(sparkline([0, 0, 0, 0]), '▁▁▁▁');
});

test('formatDeltaCell: zero last week with positive this week returns "new"', () => {
  const cell = formatDeltaCell({ thisWeek: 5, lastWeek: 0 });
  assert.match(cell, /\+5 \(new\)/);
});

test('formatDeltaCell: standard percent diff', () => {
  const cell = formatDeltaCell({ thisWeek: 120, lastWeek: 100 });
  assert.match(cell, /\+20 \(\+20%\)/);
});

test('formatDeltaCell: negative diff', () => {
  const cell = formatDeltaCell({ thisWeek: 80, lastWeek: 100 });
  assert.match(cell, /-20 \(-20%\)/);
});

test('renderReport: produces stable markdown structure', () => {
  const out = renderReport(
    [{ name: 'GTM · Test', rows: [{ metric: 'X', thisWeek: 10, lastWeek: 5, weeks: [1, 2, 3, 10] }] }],
    '2026-05-14',
  );
  assert.match(out, /^# GTM weekly snapshot — 2026-05-14/);
  assert(out.includes('## GTM · Test'));
  assert(out.includes('## Notes'));
  assert(out.includes('<!-- HUMAN:'));
  assert(out.includes('| X '));
});
```

### Step 11.2 — Run, see fail

- [ ] Run:

```bash
npx tsx --test tools/posthog/report.spec.ts
```

Expected: ERROR — cannot resolve `./report.js`.

### Step 11.3 — Implement pure functions in `report.ts`

- [ ] Create `tools/posthog/report.ts`:

```typescript
const BARS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

export function sparkline(values: readonly number[]): string {
  if (values.length === 0) return '—';
  const max = Math.max(...values, 1);
  return values
    .map((v) => BARS[Math.min(7, Math.round((v / max) * 7))])
    .join('');
}

export function formatDeltaCell({ thisWeek, lastWeek }: { thisWeek: number; lastWeek: number }): string {
  const diff = thisWeek - lastWeek;
  const sign = diff >= 0 ? '+' : '';
  if (lastWeek === 0) {
    return diff > 0 ? `${sign}${diff} (new)` : '—';
  }
  const pct = Math.round(((thisWeek - lastWeek) / lastWeek) * 100);
  const pctSign = pct >= 0 ? '+' : '';
  return `${sign}${diff} (${pctSign}${pct}%)`;
}

export interface ReportRow {
  metric: string;
  thisWeek: number;
  lastWeek: number;
  weeks: readonly number[];  // 4 most recent buckets
}

export interface ReportSection {
  name: string;
  rows: ReportRow[];
}

export function renderReport(sections: ReportSection[], date: string): string {
  const lines: string[] = [];
  lines.push(`# GTM weekly snapshot — ${date}`);
  lines.push('');
  lines.push('> Generated by `nx run posthog-tools:report`. Notes below are hand-edited.');
  lines.push('');
  for (const section of sections) {
    lines.push(`## ${section.name}`);
    lines.push('');
    lines.push('| Metric | This week | Last week | Δ | 4-wk |');
    lines.push('|--------|----------:|----------:|--:|------|');
    for (const row of section.rows) {
      lines.push(
        `| ${row.metric} | ${row.thisWeek.toLocaleString()} | ${row.lastWeek.toLocaleString()} | ${formatDeltaCell({ thisWeek: row.thisWeek, lastWeek: row.lastWeek })} | ${sparkline(row.weeks)} |`,
      );
    }
    lines.push('');
  }
  lines.push('## Notes');
  lines.push('');
  lines.push('<!-- HUMAN: edit this section before merging the PR. Three bullets max. -->');
  lines.push('- _Add observations here before merging._');
  lines.push('');
  return lines.join('\n');
}
```

### Step 11.4 — Run, see pass

- [ ] Run:

```bash
npx tsx --test tools/posthog/report.spec.ts
```

Expected: `✔ 7 tests passing`.

### Step 11.5 — Commit

```bash
git add tools/posthog/report.ts tools/posthog/report.spec.ts
git commit -m "$(cat <<'EOF'
feat(posthog-tools): report.ts pure functions (sparkline, delta, render)

7 tests cover sparkline edge cases (empty, all-zero, normalization),
delta-cell formatting (new, percent, negative), and markdown structure.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: `report.ts` — main flow + CLI

**Files:**
- Modify: `tools/posthog/report.ts` (add generateReport + CLI main)

### Step 12.1 — Add generateReport + main

- [ ] Append to `tools/posthog/report.ts`:

```typescript
import { writeFile, mkdir, access } from 'node:fs/promises';
import { join, resolve as resolvePath, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ph } from './client.js';

interface FetchedInsight {
  id: number;
  name: string;
  filters?: { insight?: string };
  result?: any;
}

interface FetchedDashboard {
  id: number;
  name: string;
  tags?: string[];
  tiles?: Array<{ insight?: number | { id: number } }>;
}

function extractWeeklyValues(insight: FetchedInsight): { thisWeek: number; lastWeek: number; weeks: number[] } {
  // PostHog trends return result[0].data as an array of daily counts.
  // We fold into 7-day buckets, newest first.
  const series = (Array.isArray(insight.result) ? insight.result[0]?.data : insight.result?.[0]?.data) ?? [];
  const buckets: number[] = [];
  for (let i = 0; i < 4; i++) {
    const start = series.length - (i + 1) * 7;
    const end = series.length - i * 7;
    if (start < 0) break;
    buckets.unshift(series.slice(start, end).reduce((a: number, b: number) => a + b, 0));
  }
  while (buckets.length < 4) buckets.unshift(0);
  return {
    thisWeek: buckets[buckets.length - 1] ?? 0,
    lastWeek: buckets[buckets.length - 2] ?? 0,
    weeks: buckets,
  };
}

export async function generateReport(): Promise<{ markdown: string; date: string }> {
  const c = ph();
  const dashRes = await c.GET('/dashboards/' as any, { params: { query: { limit: 200 } } } as any);
  const dashboards = ((dashRes as any).data?.results ?? []) as FetchedDashboard[];
  const gtmDashboards = dashboards.filter((d) => d.tags?.includes('gtm'));

  const sections: ReportSection[] = [];
  for (const d of gtmDashboards) {
    const rows: ReportRow[] = [];
    for (const tile of d.tiles ?? []) {
      const tileId = typeof tile.insight === 'number' ? tile.insight : tile.insight?.id;
      if (typeof tileId !== 'number') continue;
      const insightRes = await c.GET(`/insights/{id}/` as any, {
        params: { path: { id: tileId }, query: { refresh: 'force_cache' } },
      } as any);
      const insight = ((insightRes as any).data ?? {}) as FetchedInsight;
      const { thisWeek, lastWeek, weeks } = extractWeeklyValues(insight);
      rows.push({ metric: insight.name, thisWeek, lastWeek, weeks });
    }
    sections.push({ name: d.name, rows });
  }

  const date = new Date().toISOString().slice(0, 10);
  return { markdown: renderReport(sections, date), date };
}

async function nextOutputPath(reportsDir: string, date: string): Promise<string> {
  const base = join(reportsDir, `${date}-weekly`);
  let candidate = `${base}.md`;
  let suffix = 2;
  while (true) {
    try {
      await access(candidate);
      candidate = `${base}-${suffix}.md`;
      suffix += 1;
    } catch {
      return candidate;
    }
  }
}

async function main(): Promise<number> {
  let report: { markdown: string; date: string };
  try {
    report = await generateReport();
  } catch (err) {
    console.error(`Report generation failed: ${err instanceof Error ? err.message : err}`);
    return 1;
  }
  const here = dirname(fileURLToPath(import.meta.url));
  const reportsDir = resolvePath(here, '..', '..', 'docs', 'gtm', 'reports');
  await mkdir(reportsDir, { recursive: true });
  const outPath = await nextOutputPath(reportsDir, report.date);
  await writeFile(outPath, report.markdown, 'utf8');
  console.log(`Wrote ${outPath}`);
  return 0;
}

const isDirectRun = process.argv[1] && resolvePath(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main().then((code) => process.exit(code));
}
```

### Step 12.2 — Verify the report tests still pass

- [ ] Run:

```bash
npx tsx --test tools/posthog/report.spec.ts
```

Expected: 7 tests pass. (We added new code; the existing tests cover pure functions only.)

### Step 12.3 — Commit

```bash
git add tools/posthog/report.ts
git commit -m "$(cat <<'EOF'
feat(posthog-tools): report.ts main flow + 7-day bucket extraction

generateReport() pulls dashboards tagged 'gtm', queries each tile's
insight, folds daily counts into 4 weekly buckets. Output goes to
docs/gtm/reports/<date>-weekly[-N].md (never overwrites).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: Sample dashboard + 4 insight JSON files

**Files:**
- Create: `tools/posthog/dashboards/developer-funnel.json`
- Create: `tools/posthog/insights/pageviews-by-landing.json`
- Create: `tools/posthog/insights/install-command-clicks.json`
- Create: `tools/posthog/insights/cockpit-recipe-completion.json`
- Create: `tools/posthog/insights/six-signal-activation-funnel.json`
- Create: `tools/posthog/cohorts/.gitkeep`

### Step 13.1 — Create the dashboard

- [ ] Write `tools/posthog/dashboards/developer-funnel.json`:

```json
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

### Step 13.2 — Create the four insights

- [ ] Write `tools/posthog/insights/pageviews-by-landing.json`:

```json
{
  "slug": "pageviews-by-landing",
  "posthog_id": null,
  "kind": "trends",
  "name": "Pageviews by landing path",
  "events": [{ "event": "$pageview", "math": "total" }],
  "breakdown": "$pathname",
  "breakdown_limit": 15,
  "date_from": "-30d",
  "interval": "day"
}
```

- [ ] Write `tools/posthog/insights/install-command-clicks.json`:

```json
{
  "slug": "install-command-clicks",
  "posthog_id": null,
  "kind": "trends",
  "name": "Install command clicks",
  "events": [
    {
      "event": "marketing:cta_click",
      "math": "total",
      "properties": [
        { "key": "track", "value": "developer", "operator": "exact" }
      ]
    }
  ],
  "breakdown": "cta_id",
  "breakdown_limit": 10,
  "date_from": "-30d",
  "interval": "day"
}
```

- [ ] Write `tools/posthog/insights/cockpit-recipe-completion.json`:

```json
{
  "slug": "cockpit-recipe-completion",
  "posthog_id": null,
  "kind": "trends",
  "name": "Cockpit recipe completion",
  "events": [
    { "event": "cockpit:recipe_start", "math": "total" },
    { "event": "cockpit:chat_first_message", "math": "total" }
  ],
  "date_from": "-30d",
  "interval": "day"
}
```

- [ ] Write `tools/posthog/insights/six-signal-activation-funnel.json`:

```json
{
  "slug": "six-signal-activation-funnel",
  "posthog_id": null,
  "kind": "funnel",
  "name": "Six-signal activation (30-min window)",
  "window_minutes": 30,
  "steps": [
    { "event": "cockpit:install_command_copied" },
    { "event": "cockpit:transport_connected" },
    { "event": "cockpit:chat_first_message" },
    { "event": "cockpit:thread_persisted" },
    { "event": "cockpit:interrupt_handled" },
    { "event": "cockpit:generative_component_rendered" }
  ],
  "date_from": "-30d"
}
```

### Step 13.3 — Create the cohorts gitkeep

- [ ] Run:

```bash
mkdir -p tools/posthog/cohorts
touch tools/posthog/cohorts/.gitkeep
```

### Step 13.4 — Verify all JSON parses against schema

- [ ] Run:

```bash
npx tsx --test tools/posthog/schema.spec.ts
```

Expected: 7 tests pass. The fixture validator test now actually exercises the JSON files (previously empty directories were trivially passing).

### Step 13.5 — Commit

```bash
git add tools/posthog/dashboards tools/posthog/insights tools/posthog/cohorts
git commit -m "$(cat <<'EOF'
feat(posthog-tools): developer-funnel sample dashboard + 4 insights

The round-trip proof for Spec 1A. Four insights: pageviews-by-landing,
install-command-clicks, cockpit-recipe-completion (zero until Spec 1C),
six-signal-activation-funnel (zero until Spec 1C). Empty cohorts/.gitkeep
since cohorts come after data flows.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: Taxonomy guard test

**Files:**
- Create: `tools/posthog/taxonomy.spec.ts`

### Step 14.1 — Write the test

- [ ] Create `tools/posthog/taxonomy.spec.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const INSIGHTS_DIR = join(HERE, 'insights');
const TAXONOMY_PATH = join(HERE, '..', '..', 'docs', 'gtm', 'taxonomy.md');

test('every event in any insight JSON appears in docs/gtm/taxonomy.md', async () => {
  // 1. Collect events referenced in insights.
  const referenced = new Set<string>();
  const files = (await readdir(INSIGHTS_DIR)).filter((f) => f.endsWith('.json'));
  for (const f of files) {
    const json = JSON.parse(await readFile(join(INSIGHTS_DIR, f), 'utf8'));
    for (const step of json.steps ?? []) {
      if (typeof step.event === 'string') referenced.add(step.event);
    }
    for (const ev of json.events ?? []) {
      if (typeof ev.event === 'string') referenced.add(ev.event);
    }
  }

  // 2. Collect events documented in taxonomy.md.
  const taxonomy = await readFile(TAXONOMY_PATH, 'utf8');
  const matches = taxonomy.matchAll(/`(\$pageview|(?:marketing|cockpit|ngaf|docs):[a-z_]+)`/g);
  const documented = new Set<string>();
  for (const m of matches) documented.add(m[1]);

  // 3. Difference.
  const undocumented = [...referenced].filter((e) => !documented.has(e));
  assert.deepEqual(
    undocumented,
    [],
    `Events used in dashboards but missing from docs/gtm/taxonomy.md:\n${undocumented.join('\n')}`,
  );
});
```

### Step 14.2 — Run, see pass

- [ ] Run:

```bash
npx tsx --test tools/posthog/taxonomy.spec.ts
```

Expected: `✔ 1 test passing`. (If any event from the insight JSONs is missing in taxonomy.md, the test fails with the exact list — fix taxonomy.md or the insight JSON to align.)

### Step 14.3 — Run all tests together as a final integration check

- [ ] Run:

```bash
npx nx run posthog-tools:test
```

Expected: all 4 spec files pass — 22 tests total (env.spec.ts: 6 + schema.spec.ts: 7 + sync.spec.ts: 12 + report.spec.ts: 7 + taxonomy.spec.ts: 1 = 33 tests; adjust if any count differs in your implementation).

### Step 14.4 — Commit

```bash
git add tools/posthog/taxonomy.spec.ts
git commit -m "$(cat <<'EOF'
test(posthog-tools): permanent taxonomy guard

Every event referenced in any insight JSON must appear in
docs/gtm/taxonomy.md. This test stays green permanently and
catches event renames or insight drift.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 15: Root `package.json` scripts + `.env.example`

**Files:**
- Modify: `package.json` (root) — add scripts
- Create or modify: `.env.example`

### Step 15.1 — Add scripts to root `package.json`

- [ ] Open root `package.json`. In the `"scripts"` block, add three lines:

```json
{
  "scripts": {
    "posthog:sync": "nx run posthog-tools:sync:plan",
    "posthog:apply": "nx run posthog-tools:sync:apply",
    "posthog:report": "nx run posthog-tools:report",
    "posthog:generate-types": "nx run posthog-tools:generate-types"
  }
}
```

(Keep all existing scripts; just add these four.)

### Step 15.2 — Document env vars in `.env.example`

- [ ] Check if `.env.example` exists. If yes, append; if no, create.

```bash
test -f .env.example || touch .env.example
```

- [ ] Append (or create) with this content. If file exists and has unrelated content, append a new section at the bottom; do not duplicate any existing PostHog vars (e.g., the website may already document `NEXT_PUBLIC_POSTHOG_TOKEN`).

```bash
cat >> .env.example <<'EOF'

# PostHog dashboards-as-code (tools/posthog/)
# Generate a Personal API Key at https://us.posthog.com/me/settings#personal-api-keys
# Required scopes: dashboard:write, insight:write, cohort:write, project:read
POSTHOG_PERSONAL_API_KEY=
POSTHOG_HOST=https://us.i.posthog.com
POSTHOG_PROJECT_ID=
EOF
```

### Step 15.3 — Smoke-test the scripts resolve

- [ ] Run:

```bash
npm run posthog:sync -- --help 2>&1 || true
```

Expected: should resolve through Nx to `npx tsx tools/posthog/sync.ts --plan` and fail with "POSTHOG_PERSONAL_API_KEY must be at least 20 characters" or similar env error (we haven't set the secret). The Nx wiring is correct; the error proves it reached our code.

### Step 15.4 — Commit

```bash
git add package.json .env.example
git commit -m "$(cat <<'EOF'
feat(posthog-tools): root scripts + .env.example

npm run posthog:sync/apply/report/generate-types as thin Nx aliases.
.env.example documents POSTHOG_PERSONAL_API_KEY, POSTHOG_HOST,
POSTHOG_PROJECT_ID.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 16: CI workflow — Nx-affected gated `posthog-sync-plan` job

**Files:**
- Modify: `.github/workflows/ci.yml`

### Step 16.1 — Add the new job

- [ ] Open `.github/workflows/ci.yml`. Locate the top-level `jobs:` block. Append (preserving 2-space indent under `jobs:`):

```yaml
  posthog-sync-plan:
    name: PostHog — dashboards-as-code drift check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
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
            echo "::notice::posthog-tools not in affected projects — skipping drift check."
          fi
      - name: posthog:sync --plan
        if: steps.affected.outputs.is_affected == 'yes'
        env:
          POSTHOG_PERSONAL_API_KEY: ${{ secrets.POSTHOG_PERSONAL_API_KEY }}
          POSTHOG_HOST: https://us.i.posthog.com
          POSTHOG_PROJECT_ID: ${{ secrets.POSTHOG_PROJECT_ID }}
        run: |
          if [ -z "$POSTHOG_PERSONAL_API_KEY" ]; then
            echo "::notice::POSTHOG_PERSONAL_API_KEY not set — soft skip for contributor PRs."
            exit 0
          fi
          npx nx run posthog-tools:sync:plan
```

### Step 16.2 — Validate YAML syntax

- [ ] Run:

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))" && echo "YAML OK"
```

Expected: `YAML OK`. If YAML errors, fix indentation.

### Step 16.3 — Commit

```bash
git add .github/workflows/ci.yml
git commit -m "$(cat <<'EOF'
ci(posthog-tools): add Nx-affected gated sync plan check

New posthog-sync-plan job runs `nx run posthog-tools:sync:plan`
on PRs that affect posthog-tools (per nx show projects --affected).
Soft-skips when POSTHOG_PERSONAL_API_KEY secret is absent (fork PRs).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 17: Update `tools/posthog/README.md` to align with implementation

**Files:**
- Modify: `tools/posthog/README.md`

The current README (committed in Spec 0) was speculative — it references `schema/dashboard.json` JSON Schema files (we chose zod-only), raw `npm run posthog:sync` (we use `nx run`), and a different env var name (`POSTHOG_API_KEY`, we use `POSTHOG_PERSONAL_API_KEY`). Align it.

### Step 17.1 — Replace the README with an aligned version

- [ ] Overwrite `tools/posthog/README.md` with:

```markdown
# PostHog dashboards-as-code

> Spec: [analytics-foundation-1a-dashboards-as-code](../../docs/superpowers/specs/gtm/2026-05-14-analytics-foundation-1a-dashboards-as-code-design.md).

PostHog is configured via a Public-API-driven sync script — not through the PostHog UI. Every dashboard, insight, and cohort the GTM motion depends on is a JSON file in this directory. The sync tool reconciles JSON ↔ PostHog. Git is the source of truth.

## Directory layout

```
tools/posthog/
├── project.json                    # Nx project (posthog-tools)
├── env.ts                          # zod-validated env parsing
├── client.ts                       # openapi-fetch wrapper
├── schema.ts                       # zod schemas for local JSON
├── sync.ts                         # CLI: plan / apply / writeback
├── report.ts                       # CLI: pull insights → markdown
├── *.spec.ts                       # tests
├── types/posthog-api.gen.ts        # generated from PostHog OpenAPI spec
├── scripts/generate-types.ts       # regenerate the above
├── dashboards/*.json               # one JSON per dashboard
├── insights/*.json                 # reusable insight specs
└── cohorts/                        # currently empty; populated post-1A
```

## CLI

All commands wrap `nx run posthog-tools:*`. Root-package aliases:

```bash
npm run posthog:sync       # → nx run posthog-tools:sync:plan
npm run posthog:apply      # → nx run posthog-tools:sync:apply
npm run posthog:report     # → nx run posthog-tools:report
npm run posthog:generate-types  # → regenerate types/posthog-api.gen.ts
```

Direct Nx invocations work too:

```bash
nx run posthog-tools:sync:plan
nx run posthog-tools:sync:apply
nx run posthog-tools:sync:apply --args="--delete-orphans"
nx run posthog-tools:test
nx run posthog-tools:lint
```

## Auth

Requires a **Personal API Key** with `dashboard:write`, `insight:write`, `cohort:write`, `project:read` scopes. Create one at https://us.posthog.com/me/settings#personal-api-keys.

Env vars (see `.env.example` at repo root):

| Variable | Purpose |
|----------|---------|
| `POSTHOG_PERSONAL_API_KEY` | Personal API Key (Bearer) |
| `POSTHOG_HOST` | `https://us.i.posthog.com` (default) or your region |
| `POSTHOG_PROJECT_ID` | Numeric project id (visible in PostHog URL) |

**CI** uses the same key (write-scoped) for `--plan` only. **Production hardening TODO:** create a read-only Personal API Key for CI and add it as `POSTHOG_PERSONAL_API_KEY_READONLY` in GitHub Actions secrets. Local development continues using the write-scoped key for `--apply` and `--report`.

## JSON contract

```jsonc
// tools/posthog/dashboards/developer-funnel.json
{
  "slug": "developer-funnel",                  // local id, stable across syncs
  "posthog_id": null,                           // assigned on first sync; do not edit
  "name": "GTM · Developer funnel",
  "description": "Pageview → install → cockpit activation.",
  "tags": ["gtm", "developer-track"],
  "tiles": [
    { "insight": "pageviews-by-landing" },
    { "insight": "six-signal-activation-funnel" }
  ]
}
```

```jsonc
// tools/posthog/insights/six-signal-activation-funnel.json
{
  "slug": "six-signal-activation-funnel",
  "posthog_id": null,
  "kind": "funnel",
  "window_minutes": 30,
  "steps": [
    { "event": "cockpit:install_command_copied" },
    { "event": "cockpit:transport_connected" }
  ]
}
```

Event names must match [`docs/gtm/taxonomy.md`](../../docs/gtm/taxonomy.md). The `taxonomy.spec.ts` test enforces this on every CI run.

## Sync semantics

- **`--plan`** — diff against PostHog, no writes. Outputs `[create] [update] [orphan]` per artifact. CI runs this on every PR that affects `posthog-tools`.
- **`--apply`** — idempotent upsert via PATCH. Re-running with no JSON change is a no-op (PostHog dedupes).
- **`--apply --delete-orphans`** — explicit deletion of remote artifacts that have no local JSON. Never automatic.
- **`posthog_id` writeback** — first successful create writes the assigned PostHog id back into the JSON. Commit the writeback as `chore(posthog): writeback ids for <slugs>`.

## Renaming an artifact

To rename without losing the PostHog id:

1. Edit the `slug` field in the JSON, keeping `posthog_id` unchanged.
2. **Do not move the file** — the file path is the slug source.
3. `npm run posthog:sync` will detect this as an update, not a create + orphan.

## Regenerating types

PostHog publishes their full Public API as OpenAPI 3 at `https://us.posthog.com/api/schema/`. We commit the generated TypeScript types to avoid network calls at build time. Refresh quarterly:

```bash
npm run posthog:generate-types
```

Review the diff carefully — field renames in PostHog's API will surface here.

## Why dashboards-as-code

- `git blame` answers "who changed this metric and why."
- No clicking through the PostHog UI ("api/cli-first" actually delivers).
- Reproducible on a fresh PostHog project for staging/test envs.
- Reviewable in PRs like any other change.
- `taxonomy.spec.ts` prevents dashboards from referencing events the taxonomy doesn't document.

## See also

- [gtm.md](../../gtm.md) — durable strategy
- [docs/gtm/taxonomy.md](../../docs/gtm/taxonomy.md) — event names
- [cowork/gtm/SKILL.md](../../cowork/gtm/SKILL.md) — operates this CLI weekly
```

### Step 17.2 — Commit

```bash
git add tools/posthog/README.md
git commit -m "$(cat <<'EOF'
docs(posthog-tools): align README with Spec 1A implementation

Drops speculative JSON Schema references (zod-only), updates CLI
commands to nx run posthog-tools:*, documents POSTHOG_PERSONAL_API_KEY,
adds rename procedure, links to the spec.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 18: First `--apply` round trip (manual maintainer step)

This task **requires** `POSTHOG_PERSONAL_API_KEY`, `POSTHOG_PROJECT_ID`, and `POSTHOG_HOST` in `.env`. A subagent without these cannot complete it. **The user (Brian) runs this locally.** If the user has not set these env vars yet, skip to Task 19 with a clear note that Task 18 is a maintainer follow-up.

### Step 18.1 — Verify env vars are set

- [ ] Run:

```bash
[ -n "$POSTHOG_PERSONAL_API_KEY" ] && echo "key set" || echo "MISSING — populate .env"
[ -n "$POSTHOG_PROJECT_ID" ] && echo "project id set" || echo "MISSING — populate .env"
```

Both must print `set` to proceed. If either prints `MISSING`, stop and tell the user to populate `.env` (and `source .env` or use a tool like `dotenv-cli`).

### Step 18.2 — Run `--plan` first

- [ ] Run:

```bash
npm run posthog:sync
```

Expected output (something like):

```
[create]  insight pageviews-by-landing
[create]  insight install-command-clicks
[create]  insight cockpit-recipe-completion
[create]  insight six-signal-activation-funnel
[create]  dashboard developer-funnel
```

If `[orphan]` lines appear referencing dashboards/insights you don't recognize, **stop and investigate** — there may be a name collision with an unrelated existing PostHog object.

### Step 18.3 — Apply

- [ ] Run:

```bash
npm run posthog:apply
```

Expected output:

```
[create]  insight pageviews-by-landing
...
applied: 5, failed: 0

Writeback complete. Commit with:
  git add tools/posthog/{dashboards,insights,cohorts}/
  git commit -m "chore(posthog): writeback ids for ..."
```

### Step 18.4 — Verify writeback in JSON

- [ ] Run:

```bash
grep -l '"posthog_id":' tools/posthog/dashboards/*.json tools/posthog/insights/*.json | xargs grep '"posthog_id":' | head
```

Expected: every `posthog_id` line now has a number, not `null`.

### Step 18.5 — Commit the writeback

- [ ] Run:

```bash
git add tools/posthog/dashboards tools/posthog/insights
git commit -m "$(cat <<'EOF'
chore(posthog): writeback ids for developer-funnel and 4 insights

Records the PostHog-assigned ids after first --apply. Future syncs
match by posthog_id, not by name.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

### Step 18.6 — Run report to confirm read path

- [ ] Run:

```bash
npm run posthog:report
```

Expected output: `Wrote docs/gtm/reports/<today>-weekly.md`. The file should contain at least one section (`## GTM · Developer funnel`) with rows (likely all zeros since events haven't started flowing).

**Note:** The report file is **NOT** committed in this task. Weekly reports come from the `/gtm` Cowork skill flow.

---

## Task 19: Chrome MCP verification (manual)

After Task 18 completes (`--apply` succeeded), use Chrome MCP to visually confirm the dashboard rendered correctly in PostHog. This catches schema-level bugs (e.g., a tile created but the dashboard didn't actually reference it) that the round-trip writeback wouldn't catch.

**A subagent or the controller with Chrome MCP loaded** does this. If Chrome MCP is unavailable, this becomes a manual "open the URL and check" step for the user.

### Step 19.1 — Load Chrome MCP tools if not already available

If not already in this session's tool list, load via ToolSearch:

```
ToolSearch with query="Claude_in_Chrome" max_results=10
```

### Step 19.2 — Navigate to the dashboard

- [ ] Construct the dashboard URL using the writeback'd posthog_id:

```bash
DASH_ID=$(jq -r .posthog_id tools/posthog/dashboards/developer-funnel.json)
echo "https://${POSTHOG_HOST#https://}/dashboard/${DASH_ID}"
```

Or for the default host: `https://us.posthog.com/project/${POSTHOG_PROJECT_ID}/dashboard/${DASH_ID}`.

- [ ] Use Chrome MCP `navigate` to open the URL.

- [ ] Use Chrome MCP `read_page` (or `get_page_text`) to confirm:
  - Page title contains "GTM · Developer funnel"
  - Four tiles render (even if empty) with names matching: "Pageviews by landing path", "Install command clicks", "Cockpit recipe completion", "Six-signal activation (30-min window)"

### Step 19.3 — Document the verification

If verification passes, no commit needed — this is operational verification, not a code change. If it fails, file a follow-up task and **do not advance to Task 20** until resolved.

---

## Task 20: Push branch + open PR + enable auto-merge

**Files:** none modified; this is a git/gh operation.

### Step 20.1 — Verify worktree state

- [ ] Run:

```bash
git status --short
git log --oneline origin/main..HEAD | head -25
```

Expected: `git status` empty (or only stray ignored files). The log shows ~18 commits from this plan.

### Step 20.2 — Push branch with explicit upstream

- [ ] Run:

```bash
git push -u origin "$(git branch --show-current)"
```

Expected: success message ending with `* [new branch]` line.

### Step 20.3 — Create PR

- [ ] Run:

```bash
gh pr create \
  --title "feat(posthog-tools): dashboards-as-code pipeline + developer-funnel sample" \
  --body "$(cat <<'EOF'
## Summary

Implements Spec 1A (analytics-foundation, sub-spec A): the dashboards-as-code pipeline for Cacheplane's GTM motion.

- New Nx project `posthog-tools` at `tools/posthog/`
- Typed PostHog client via `openapi-fetch` + generated types from PostHog's OpenAPI spec
- `sync` CLI: `--plan` (read-only diff), `--apply` (idempotent upsert + writeback), `--apply --delete-orphans` (explicit)
- `report` CLI: pulls dashboards tagged `gtm`, renders weekly markdown snapshot with sparklines
- Sample dashboard `developer-funnel` + 4 insights (round-trip proof)
- 33 unit tests across `env.spec.ts`, `schema.spec.ts`, `sync.spec.ts`, `report.spec.ts`, `taxonomy.spec.ts`
- Permanent taxonomy guard: every event referenced in any insight JSON must appear in `docs/gtm/taxonomy.md`
- CI: new `posthog-sync-plan` job with Nx-affected gating + soft-skip on missing secret
- Decomposition update: `gtm.md §6/§7` + meta-spec §6 now reflect 1A-1D sub-specs

Spec: [docs/superpowers/specs/gtm/2026-05-14-analytics-foundation-1a-dashboards-as-code-design.md](docs/superpowers/specs/gtm/2026-05-14-analytics-foundation-1a-dashboards-as-code-design.md)

## Test Plan

- [ ] CI passes: lint, test, and `posthog-sync-plan` (Nx-affected gate green)
- [ ] Local `npm run posthog:sync` shows a `[create]` plan for 1 dashboard + 4 insights (or `[update]` if maintainer has already applied)
- [ ] Local `npm run posthog:apply` writes back posthog_ids; the maintainer commits the writeback as `chore(posthog): writeback ids ...`
- [ ] PostHog UI shows the `GTM · Developer funnel` dashboard with 4 tiles (verified via Chrome MCP or manually)
- [ ] Local `npm run posthog:report` produces a valid markdown snapshot at `docs/gtm/reports/<date>-weekly.md`
- [ ] Taxonomy guard test stays green (`nx run posthog-tools:test`)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: prints the PR URL.

### Step 20.4 — Enable auto-merge

- [ ] Run:

```bash
gh pr merge --rebase --auto --delete-branch
```

Expected: PR is marked for auto-merge. GitHub will rebase + merge once CI is green.

### Step 20.5 — Report final state

- [ ] Print the PR URL one more time:

```bash
gh pr view --json url --jq .url
```

Hand off to the user with: "PR open at <url>, auto-merge enabled. Will merge when CI is green."

---

## Self-Review

**1. Spec coverage:**

| Spec § | Task |
|--------|------|
| §3 Scope — Nx project | Task 3 |
| §3 Scope — Generated types | Task 4 |
| §3 Scope — Typed client | Task 7 |
| §3 Scope — Zod schemas | Task 6 |
| §3 Scope — sync CLI | Tasks 8, 9, 10 |
| §3 Scope — report CLI | Tasks 11, 12 |
| §3 Scope — env config | Task 5 |
| §3 Scope — 1 dashboard + 4 insights | Task 13 |
| §3 Scope — CI workflow | Task 16 |
| §3 Scope — 22 tests | Tasks 5, 6, 8, 9, 11, 14 |
| §3 Scope — decomposition update | Task 1 |
| §3 Scope — README alignment | Task 17 |
| §3 Scope — Chrome MCP verification | Task 19 |
| §4 Architecture — three-layer separation | Tasks 5–12 (each file has one job) |
| §5 Sync semantics — matching | Task 8 |
| §5 Sync semantics — apply order | Task 9 |
| §5 Sync semantics — writeback | Task 9 |
| §5 Sync semantics — orphans never auto-deleted | Task 9 (`deleteOrphans:true` test) |
| §6 Report engine — sparkline | Task 11 |
| §6 Report engine — markdown template | Task 11 |
| §6 Report engine — 7-day buckets | Task 12 |
| §7 Sample dashboard content | Task 13 |
| §9 Nx integration | Task 3, 16 |
| §10 Testing — taxonomy guard | Task 14 |
| §12 Deliverables checkbox list | All tasks |

**2. Placeholder scan:** No `TBD`, `TODO`, `implement later`, or vague requirements remain. Production-hardening TODO mentions are explicit deferred items, not plan placeholders. ✓

**3. Type consistency:** Cross-task type references checked:
- `SyncClient` interface (Task 8) used in `applyPlan` (Task 9) and `makeRealClient` (Task 10) — consistent shape.
- `SyncPlan` (Task 8) consumed by `applyPlan` and `formatPlanSummary` (Task 10) — consistent shape.
- `ReportRow` / `ReportSection` (Task 11) consumed by `generateReport` (Task 12) — consistent shape.
- `DashboardLocal` / `InsightLocal` / `CohortLocal` (Task 6) consumed by `loadLocalDir` (Task 8) — consistent.
- Env var name `POSTHOG_PERSONAL_API_KEY` used consistently across Tasks 5, 7, 15, 16, 17, 18. ✓
- Sample dashboard event names (Task 13) match the canonical taxonomy (`cockpit:install_command_copied` etc.) referenced in the meta-spec. ✓
