# aimock scaffold generator + helper consolidation — design

> **Place in the larger plan.** Cleanup #2 in the pre-batching arc. After PR #469 (matrix migration) landed, adding a new aimock cap requires creating 5 files in `cockpit/<product>/<topic>/angular/e2e/`, editing the cap's `project.json`, and appending a matrix entry to ci.yml. This PR ships a throwaway generator that does all three from the capability registry — making the Task #4 batch of 7 chat caps mechanical. Also consolidates the duplicate submit-and-wait helpers in `libs/e2e-harness/`.

## Goal

Two deliverables in one PR:

1. **`scripts/generate-aimock-scaffold.ts`** — single-cap generator. `npx tsx scripts/generate-aimock-scaffold.ts --cap <id>` reads the registry, emits 5 e2e/ files, edits the cap's project.json, and appends a matrix entry to ci.yml.
2. **Helper consolidation** — migrate the 3 cockpit cap specs currently using `sendPromptAndWait` to `submitAndWaitForResponse`; delete `sendPromptAndWait` from `libs/e2e-harness/`.

## Non-goals

- Generator removal (the script is throwaway — delete after Task #4 batch completes; not this PR's scope).
- Touching `examples/chat/angular/e2e/test-helpers.ts` or its 5 callers. That file defines its OWN local `sendPromptAndWait` — separate ownership boundary. Flag as follow-up task.
- Removing the interrupt-flow helpers (`sendPromptAndWaitForInterrupt`, `clickInterruptActionAndWaitFinal`). Those are not duplicating; c-interrupts depends on them.
- Generator features beyond `--cap <id>` (no `--all-missing`, no `--dry-run`, no overwrite mode). YAGNI for a throwaway.
- Authoring per-cap fixtures or spec assertions. The generator emits TODO skeletons; humans fill in per-cap content during the batch.

## Component 1 — `scripts/generate-aimock-scaffold.ts`

### CLI shape

```
npx tsx scripts/generate-aimock-scaffold.ts --cap <cap-id>
```

Exactly one required flag. Exits with non-zero status (and a clear error) if:

- `--cap` missing or empty
- cap-id not found in `apps/cockpit/scripts/capability-registry.ts`
- cap entry's `pythonDir` is undefined (ag-ui-style in-process caps are out of scope)
- Any target file already exists (clean abort, no partial writes)

### What it creates

Reads the cap entry from `apps/cockpit/scripts/capability-registry.ts` to derive: `id`, `product`, `topic`, `angularProject`, `port`, `pythonPort`, `pythonDir`.

Creates these 5 files under `cockpit/<product>/<topic>/angular/e2e/`:

**`playwright.config.ts`** — port substituted (baseURL `http://localhost:${port}`), structure verbatim from c-interrupts:

```typescript
// SPDX-License-Identifier: MIT
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:<port>',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  globalSetup: './global-setup-impl.ts',
  globalTeardown: require.resolve('../../../../../libs/e2e-harness/src/global-teardown'),
});
```

**`global-setup-impl.ts`** — paths/ports substituted from registry:

```typescript
// SPDX-License-Identifier: MIT
import { resolve } from 'node:path';
import { createGlobalSetup } from '../../../../../libs/e2e-harness/src';

export default createGlobalSetup({
  langgraphCwd: '<pythonDir>',
  langgraphPort: <pythonPort>,
  angularProject: '<angularProject>',
  angularPort: <port>,
  fixturesDir: resolve(__dirname, 'fixtures'),
});
```

**`tsconfig.json`** — verbatim from c-interrupts (no substitution):

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["**/*.ts"],
  "exclude": ["node_modules", "test-results", "playwright-report"]
}
```

**`fixtures/<cap-id>.json`** — skeleton with one TODO entry:

```json
{
  "fixtures": [
    {
      "match": { "userMessage": "TODO-prompt" },
      "response": { "content": "TODO-response" }
    }
  ]
}
```

**`<cap-id>.spec.ts`** — skeleton importing `submitAndWaitForResponse`, one failing test:

```typescript
// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';
import { submitAndWaitForResponse } from '../../../../../libs/e2e-harness/src';

test('<cap-id>: TODO — describe behavior', async ({ page }) => {
  const bubble = await submitAndWaitForResponse(page, 'TODO-prompt');
  await expect(bubble).toContainText('TODO-substring');
});
```

### What it modifies

**`cockpit/<product>/<topic>/angular/project.json`** — adds an `e2e` target:

```json
"e2e": {
  "executor": "@nx/playwright:playwright",
  "options": {
    "config": "cockpit/<product>/<topic>/angular/e2e/playwright.config.ts"
  }
}
```

Implementation: parse the JSON with `JSON.parse`, mutate `targets.e2e`, serialize with `JSON.stringify(obj, null, 2)` + trailing newline. Refuses if `targets.e2e` already exists.

**`.github/workflows/ci.yml`** — appends a matrix entry to the `cockpit-e2e` job's matrix list:

```yaml
          - { angular: <angularProject>,    python: <pythonDir> }
```

Implementation: read the file as a string, find the last `{ angular: ` line in the matrix block (regex `/^\s+- \{ angular: cockpit-[^}]+\}/m` with global flag), insert the new entry after it (matching the existing two-space-spaces-spaces-spaces indent of `          - `). Then YAML-parse the result to verify validity; reject if parsing fails. Refuses if a matrix entry for this `angularProject` already exists.

### Error contract

All errors print to stderr and exit with code 1. Examples:

- `Error: cap "c-bogus" not found in apps/cockpit/scripts/capability-registry.ts`
- `Error: cap "ag-ui-streaming" has no pythonDir (in-process cap not eligible for aimock e2e)`
- `Error: cockpit/chat/messages/angular/e2e/playwright.config.ts already exists; refusing to overwrite`
- `Error: project.json already has an e2e target for cockpit-chat-messages-angular`
- `Error: ci.yml matrix already contains entry for cockpit-chat-messages-angular`

No partial writes: validate all preconditions BEFORE making any filesystem change.

## Component 2 — Helper consolidation

### Migrate 3 cockpit cap specs

Replace `sendPromptAndWait` with `submitAndWaitForResponse` in:

- `cockpit/langgraph/streaming/angular/e2e/streaming.spec.ts`
- `cockpit/chat/tool-calls/angular/e2e/c-tool-calls.spec.ts`
- `cockpit/chat/subagents/angular/e2e/c-subagents.spec.ts`

Each spec uses `sendPromptAndWait` once or twice via direct call. The signatures are compatible: both take `(page, prompt)`, both return `Promise<Locator>` of the finalized assistant bubble. Mechanical find-and-replace of the import + call sites.

### Remove `sendPromptAndWait` from the harness

- Delete the function body in `libs/e2e-harness/src/test-helpers.ts`.
- Delete the `SendPromptAndWaitOptions` interface (only `sendPromptAndWait` used it; `submitAndWaitForResponse` has its own inline options shape).
- Remove `sendPromptAndWait` and `SendPromptAndWaitOptions` from the re-export block in `libs/e2e-harness/src/index.ts`.

Keep `sendPromptAndWaitForInterrupt` + `clickInterruptActionAndWaitFinal` — interrupt-flow specific.

## Verification

### Generator

- `npx tsx scripts/generate-aimock-scaffold.ts --cap c-messages` against a clean tree (no pre-existing e2e/) produces:
  - 5 new files under `cockpit/chat/messages/angular/e2e/` (and `fixtures/` directory).
  - `cockpit/chat/messages/angular/project.json` gains the e2e target.
  - `.github/workflows/ci.yml` gains a matrix entry.
- `npx tsc --noEmit cockpit/chat/messages/angular/e2e/global-setup-impl.ts` succeeds (resolves the harness import).
- `npx nx build cockpit-chat-messages-angular` still passes.
- Running the generator a second time on the same cap fails cleanly (`refusing to overwrite`).
- Running with an unknown cap id fails cleanly.
- Running with `ag-ui-streaming` fails cleanly (no pythonDir).

### Helper consolidation

- `git grep 'sendPromptAndWait\b' cockpit libs` returns nothing.
- `git grep 'sendPromptAndWait\b' examples` still returns hits (intentional — separate ownership).
- 3 migrated cap specs build clean: `npx nx test cockpit-e2e-wiring` passes (registry/proxy/ci.yml cross-check intact).
- CI matrix passes — same 4 caps pass their e2es with the new helper.

## Risk surface

- **Generator filesystem race.** Generator validates all preconditions (no overwrites, no duplicate project.json/ci.yml entries) BEFORE writing anything. Aborts cleanly on first conflict. Acceptable.
- **YAML insertion fragility.** ci.yml editing uses regex-located insertion + YAML reparse verification. If the matrix block shape ever changes (e.g., gets reformatted), the regex will miss and the generator will refuse to insert — visible failure, not silent corruption.
- **JSON re-serialization formatting.** project.json files use 2-space indent + trailing newline. `JSON.stringify(obj, null, 2) + '\n'` matches that convention. If a project.json has unusual formatting (it shouldn't — all are generated by Nx), the generator preserves nothing beyond key/value semantics. Acceptable; reviewers see the diff.
- **3-cap migration semantic shift.** `sendPromptAndWait` waited for the Stop generating button to appear (then disappear). `submitAndWaitForResponse` waits directly on the assistant bubble's `data-streaming="false"` end state. For composed-`<chat>` caps (all 3 migrated specs use `<chat>`), the end state is the same; the migration loses fail-fast diagnostics for failed submits but the assertion semantics are unchanged. CI passes are the proof.
- **Throwaway tooling debt.** The generator is intentionally throwaway. Adding a follow-up task to remove it after the Task #4 batch completes prevents long-term accumulation.

## Acceptance criteria

- `scripts/generate-aimock-scaffold.ts` exists; CLI is `--cap <id>`; produces 5 files + project.json edit + ci.yml matrix-entry addition.
- Generator errors cleanly on missing cap, no-pythonDir cap, and any pre-existing target.
- No partial writes on error.
- 3 cockpit cap specs migrated to `submitAndWaitForResponse`.
- `sendPromptAndWait` removed from `libs/e2e-harness/src/test-helpers.ts` and from `index.ts` exports.
- `git grep 'sendPromptAndWait\b' cockpit libs` returns nothing.
- `Cockpit — e2e` matrix (all 4 expansions) passes in CI.
- `Cockpit — build / test` passes (cockpit-e2e-wiring still happy).
- `Cockpit — build all examples` passes.

## Follow-ups (out of scope)

- **Delete the generator** after Task #4 batch (7 chat caps) completes — separate cleanup PR.
- **Consolidate `examples/chat`'s local `sendPromptAndWait`** with the harness's `submitAndWaitForResponse` — separate task, broader dependency surface.
- **Task #4 re-pilot** (c-messages aimock against fixed demo + new helper) uses the generator as its first real test.
- **Task #4 batch** (7 chat caps) is the generator's primary use case — runs after the c-messages re-pilot proves the pattern.

**End state:** A throwaway `scripts/generate-aimock-scaffold.ts` ready to mechanize Task #4. One canonical submit-and-wait helper in the harness. The Task #4 c-messages re-pilot becomes: `npx tsx scripts/generate-aimock-scaffold.ts --cap c-messages` → hand-author the fixture's match block and the spec's TODO assertions → CI green → merge. Same shape for each of the 7 batch caps.
