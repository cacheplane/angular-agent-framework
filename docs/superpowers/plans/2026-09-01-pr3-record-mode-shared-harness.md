# PR 3: Record Mode in the Shared E2E Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `libs/e2e-harness` (the harness all 34 cockpit apps share) the same record mode the examples/chat harness already has, and move the drift differ into the lib so both harness families can use it.

**Architecture:** The lib's `aimock-runner.ts` and the examples' copy are forks of the same file; the examples fork added record mode (`LLMock` native record-proxy) and env wiring. This PR back-ports that: the runner gains the `'record'` mode branch verbatim, a new shared `aimock-mode.ts` resolves `AIMOCK_MODE`/`AIMOCK_RECORD_DIR`/`OPENAI_API_KEY` once for both setup factories, and the drift differ (`drift-lib.ts` + `drift.ts` CLI + tests) moves from `examples/chat/angular/e2e/scripts/` into the lib. **Out of scope** (per spec): tagging cockpit specs `@drift`, a cockpit drift workflow, and deleting the examples' inline harness copies.

**Tech Stack:** TypeScript, `@copilotkit/aimock` LLMock, vitest (`npx nx test e2e-harness`), GitHub Actions (`aimock-drift.yml` path update only).

**Spec:** `docs/superpowers/specs/2026-09-01-blog-damage-control-design.md` (PR 3 section).

---

### Task 1: Record branch in the shared runner

**Files:**
- Modify: `libs/e2e-harness/src/aimock-runner.ts`
- Test: `libs/e2e-harness/src/aimock-runner.spec.ts`

- [ ] **Step 1: Write the failing tests** — append to the `describe('startAimock')` block in `libs/e2e-harness/src/aimock-runner.spec.ts`:

```typescript
  it('boots a record-proxy server with no fixtures', async () => {
    workDir = mkdtempSync(join(tmpdir(), 'aimock-test-'));
    handle = await startAimock({ mode: 'record', recordDir: workDir });
    expect(handle.port).toBeGreaterThan(0);
    expect(handle.baseUrl).toMatch(/^http:\/\/.+\/v1$/);
    // No upstream call is made here — this stops at "the proxy started
    // cleanly"; live recording is a manual smoke (see plan Task 5).
  });

  it('record mode without recordDir throws', async () => {
    await expect(startAimock({ mode: 'record' })).rejects.toThrow('recordDir');
  });

  it('replay mode without fixturePath throws', async () => {
    await expect(startAimock({ mode: 'replay' })).rejects.toThrow('fixturePath');
  });
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx nx test e2e-harness`
Expected: the three new tests FAIL (TypeScript may already refuse `mode: 'record'` — a compile error counts as the failing state).

- [ ] **Step 3: Port the runner changes** — in `libs/e2e-harness/src/aimock-runner.ts`, replace the `AimockStartOptions` interface (lines 15-19) and the top of `startAimock` (lines 47-63) with the examples/chat fork's versions, verbatim:

```typescript
export interface AimockStartOptions {
  mode: 'replay' | 'record';
  /** Replay: path to a fixture file or directory. Ignored in record mode. */
  fixturePath?: string;
  /** Record: directory where captured fixtures are written. Required in record mode. */
  recordDir?: string;
}
```

```typescript
export async function startAimock(opts: AimockStartOptions): Promise<AimockHandle> {
  let mock: LLMock;
  if (opts.mode === 'record') {
    if (!opts.recordDir) throw new Error('record mode requires recordDir');
    // Proxy unmatched requests to the real provider and capture fixtures.
    // Requests carry the caller's Authorization header upstream, so the
    // spawning process must hold a real OPENAI_API_KEY (see the setup
    // factories / resolveAimockLaunch).
    mock = new LLMock({
      port: 0,
      chunkSize: 4096,
      record: {
        providers: { openai: 'https://api.openai.com' },
        fixturePath: opts.recordDir,
      },
    });
  } else {
    if (!opts.fixturePath) throw new Error('replay mode requires fixturePath');
    const entries = loadFixtureEntries(opts.fixturePath);
    // (keep the existing chunkSize comment as rewritten by PR 2)
    mock = new LLMock({ port: 0, chunkSize: 4096 });
    if (entries.length > 0) {
      mock.addFixturesFromJSON(entries as never);
    }
  }
  await mock.start();
  // ... rest of the function unchanged (port/baseUrl/stop)
```

Keep everything below `await mock.start();` exactly as it is today. Note the PR 2 comment rewrite touches the same lines — if PR 2 hasn't merged yet, preserve whichever comment text is on this branch and let git sort it out at rebase.

- [ ] **Step 4: Run the tests**

Run: `npx nx test e2e-harness && npx nx lint e2e-harness`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/e2e-harness/src/aimock-runner.ts libs/e2e-harness/src/aimock-runner.spec.ts
git commit -m "feat(e2e-harness): port aimock record mode from the examples harness"
```

---

### Task 2: Shared mode resolution + factory wiring

**Files:**
- Create: `libs/e2e-harness/src/aimock-mode.ts`
- Modify: `libs/e2e-harness/src/global-setup-factory.ts:79,88-92`
- Modify: `libs/e2e-harness/src/ag-ui-global-setup-factory.ts` (same two spots — the aimock start at ~:78 and the child env at ~:90)
- Modify: `libs/e2e-harness/src/index.ts` (export the new module)
- Test: `libs/e2e-harness/src/aimock-mode.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// SPDX-License-Identifier: MIT
import { describe, it, expect, afterEach } from 'vitest';
import { resolveAimockLaunch } from './aimock-mode';

describe('resolveAimockLaunch', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it('defaults to replay against the fixtures dir with a placeholder key', () => {
    delete process.env['AIMOCK_MODE'];
    const launch = resolveAimockLaunch('/repo/cockpit/x/angular/e2e/fixtures');
    expect(launch.startOptions).toEqual({ mode: 'replay', fixturePath: '/repo/cockpit/x/angular/e2e/fixtures' });
    expect(launch.openaiApiKey).toBe('test-not-used');
  });

  it('record mode reads AIMOCK_RECORD_DIR and passes the real key through', () => {
    process.env['AIMOCK_MODE'] = 'record';
    process.env['AIMOCK_RECORD_DIR'] = '/tmp/recordings';
    process.env['OPENAI_API_KEY'] = 'sk-real';
    const launch = resolveAimockLaunch('/repo/cockpit/x/angular/e2e/fixtures');
    expect(launch.startOptions).toEqual({ mode: 'record', recordDir: '/tmp/recordings' });
    expect(launch.openaiApiKey).toBe('sk-real');
  });

  it('record mode defaults recordDir next to the fixtures dir', () => {
    process.env['AIMOCK_MODE'] = 'record';
    delete process.env['AIMOCK_RECORD_DIR'];
    process.env['OPENAI_API_KEY'] = 'sk-real';
    const launch = resolveAimockLaunch('/repo/cockpit/x/angular/e2e/fixtures');
    expect(launch.startOptions).toEqual({ mode: 'record', recordDir: '/repo/cockpit/x/angular/e2e/.aimock-recordings' });
  });

  it('record mode without OPENAI_API_KEY throws', () => {
    process.env['AIMOCK_MODE'] = 'record';
    delete process.env['OPENAI_API_KEY'];
    expect(() => resolveAimockLaunch('/repo/x/fixtures')).toThrow('OPENAI_API_KEY');
  });
});
```

Run: `npx nx test e2e-harness` — expected: FAIL (module doesn't exist).

- [ ] **Step 2: Implement `aimock-mode.ts`**

```typescript
// SPDX-License-Identifier: MIT
import { dirname, join } from 'node:path';
import type { AimockStartOptions } from './aimock-runner';

export interface AimockLaunch {
  startOptions: AimockStartOptions;
  /** Value for the spawned backend's OPENAI_API_KEY. Record mode proxies
   * upstream, so the auth header must be real; replay never leaves the mock. */
  openaiApiKey: string;
}

/**
 * Resolve replay-vs-record from the environment, the same contract the
 * examples/chat harness established: AIMOCK_MODE=record flips the proxy on,
 * AIMOCK_RECORD_DIR overrides the capture location (default: a sibling
 * `.aimock-recordings/` next to the fixtures dir).
 */
export function resolveAimockLaunch(fixturesDir: string): AimockLaunch {
  if (process.env['AIMOCK_MODE'] === 'record') {
    if (!process.env['OPENAI_API_KEY']) {
      throw new Error(
        '[aimock-harness] AIMOCK_MODE=record requires OPENAI_API_KEY — the record proxy forwards requests to the live provider.',
      );
    }
    return {
      startOptions: {
        mode: 'record',
        recordDir: process.env['AIMOCK_RECORD_DIR'] ?? join(dirname(fixturesDir), '.aimock-recordings'),
      },
      openaiApiKey: process.env['OPENAI_API_KEY'],
    };
  }
  return {
    startOptions: { mode: 'replay', fixturePath: fixturesDir },
    openaiApiKey: 'test-not-used',
  };
}
```

- [ ] **Step 3: Wire both factories** — in `global-setup-factory.ts`:

Add the import: `import { resolveAimockLaunch } from './aimock-mode';`

Replace line 79:
```typescript
    const aimock = await startAimock({ mode: 'replay', fixturePath: opts.fixturesDir });
```
with:
```typescript
    const launch = resolveAimockLaunch(opts.fixturesDir);
    const aimock = await startAimock(launch.startOptions);
```

Replace the child env (lines 88-92):
```typescript
        env: {
          ...process.env,
          OPENAI_BASE_URL: aimock.baseUrl,
          OPENAI_API_KEY: launch.openaiApiKey,
        },
```

Make the identical two edits in `ag-ui-global-setup-factory.ts` (same `startAimock({ mode: 'replay', ... })` call and `OPENAI_API_KEY: 'test-not-used'` literal — the two files are near-clones).

- [ ] **Step 4: Export from the barrel** — add to `libs/e2e-harness/src/index.ts`:

```typescript
export { resolveAimockLaunch, type AimockLaunch } from './aimock-mode';
```

- [ ] **Step 5: Test, lint, commit**

Run: `npx nx test e2e-harness && npx nx lint e2e-harness`
Expected: PASS.

```bash
git add libs/e2e-harness/src/aimock-mode.ts libs/e2e-harness/src/aimock-mode.spec.ts libs/e2e-harness/src/global-setup-factory.ts libs/e2e-harness/src/ag-ui-global-setup-factory.ts libs/e2e-harness/src/index.ts
git commit -m "feat(e2e-harness): AIMOCK_MODE env wiring for both setup factories"
```

---

### Task 3: Move the drift differ into the lib

**Files:**
- Move: `examples/chat/angular/e2e/scripts/drift-lib.ts` → `libs/e2e-harness/src/drift-lib.ts`
- Move: `examples/chat/angular/e2e/scripts/drift.ts` → `libs/e2e-harness/src/drift.ts`
- Move: `examples/chat/angular/e2e/scripts/drift-lib.test.ts` → `libs/e2e-harness/src/drift-lib.spec.ts`
- Modify: `.github/workflows/aimock-drift.yml` (~line 57)

- [ ] **Step 1: Move the files**

```bash
git mv examples/chat/angular/e2e/scripts/drift-lib.ts libs/e2e-harness/src/drift-lib.ts
git mv examples/chat/angular/e2e/scripts/drift.ts libs/e2e-harness/src/drift.ts
git mv examples/chat/angular/e2e/scripts/drift-lib.test.ts libs/e2e-harness/src/drift-lib.spec.ts
```

`drift-lib.ts` moves unchanged. Confirm nothing else imported the old paths: `grep -rn "scripts/drift" examples/ .github/ --include="*.ts" --include="*.yml"` — the only hit should be the workflow line edited below (plus `drift.ts`'s own relative import, which survives the move intact since both files moved together).

- [ ] **Step 2: Parameterize the committed-fixtures dir in `drift.ts`**

Replace:
```typescript
const FIXTURES_DIR = resolve(__dirname, '../fixtures');
```
and the argv handling:
```typescript
const recordedDir = process.argv[2];
if (!recordedDir) {
  console.error('usage: tsx drift.ts <recorded-fixtures-dir>');
  process.exit(1);
}
```
with:
```typescript
const recordedDir = process.argv[2];
const fixturesDir = process.argv[3];
if (!recordedDir || !fixturesDir) {
  console.error('usage: tsx drift.ts <recorded-fixtures-dir> <committed-fixtures-dir>');
  process.exit(1);
}
const FIXTURES_DIR = resolve(fixturesDir);
```
(Keep every use of `FIXTURES_DIR` below unchanged; declaration order may need the `const FIXTURES_DIR` line hoisted above its first use — check the rest of the file after editing.)

- [ ] **Step 3: Convert the test file to vitest** — in `drift-lib.spec.ts`, replace only the runner import:

Old:
```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
```
New:
```typescript
import { test } from 'vitest';
import assert from 'node:assert/strict';
```
`node:assert/strict` assertions run fine under vitest; nothing else changes. This also *wires* these tests for the first time — `npx nx test e2e-harness` (vitest, `libs/e2e-harness` cwd) now runs them, whereas the old `node:test` file wasn't executed by any target.

- [ ] **Step 4: Update the drift workflow path** — in `.github/workflows/aimock-drift.yml`, the "Structural diff vs committed fixtures" step (working-directory `examples/chat/angular`):

Old:
```yaml
          npx tsx e2e/scripts/drift.ts "${{ runner.temp }}/recordings" | tee "${{ runner.temp }}/drift-report.json"
```
New:
```yaml
          npx tsx ../../../libs/e2e-harness/src/drift.ts "${{ runner.temp }}/recordings" e2e/fixtures | tee "${{ runner.temp }}/drift-report.json"
```
Verify the relative depth: `examples/chat/angular` → repo root is three levels up. Sanity-check locally from that directory: `npx tsx ../../../libs/e2e-harness/src/drift.ts --help 2>&1 | head -2` should print the usage line, not a module-not-found error.

- [ ] **Step 5: Run everything, commit**

Run: `npx nx test e2e-harness && npx nx lint e2e-harness`
Expected: PASS, now including the drift-lib tests.

```bash
git add -A libs/e2e-harness/src examples/chat/angular/e2e/scripts .github/workflows/aimock-drift.yml
git commit -m "refactor(e2e-harness): move the drift differ into the shared harness lib"
```

---

### Task 4: Replay regression check against a real cockpit cap

- [ ] **Step 1: Run one cockpit cap e2e in replay** (proves the factory refactor changed nothing for the 31 existing consumers). Precondition: `npm ci` has been run once in this worktree; free the cap's ports of orphans first.

Run: `npx playwright test --config cockpit/chat/messages/angular/e2e/playwright.config.ts`
Expected: PASS, identical to pre-change behavior.

- [ ] **Step 2: Commit nothing** — this step is verification only. If it fails, the factory wiring in Task 2 regressed replay; debug there (the usual trap is an env var leaking from your shell — `AIMOCK_MODE` set to `record` makes the harness demand a key; run with `env -u AIMOCK_MODE` to be sure).

---

### Task 5: Local record smoke (manual, not CI)

- [ ] **Step 1: One live-record run against the same cap** to prove the proxy path end to end. Requires a real key in the environment (source ONLY `OPENAI_API_KEY` — exporting the whole root `.env` flips on unrelated auth middleware):

```bash
AIMOCK_MODE=record OPENAI_API_KEY="$OPENAI_API_KEY" npx playwright test --config cockpit/chat/messages/angular/e2e/playwright.config.ts --grep "user message and AI response"
ls cockpit/chat/messages/angular/e2e/.aimock-recordings/
```
Expected: the spec may fail its exact-text assertion (live model ≠ canned copy — that's fine, it isn't a `@drift` contract spec); the recordings dir contains at least one captured JSON fixture. Delete the recordings dir afterwards; do not commit it.

```bash
rm -rf cockpit/chat/messages/angular/e2e/.aimock-recordings
```

- [ ] **Step 2: Add `.aimock-recordings` to the ignore file** if not already covered:

Run: `grep -rn "aimock-recordings" .gitignore examples/chat/angular/.gitignore 2>/dev/null`
If no hit covers the cockpit paths, append to the root `.gitignore`:
```
.aimock-recordings/
```
and commit:
```bash
git add .gitignore
git commit -m "chore: ignore aimock recording scratch dirs"
```

---

### Task 6: Final verification and PR

- [ ] **Step 1:** `npx nx test e2e-harness && npx nx lint e2e-harness` → PASS; replay e2e from Task 4 already green.
- [ ] **Step 2:** Open the PR, title `feat(e2e-harness): record mode and drift differ in the shared harness`. Body notes what's deliberately deferred: `@drift` tagging for cockpit caps, a cockpit drift workflow, and the per-cap entry-key collision design. Address AI review comments before arming auto-merge.
