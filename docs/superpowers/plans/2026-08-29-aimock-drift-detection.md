# Aimock Drift Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the never-worked drift check with one that runs a `@drift`-tagged e2e subset against the live provider through aimock's record-proxy, then structurally diffs the recordings against committed fixtures.

**Architecture:** The examples/chat e2e harness gains a record mode (aimock's `LLMock` supports `record: { providers, fixturePath }` natively — no CLI shelling). A tagged contract-only subset of specs is the drift gate; a rewritten `drift.ts` differ is the diagnostic. The weekly workflow uploads recordings as artifacts and opens an issue on failure.

**Tech Stack:** `aimock` (LLMock library), Playwright (`--grep`), tsx, `node:test` via tsx for differ tests, GitHub Actions.

**Source of truth:** `docs/superpowers/specs/2026-08-29-aimock-drift-detection-design.md`. Read it before Task 1.

**Key facts an implementer must not rediscover the hard way:**
- `LLMock`'s `MockServerOptions.record?: RecordConfig` with `RecordConfig = { providers: Partial<Record<RecordProviderKey, string>>, fixturePath?: string, ... }`; `'openai'` is a valid `RecordProviderKey`. Verified in `node_modules/aimock/dist/types.d.ts`.
- The old `drift.ts` failed because it shelled to `llmock --out`, which is not a CLI option. Do not resurrect any CLI invocation.
- In replay mode, `global-setup.ts` gives the langgraph child `OPENAI_API_KEY: 'test-not-used'`. In record mode the child MUST receive the real key — the proxy forwards the request upstream, auth header included.
- `examples/chat/angular/e2e/playwright.config.ts` already has `retries: process.env.CI ? 2 : 0`, which satisfies the spec's "one flaky generation should not page anyone" (spec said 1 retry; CI's existing 2 is fine — do not add config).

---

## File Structure

- Modify: `examples/chat/angular/e2e/aimock-runner.ts` — add `mode: 'record'`.
- Modify: `examples/chat/angular/e2e/global-setup.ts` — mode from `AIMOCK_MODE`, real key pass-through in record mode.
- Modify: `examples/chat/angular/e2e/send-receive.spec.ts`, `research-subagent.spec.ts`, `interrupt-approval.spec.ts` — add `@drift` to three verified-contract titles.
- Create: `examples/chat/angular/e2e/scripts/drift-lib.ts` — pure differ functions.
- Create: `examples/chat/angular/e2e/scripts/drift-lib.test.ts` — `node:test` spec.
- Rewrite: `examples/chat/angular/e2e/scripts/drift.ts` — thin CLI over drift-lib.
- Modify: `.github/workflows/aimock-drift.yml` — cron, record run, artifact, issue.

---

### Task 1: Record mode in the aimock runner

**Files:**
- Modify: `examples/chat/angular/e2e/aimock-runner.ts`
- Test: `examples/chat/angular/e2e/aimock-runner.spec.ts` (exists; run via the repo's vitest for that dir — check header of the file for its runner, it is exercised by `npx vitest run` from `examples/chat/angular` if configured, otherwise by `npx tsx --test`; if neither is wired, add the assertion to Task 1 Step 4's boot check instead and note it in the commit)

- [ ] **Step 1: Extend the options type**

In `aimock-runner.ts`, replace the `AimockStartOptions` interface:

```typescript
export interface AimockStartOptions {
  mode: 'replay' | 'record';
  /** Replay: path to a fixture file or directory. Ignored in record mode. */
  fixturePath?: string;
  /** Record: directory where captured fixtures are written. Required in record mode. */
  recordDir?: string;
}
```

- [ ] **Step 2: Branch construction on mode**

Replace the body of `startAimock` up to `await mock.start()`:

```typescript
export async function startAimock(opts: AimockStartOptions): Promise<AimockHandle> {
  let mock: LLMock;
  if (opts.mode === 'record') {
    if (!opts.recordDir) throw new Error('record mode requires recordDir');
    // Proxy unmatched requests to the real provider and capture fixtures.
    // Requests carry the caller's Authorization header upstream, so the
    // spawning process must hold a real OPENAI_API_KEY (see global-setup).
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
    // Use a large default chunkSize so ordinary fixture responses arrive in 1-2
    // SSE deltas. Most e2e assertions measure the final rendered DOM, while
    // targeted streaming regressions opt into smaller per-fixture chunks.
    mock = new LLMock({ port: 0, chunkSize: 4096 });
    if (entries.length > 0) {
      mock.addFixturesFromJSON(entries as never);
    }
  }
  await mock.start();
```

Keep the rest (port/baseUrl/stop) unchanged. Keep the existing comment text exactly — the blog post quotes it.

- [ ] **Step 3: Verify replay mode is untouched**

Run: `cd examples/chat/angular && npx playwright test --config e2e/playwright.config.ts e2e/send-receive.spec.ts`
Expected: PASS (replay path unchanged). If this suite can't run locally (ports busy), run `lsof -ti:4200 -ti:2024 | xargs kill -9` first per repo convention.

- [ ] **Step 4: Boot-check record mode without an upstream call**

Run:
```bash
cd examples/chat/angular && npx tsx -e "
import { startAimock } from './e2e/aimock-runner';
const h = await startAimock({ mode: 'record', recordDir: '/tmp/aimock-rec-check' });
console.log('record mode boots at', h.baseUrl);
await h.stop();
"
```
Expected: prints a localhost URL and exits 0. No request is proxied, so no key is needed for the boot check.

- [ ] **Step 5: Commit**

```bash
git add examples/chat/angular/e2e/aimock-runner.ts
git commit -m "feat(examples-chat): record mode for the aimock e2e runner"
```

---

### Task 2: Mode selection in global-setup

**Files:**
- Modify: `examples/chat/angular/e2e/global-setup.ts`

- [ ] **Step 1: Read mode and record dir from env; fail fast without a key**

Replace the single `startAimock` call:

```typescript
const AIMOCK_MODE = process.env.AIMOCK_MODE === 'record' ? 'record' : 'replay';
const RECORD_DIR = process.env.AIMOCK_RECORD_DIR
  ?? resolve(__dirname, '../.aimock-recordings');

if (AIMOCK_MODE === 'record' && !process.env.OPENAI_API_KEY) {
  throw new Error(
    '[aimock-e2e] AIMOCK_MODE=record requires OPENAI_API_KEY — the record proxy forwards requests to the live provider.'
  );
}

const aimock = AIMOCK_MODE === 'record'
  ? await startAimock({ mode: 'record', recordDir: RECORD_DIR })
  : await startAimock({ mode: 'replay', fixturePath: FIXTURE_PATH });
// eslint-disable-next-line no-console
console.log(`[aimock-e2e] aimock (${AIMOCK_MODE}) listening at ${aimock.baseUrl}`);
```

- [ ] **Step 2: Give the langgraph child the real key in record mode**

In the `spawn('uv', ['run', 'langgraph', ...])` env block, replace `OPENAI_API_KEY: 'test-not-used',` with:

```typescript
        // Record mode proxies upstream; the auth header must be real.
        OPENAI_API_KEY: AIMOCK_MODE === 'record'
          ? (process.env.OPENAI_API_KEY as string)
          : 'test-not-used',
```

- [ ] **Step 3: Verify replay default unchanged**

Run: `cd examples/chat/angular && npx playwright test --config e2e/playwright.config.ts e2e/send-receive.spec.ts`
Expected: PASS with `aimock (replay) listening` in the log.

- [ ] **Step 4: Commit**

```bash
git add examples/chat/angular/e2e/global-setup.ts
git commit -m "feat(examples-chat): AIMOCK_MODE=record wiring in e2e global-setup"
```

---

### Task 3: Tag the drift-safe specs

**Files:**
- Modify: `examples/chat/angular/e2e/send-receive.spec.ts`
- Modify: `examples/chat/angular/e2e/research-subagent.spec.ts`
- Modify: `examples/chat/angular/e2e/interrupt-approval.spec.ts`

The rule (from the spec): an assertion may depend on *shape* (element exists, non-empty, count, enabled/disabled), never on *content of a canned response*. Three specs were verified against this rule at design time. **Do not tag the main send-receive test** — it asserts `toContainText('Streaming smoke response begins')`, which is fixture content.

- [ ] **Step 1: Tag the `hi` test in send-receive.spec.ts**

Change the title `'hi: assistant bubble renders non-empty text from the replayed fixture'` to:

```typescript
test('hi: assistant bubble renders non-empty text @drift', async ({ page }) => {
```

Also update the title's trailing words as shown — "from the replayed fixture" is no longer accurate for a test that also runs live. Keep every assertion unchanged; `finalText.trim()).toMatch(/hi/i)` is acceptable live (a greeting elicits a greeting).

- [ ] **Step 2: Tag research-subagent.spec.ts**

```typescript
test('research subagent: parent dispatches research, subagent content surfaces in the bubble @drift', async ({
```

Its only assertion is `chat-subagent-card` visibility — pure contract, and exactly the "prompt still elicits the tool call" drift signal.

- [ ] **Step 3: Tag interrupt-approval.spec.ts**

```typescript
test('interrupt approval: pause renders the interrupt panel with the captured reason @drift', async ({
```

Its assertions are panel attachment, UI copy (`/agent paused/i`), and buttons — all shape.

- [ ] **Step 4: Verify the grep selects exactly three tests**

Run: `cd examples/chat/angular && npx playwright test --config e2e/playwright.config.ts --grep @drift --list`
Expected: exactly 3 tests listed, the ones above.

- [ ] **Step 5: Run the tagged subset in replay to prove they still pass**

Run: `cd examples/chat/angular && npx playwright test --config e2e/playwright.config.ts --grep @drift`
Expected: 3 passed.

- [ ] **Step 6: Commit**

```bash
git add examples/chat/angular/e2e/send-receive.spec.ts examples/chat/angular/e2e/research-subagent.spec.ts examples/chat/angular/e2e/interrupt-approval.spec.ts
git commit -m "feat(examples-chat): tag the contract-only @drift e2e subset"
```

---

### Task 4: The differ

**Files:**
- Create: `examples/chat/angular/e2e/scripts/drift-lib.ts`
- Create: `examples/chat/angular/e2e/scripts/drift-lib.test.ts`
- Rewrite: `examples/chat/angular/e2e/scripts/drift.ts`

- [ ] **Step 1: Write the failing test**

Create `drift-lib.test.ts`:

```typescript
// SPDX-License-Identifier: MIT
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeEntry, diffFixtures, type FixtureEntry } from './drift-lib';

const text = (msg: string, content: string): FixtureEntry => ({
  match: { userMessage: msg },
  response: { content },
});
const tool = (msg: string, names: string[]): FixtureEntry => ({
  match: { userMessage: msg },
  response: { toolCalls: names.map((name) => ({ name, arguments: {} })) },
});

test('summarizeEntry: text response', () => {
  const s = summarizeEntry(text('hi', 'hello there'));
  assert.equal(s.kind, 'text');
  assert.deepEqual(s.toolNames, []);
  assert.equal(typeof s.lengthBucket, 'number');
});

test('summarizeEntry: toolCalls response', () => {
  const s = summarizeEntry(tool('plan', ['research', 'book']));
  assert.equal(s.kind, 'toolCalls');
  assert.deepEqual(s.toolNames, ['book', 'research']); // sorted
});

test('diffFixtures: identical pair reports no differences', () => {
  const d = diffFixtures([text('hi', 'hello')], [text('hi', 'hello world')]);
  assert.equal(d.changed.length, 0); // same kind, same tools, same bucket
});

test('diffFixtures: tool set change is reported', () => {
  const d = diffFixtures([tool('plan', ['research'])], [tool('plan', ['book'])]);
  assert.equal(d.changed.length, 1);
  assert.match(d.changed[0].reason, /toolNames/);
});

test('diffFixtures: kind change is reported', () => {
  const d = diffFixtures([tool('plan', ['research'])], [text('plan', 'sure!')]);
  assert.equal(d.changed.length, 1);
  assert.match(d.changed[0].reason, /kind/);
});

test('diffFixtures: unpairable entries are listed, not errored', () => {
  const d = diffFixtures([text('only-committed', 'x')], [text('only-recorded', 'y')]);
  assert.deepEqual(d.unmatchedCommitted, ['only-committed']);
  assert.deepEqual(d.unmatchedRecorded, ['only-recorded']);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd examples/chat/angular && npx tsx --test e2e/scripts/drift-lib.test.ts`
Expected: FAIL — cannot find module './drift-lib'.

- [ ] **Step 3: Implement drift-lib.ts**

```typescript
// SPDX-License-Identifier: MIT
// Structural fixture differ. Never a gate by itself: the @drift spec results
// are the gate; this explains a red run. Compares tool names, response kind,
// and a coarse length bucket — deliberately NOT byte equality and NOT meaning.

export interface FixtureEntry {
  match: Record<string, unknown>;
  response: Record<string, unknown>;
}

export interface EntrySummary {
  key: string;
  kind: 'text' | 'toolCalls';
  toolNames: string[];
  /** floor(log10(JSON length)) — order-of-magnitude only. */
  lengthBucket: number;
}

export interface DriftReport {
  changed: Array<{ key: string; reason: string; committed: EntrySummary; recorded: EntrySummary }>;
  unmatchedCommitted: string[];
  unmatchedRecorded: string[];
}

function entryKey(e: FixtureEntry): string {
  const m = e.match ?? {};
  return [m['userMessage'] ?? '', m['toolName'] ?? '', m['hasToolResult'] ? 'tr' : '']
    .join('|');
}

export function summarizeEntry(e: FixtureEntry): EntrySummary {
  const toolCalls = e.response?.['toolCalls'];
  const names = Array.isArray(toolCalls)
    ? toolCalls
        .map((t) => (t && typeof t === 'object' ? String((t as Record<string, unknown>)['name'] ?? '') : ''))
        .filter(Boolean)
        .sort()
    : [];
  return {
    key: entryKey(e),
    kind: names.length > 0 ? 'toolCalls' : 'text',
    toolNames: names,
    lengthBucket: Math.floor(Math.log10(Math.max(1, JSON.stringify(e.response ?? {}).length))),
  };
}

export function diffFixtures(committed: FixtureEntry[], recorded: FixtureEntry[]): DriftReport {
  const byKey = (list: FixtureEntry[]) => new Map(list.map((e) => [entryKey(e), summarizeEntry(e)]));
  const c = byKey(committed);
  const r = byKey(recorded);
  const report: DriftReport = { changed: [], unmatchedCommitted: [], unmatchedRecorded: [] };
  for (const [key, cs] of c) {
    const rs = r.get(key);
    if (!rs) { report.unmatchedCommitted.push(key); continue; }
    const reasons: string[] = [];
    if (cs.kind !== rs.kind) reasons.push(`kind: ${cs.kind} -> ${rs.kind}`);
    if (cs.toolNames.join(',') !== rs.toolNames.join(',')) reasons.push(`toolNames: [${cs.toolNames}] -> [${rs.toolNames}]`);
    if (cs.lengthBucket !== rs.lengthBucket) reasons.push(`lengthBucket: ${cs.lengthBucket} -> ${rs.lengthBucket}`);
    if (reasons.length) report.changed.push({ key, reason: reasons.join('; '), committed: cs, recorded: rs });
  }
  for (const key of r.keys()) if (!c.has(key)) report.unmatchedRecorded.push(key);
  return report;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd examples/chat/angular && npx tsx --test e2e/scripts/drift-lib.test.ts`
Expected: 6 pass.

- [ ] **Step 5: Rewrite drift.ts as a thin CLI**

Replace the entire contents of `e2e/scripts/drift.ts`:

```typescript
// SPDX-License-Identifier: MIT
// Diagnostic differ: compares recorded fixtures (arg 1: directory) against the
// committed fixtures directory. Prints a JSON DriftReport to stdout and a
// human summary to stderr. Exit code is ALWAYS 0 unless inputs are unreadable —
// the @drift e2e subset is the gate, not this script.
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { diffFixtures, type FixtureEntry } from './drift-lib';

const FIXTURES_DIR = resolve(__dirname, '../fixtures');

function loadDir(dir: string): FixtureEntry[] {
  const out: FixtureEntry[] = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
    const parsed = JSON.parse(readFileSync(join(dir, f), 'utf-8')) as { fixtures?: FixtureEntry[] };
    for (const e of parsed.fixtures ?? []) out.push(e);
  }
  return out;
}

const recordedDir = process.argv[2];
if (!recordedDir) {
  console.error('usage: tsx drift.ts <recorded-fixtures-dir>');
  process.exit(1);
}

const report = diffFixtures(loadDir(FIXTURES_DIR), loadDir(resolve(recordedDir)));
console.log(JSON.stringify(report, null, 2));
console.error(
  `[drift] changed=${report.changed.length} unmatchedCommitted=${report.unmatchedCommitted.length} unmatchedRecorded=${report.unmatchedRecorded.length}`
);
```

- [ ] **Step 6: Smoke the CLI against itself**

Run: `cd examples/chat/angular && npx tsx e2e/scripts/drift.ts e2e/fixtures`
Expected: exit 0; `changed=0` (a directory diffed against itself), full JSON on stdout.

- [ ] **Step 7: Commit**

```bash
git add examples/chat/angular/e2e/scripts/drift-lib.ts examples/chat/angular/e2e/scripts/drift-lib.test.ts examples/chat/angular/e2e/scripts/drift.ts
git commit -m "feat(examples-chat): structural fixture differ replacing the broken drift script"
```

---

### Task 5: The workflow

**Files:**
- Modify: `.github/workflows/aimock-drift.yml`

- [ ] **Step 1: Rewrite the workflow**

Replace the file's `on:` block and `jobs:` (keep `concurrency`, `permissions`, `env` as-is; keep every existing action pin SHA exactly — copy them from the current file and from the `examples/chat — e2e` job in `.github/workflows/ci.yml` for the uv/playwright steps):

```yaml
on:
  workflow_dispatch:
  schedule:
    # Weekly, Monday 09:00 UTC. Advisory only — never a merge gate.
    - cron: '0 9 * * 1'

jobs:
  drift:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@<existing pin>
      - uses: actions/setup-node@<existing pin>
        with:
          node-version: 22
          cache: npm
      - name: Install uv
        uses: astral-sh/setup-uv@<pin from ci.yml>
      - run: npm ci
      - name: Sync examples-chat python
        working-directory: examples/chat/python
        run: uv sync
      - run: npx playwright install --with-deps chromium
      - name: Run @drift subset against the live provider
        id: drift-run
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          AIMOCK_MODE: record
          AIMOCK_RECORD_DIR: ${{ runner.temp }}/recordings
        working-directory: examples/chat/angular
        run: npx playwright test --config e2e/playwright.config.ts --grep @drift
      - name: Structural diff vs committed fixtures
        if: always()
        working-directory: examples/chat/angular
        run: |
          mkdir -p "${{ runner.temp }}/recordings"
          npx tsx e2e/scripts/drift.ts "${{ runner.temp }}/recordings" | tee "${{ runner.temp }}/drift-report.json"
      - name: Upload recordings artifact
        if: always()
        uses: actions/upload-artifact@<pin — reuse an existing upload-artifact pin from ci.yml>
        with:
          name: aimock-recordings
          path: ${{ runner.temp }}/recordings
          if-no-files-found: warn
      - name: Open issue on drift
        if: failure()
        uses: actions/github-script@<existing pin>
        with:
          script: |
            const fs = require('fs');
            const { owner, repo } = context.repo;
            let report = '(drift report unavailable)';
            try { report = fs.readFileSync(process.env.RUNNER_TEMP + '/drift-report.json', 'utf8'); } catch {}
            const trigger = context.eventName === 'schedule' ? 'scheduled' : 'manually dispatched';
            await github.rest.issues.create({
              owner, repo,
              title: `aimock drift: @drift subset failed against the live provider`,
              body: [
                `The ${trigger} fixture drift check failed.`,
                ``,
                `Run: ${context.serverUrl}/${owner}/${repo}/actions/runs/${context.runId}`,
                ``,
                `Structural diff of recordings vs committed fixtures:`,
                '```json',
                report.slice(0, 6000),
                '```',
              ].join('\n'),
              labels: ['drift'],
            });
```

Notes for the implementer:
- `<existing pin>` / `<pin from ci.yml>` means copy the exact `@<sha> # vX` from the current `aimock-drift.yml` or `ci.yml` — never float a tag. This repo pins every action.
- Delete the old `npx nx run examples-chat-angular:drift` step and the old issue body ("The scheduled fixture drift check failed" regardless of trigger — the new body names the trigger).
- The `mkdir -p` before the differ guards the case where the run failed before recording anything.

- [ ] **Step 2: Lint the workflow**

Run: `npx yaml-lint .github/workflows/aimock-drift.yml 2>/dev/null || python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/aimock-drift.yml')); print('yaml ok')"`
Expected: `yaml ok`.

- [ ] **Step 3: Remove the stale drift target**

In `examples/chat/angular/project.json`, the `drift` target currently runs `tsx scripts/drift.ts` (wrong path and stale semantics). Update it to the differ:

```json
"drift": {
  "executor": "nx:run-commands",
  "options": {
    "cwd": "examples/chat/angular",
    "command": "tsx e2e/scripts/drift.ts e2e/.aimock-recordings"
  }
}
```

(Check the current target's exact shape first and preserve any fields not shown here.)

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/aimock-drift.yml examples/chat/angular/project.json
git commit -m "feat(ci): weekly aimock drift run — record-proxy e2e subset + structural diff"
```

---

### Task 6: Acceptance — one real record-mode run

The spec's acceptance: **the workflow has produced one green run and one recordings artifact** before the cron-bearing PR merges.

- [ ] **Step 1: Local record-mode run first (cheaper than CI iteration)**

Run:
```bash
cd examples/chat/angular
export OPENAI_API_KEY=<from /Users/blove/repos/angular-agent-framework/.env — export ONLY this var, never source the whole file>
AIMOCK_MODE=record AIMOCK_RECORD_DIR=/tmp/aimock-drift-local npx playwright test --config e2e/playwright.config.ts --grep @drift
```
Expected: 3 passed (live model; retries absorb one-off flakes). Then:
```bash
ls /tmp/aimock-drift-local
npx tsx e2e/scripts/drift.ts /tmp/aimock-drift-local
```
Expected: at least one recorded .json; differ exits 0 and reports (expect `unmatchedCommitted` > 0 — handwritten seeds guarantee it; that is a report, not a failure).

- [ ] **Step 2: Push the branch and dispatch the workflow against it**

```bash
git push -u origin blove/aimock-drift-detection
gh workflow run aimock-drift.yml --ref blove/aimock-drift-detection
gh run watch $(gh run list --workflow aimock-drift.yml --limit 1 --json databaseId -q '.[0].databaseId')
```
Expected: green run; `aimock-recordings` artifact present on the run page. (Dispatching a branch ref works because `aimock-drift.yml` already exists on `main`.)

- [ ] **Step 3: If the run is red, STOP**

Read the failure. A red `@drift` spec against the live model at this stage is either a harness bug (fix it) or actual drift (report it to Brian before merging — it changes what the first issue will say).

- [ ] **Step 4: Open the PR**

```bash
gh pr create --base main --title "feat(ci): working aimock drift detection" --body "<summarize: never-ran --out bug, record-proxy design, @drift subset, differ, weekly cron; link the spec; state the acceptance run URL and artifact>"
```

Include in the body: the old script's `ERR_PARSE_ARGS_UNKNOWN_OPTION` failure, the two-stage design, and the acceptance-run link. End with the repo's standard Claude Code attribution line.

---

## Self-review notes (already applied)

- Spec coverage: tag rule → Task 3; record plumbing → Tasks 1-2; differ + unpairable-as-report → Task 4; workflow trigger/artifact/issue-body-trigger-fix → Task 5; acceptance gate → Task 6. Library-over-CLI is a plan-level refinement of the spec's CLI sketch (same flags semantics, typed).
- The spec's `retries: 1` is satisfied by the existing `retries: process.env.CI ? 2 : 0` — documented at top, no config change.
- Type consistency: `FixtureEntry`/`EntrySummary`/`DriftReport` defined once in drift-lib and imported by both the test and the CLI.
