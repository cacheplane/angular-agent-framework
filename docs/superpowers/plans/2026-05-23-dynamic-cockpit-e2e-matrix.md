# Dynamic cockpit-e2e matrix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace ci.yml's hardcoded 24-cap cockpit-e2e matrix with one derived from `nx affected`, so single-cap PRs run 1 runner instead of 24.

**Architecture:** A new pre-job dispatcher (`cockpit-e2e-dispatcher`) runs after `ci-scope`, computes affected cockpit caps via a pure-function classifier (`selectCockpitCaps`), and emits `outputs.caps` as JSON. The `cockpit-e2e` matrix consumes it via `fromJson(...)`. Full-fleet override (all 24) fires on push events or when `cockpit_e2e=true` with empty affected ∩ cockpit caps.

**Tech Stack:** GitHub Actions, Nx (`npx nx show projects [--affected] --json`, `npx nx show project <name> --json`), Node.js (`node:test` + `node:assert/strict`).

---

### Task 1: Pure classifier `selectCockpitCaps` + tests (TDD)

**Files:**
- Create: `scripts/cockpit-matrix.mjs` (export only — CLI wrapper added in Task 2)
- Create: `scripts/cockpit-matrix.spec.mjs`

- [ ] **Step 1: Write the failing tests**

Create `scripts/cockpit-matrix.spec.mjs`:

```js
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { selectCockpitCaps } from './cockpit-matrix.mjs';

const ALL_CAPS = [
  { angular: 'cockpit-chat-messages-angular', python: 'cockpit/chat/messages/python' },
  { angular: 'cockpit-chat-input-angular',    python: 'cockpit/chat/input/python' },
  { angular: 'cockpit-langgraph-streaming-angular', python: 'cockpit/langgraph/streaming/python' },
];

describe('selectCockpitCaps', () => {
  test('returns only affected caps when fullFleet=false', () => {
    const result = selectCockpitCaps(
      ALL_CAPS,
      new Set(['cockpit-chat-messages-angular']),
      { fullFleet: false },
    );
    assert.deepEqual(result, [
      { angular: 'cockpit-chat-messages-angular', python: 'cockpit/chat/messages/python' },
    ]);
  });

  test('returns multiple affected caps preserving input order', () => {
    const result = selectCockpitCaps(
      ALL_CAPS,
      new Set(['cockpit-langgraph-streaming-angular', 'cockpit-chat-messages-angular']),
      { fullFleet: false },
    );
    assert.deepEqual(result, [
      { angular: 'cockpit-chat-messages-angular', python: 'cockpit/chat/messages/python' },
      { angular: 'cockpit-langgraph-streaming-angular', python: 'cockpit/langgraph/streaming/python' },
    ]);
  });

  test('returns all caps when fullFleet=true regardless of affected', () => {
    const result = selectCockpitCaps(ALL_CAPS, new Set(), { fullFleet: true });
    assert.deepEqual(result, ALL_CAPS);
  });

  test('returns all caps when fullFleet=true even with subset affected', () => {
    const result = selectCockpitCaps(
      ALL_CAPS,
      new Set(['cockpit-chat-input-angular']),
      { fullFleet: true },
    );
    assert.deepEqual(result, ALL_CAPS);
  });

  test('returns empty array when fullFleet=false and no affected caps', () => {
    const result = selectCockpitCaps(ALL_CAPS, new Set(), { fullFleet: false });
    assert.deepEqual(result, []);
  });

  test('ignores non-cockpit affected entries (no false matches)', () => {
    const result = selectCockpitCaps(
      ALL_CAPS,
      new Set(['chat', 'langgraph', 'examples-chat-angular']),
      { fullFleet: false },
    );
    assert.deepEqual(result, []);
  });

  test('output round-trips through JSON.stringify/parse', () => {
    const result = selectCockpitCaps(
      ALL_CAPS,
      new Set(['cockpit-chat-input-angular']),
      { fullFleet: false },
    );
    assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
  });
});
```

- [ ] **Step 2: Run tests, verify all 7 fail**

Run: `node --test scripts/cockpit-matrix.spec.mjs`

Expected: ERR_MODULE_NOT_FOUND (the file doesn't exist yet).

- [ ] **Step 3: Implement the pure function (no CLI yet)**

Create `scripts/cockpit-matrix.mjs`:

```js
#!/usr/bin/env node
// SPDX-License-Identifier: MIT

/**
 * Pure-function classifier for the cockpit-e2e matrix.
 *
 * @param {Array<{angular: string, python: string}>} allCockpitCaps
 *        All cockpit angular projects with an e2e target, paired with
 *        their python sibling path. Derived from the project graph by
 *        the CLI wrapper (or hard-coded in tests).
 * @param {Set<string>} affectedNames
 *        Set of project names nx-affected returned for this diff.
 * @param {{fullFleet: boolean}} opts
 *        fullFleet=true forces all caps regardless of affected. Set by
 *        the CLI on push events and on the empty-affected fallback.
 * @returns {Array<{angular: string, python: string}>}
 *        Caps to dispatch as matrix entries, preserving the order of
 *        `allCockpitCaps`.
 */
export function selectCockpitCaps(allCockpitCaps, affectedNames, { fullFleet }) {
  if (fullFleet) return allCockpitCaps;
  return allCockpitCaps.filter((cap) => affectedNames.has(cap.angular));
}
```

- [ ] **Step 4: Run tests, verify all 7 pass**

Run: `node --test scripts/cockpit-matrix.spec.mjs`

Expected:
```
# tests 7
# pass 7
# fail 0
```

- [ ] **Step 5: Commit**

```bash
git add scripts/cockpit-matrix.mjs scripts/cockpit-matrix.spec.mjs
git commit -m "feat(ci): pure selectCockpitCaps classifier for dynamic matrix

Returns affected cockpit caps when fullFleet=false, or all caps when
fullFleet=true. Preserves the order of the allCockpitCaps argument.

CLI wrapper that runs nx queries + writes \$GITHUB_OUTPUT lands in
the next commit. Spec at
docs/superpowers/specs/2026-05-23-dynamic-cockpit-e2e-matrix-design.md.

7/7 unit tests passing via node --test."
```

---

### Task 2: CLI wrapper for `cockpit-matrix.mjs`

**Files:**
- Modify: `scripts/cockpit-matrix.mjs`

- [ ] **Step 1: Read the file to confirm starting state**

Run: `cat scripts/cockpit-matrix.mjs`

Expected: the `selectCockpitCaps` export from Task 1. No CLI logic yet.

- [ ] **Step 2: Append CLI wrapper**

Append the following to `scripts/cockpit-matrix.mjs`:

```js
// ── CLI wrapper ────────────────────────────────────────────────────────────
// Only runs when invoked as a script (not when imported by tests).
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

function parseArgs(argv) {
  const out = { base: null, head: null, fullFleet: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--base') out.base = argv[++i];
    else if (a === '--head') out.head = argv[++i];
    else if (a === '--full-fleet') out.fullFleet = argv[++i] === 'true';
  }
  return out;
}

function nxJson(args) {
  const stdout = execFileSync('npx', ['nx', ...args, '--json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  return JSON.parse(stdout);
}

function deriveCockpitCaps() {
  const all = nxJson(['show', 'projects']);
  const cockpitAngularNames = all.filter(
    (n) => /^cockpit-.+-angular$/.test(n),
  );

  const caps = [];
  for (const angular of cockpitAngularNames) {
    const meta = nxJson(['show', 'project', angular]);
    if (!meta.targets?.e2e) continue;
    // Convention: cockpit-<topic>-<cap>-angular has python sibling
    // <topic>/<cap> at cockpit/<topic>/<cap>/python. Derive from the
    // angular project's sourceRoot which looks like:
    //   "cockpit/chat/messages/angular/src"
    // Drop the trailing "/angular/src" then append "/python".
    const src = meta.sourceRoot ?? '';
    const match = src.match(/^(cockpit\/.+)\/angular\/src$/);
    if (!match) continue;
    caps.push({ angular, python: `${match[1]}/python` });
  }
  // Stable order: alphabetic by angular name so matrix display is
  // predictable across runs.
  caps.sort((a, b) => a.angular.localeCompare(b.angular));
  return caps;
}

function loadAffectedNames(base, head) {
  return new Set(
    nxJson(['show', 'projects', '--affected', `--base=${base}`, `--head=${head}`]),
  );
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const allCaps = deriveCockpitCaps();

  let affected;
  if (args.fullFleet) {
    affected = new Set();
  } else {
    affected = loadAffectedNames(args.base, args.head);
  }

  // Empty-affected fallback: when scope says e2e is required but nx
  // didn't attribute any cap (lib fanout), run all caps.
  const haveAnyCockpitAffected = allCaps.some((c) => affected.has(c.angular));
  const effectiveFullFleet = args.fullFleet || !haveAnyCockpitAffected;

  const selected = selectCockpitCaps(allCaps, affected, {
    fullFleet: effectiveFullFleet,
  });

  const json = JSON.stringify(selected);

  const ghOutput = process.env.GITHUB_OUTPUT;
  if (ghOutput) {
    appendFileSync(ghOutput, `caps=${json}\n`);
  } else {
    // Local-debug mode: print to stdout.
    process.stdout.write(`caps=${json}\n`);
  }
}

// Only invoke main when run directly, not when imported.
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main();
}
```

- [ ] **Step 3: Verify tests still pass (CLI shouldn't affect them)**

Run: `node --test scripts/cockpit-matrix.spec.mjs`

Expected: 7/7 passing. If a test fails, the most likely cause is the `main()` invocation firing during the import phase — re-check the `if` guard at the bottom matches the pattern shown.

- [ ] **Step 4: Smoke-test the CLI locally**

Run from repo root:
```bash
node scripts/cockpit-matrix.mjs --full-fleet true
```

Expected output (to stdout):
```
caps=[{"angular":"cockpit-chat-a2ui-angular","python":"cockpit/chat/a2ui/python"},...]
```

The array should have **24 entries** (all caps with an e2e target). If you get fewer or zero, `deriveCockpitCaps` is filtering too aggressively — verify against `npx nx show projects --json | grep cockpit-.*-angular` and check each one's `targets.e2e` via `npx nx show project <name> --json`.

- [ ] **Step 5: Smoke-test the affected path**

Run from repo root (using HEAD~1 as a stand-in base):
```bash
node scripts/cockpit-matrix.mjs --base "HEAD~1" --head "HEAD" --full-fleet false
```

Expected: a `caps=[…]` line. The array's size depends on what `HEAD~1..HEAD` actually changed in your local branch. On the `claude/cockpit-dyn-matrix` branch the only diff is the new scripts + spec doc, so the affected set won't include any cockpit caps → empty `affected` → empty-affected fallback fires → all 24 caps emitted.

- [ ] **Step 6: Commit**

```bash
git add scripts/cockpit-matrix.mjs
git commit -m "feat(ci): CLI wrapper for cockpit-matrix script

Derives the list of cockpit-*-angular projects with an e2e target by
walking the nx project graph. Each cap is paired with its python
sibling path via the sourceRoot convention (cockpit/<topic>/<cap>/
{angular,python}).

CLI args: --base, --head, --full-fleet. Writes 'caps=<json>' to
\$GITHUB_OUTPUT (or stdout for local debugging).

Empty-affected fallback: when --full-fleet is false but nx affected
didn't attribute any cockpit cap (lib fanout case), emits all caps."
```

---

### Task 3: ci.yml — add dispatcher job + wire matrix

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Add `cockpit-matrix.spec.mjs` to the ci-scope test runner**

Find the existing line at `.github/workflows/ci.yml:50-51`:

```yaml
      - name: Test CI scope classifier
        run: node --test scripts/ci-scope.spec.mjs
```

Replace with:

```yaml
      - name: Test CI scope classifier
        run: node --test scripts/ci-scope.spec.mjs scripts/cockpit-matrix.spec.mjs
```

`node --test` accepts multiple spec files as positional args. This ensures the new tests gate PRs.

- [ ] **Step 2: Insert the dispatcher job before `cockpit-e2e`**

Find the existing `cockpit-e2e` job (line ~291). Immediately above it (after the `cockpit-deploy-smoke` or `examples-chat-e2e-summary` block, depending on file order), insert this new job:

```yaml
  cockpit-e2e-dispatcher:
    name: Cockpit — e2e dispatcher
    needs: ci-scope
    if: github.event_name == 'push' || needs.ci-scope.outputs.cockpit_e2e == 'true'
    runs-on: ubuntu-latest
    outputs:
      caps: ${{ steps.matrix.outputs.caps }}
    steps:
      - uses: actions/checkout@v6.0.2
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v6.3.0
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - name: Compute affected base + head
        id: refs
        run: |
          if [ "${{ github.event_name }}" = "pull_request" ]; then
            echo "base=${{ github.event.pull_request.base.sha }}" >> "$GITHUB_OUTPUT"
            echo "head=${{ github.event.pull_request.head.sha }}" >> "$GITHUB_OUTPUT"
            echo "full=false" >> "$GITHUB_OUTPUT"
          else
            echo "base=HEAD~1" >> "$GITHUB_OUTPUT"
            echo "head=HEAD" >> "$GITHUB_OUTPUT"
            echo "full=true" >> "$GITHUB_OUTPUT"
          fi
      - name: Emit cap matrix
        id: matrix
        run: |
          node scripts/cockpit-matrix.mjs \
            --base "${{ steps.refs.outputs.base }}" \
            --head "${{ steps.refs.outputs.head }}" \
            --full-fleet "${{ steps.refs.outputs.full }}"
```

- [ ] **Step 3: Replace the hardcoded matrix in `cockpit-e2e`**

In the `cockpit-e2e` job (around line 291), change:

```yaml
    needs: ci-scope
```

to:

```yaml
    needs: [ci-scope, cockpit-e2e-dispatcher]
```

And replace the entire `strategy:` block (lines ~296-324):

```yaml
    strategy:
      fail-fast: false
      max-parallel: 5
      matrix:
        cap:
          - { angular: cockpit-langgraph-streaming-angular, python: cockpit/langgraph/streaming/python }
          - { angular: cockpit-chat-tool-calls-angular,     python: cockpit/chat/tool-calls/python }
          # ... 22 more entries ...
```

with:

```yaml
    strategy:
      fail-fast: false
      max-parallel: 5
      matrix:
        cap: ${{ fromJson(needs.cockpit-e2e-dispatcher.outputs.caps) }}
```

Leave all the `steps:` below unchanged.

- [ ] **Step 4: Verify YAML parses**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"`

Expected: no output, exit code 0.

If the YAML fails, indentation drift on the inserted `cockpit-e2e-dispatcher` block is the likely cause. Compare against `cockpit-e2e-summary` (line ~351) which has the same two-space indent.

- [ ] **Step 5: Verify the cockpit-e2e-summary references still match**

Run: `grep -n 'cockpit-e2e' .github/workflows/ci.yml`

Expected matches:
- `cockpit-e2e:` (job definition, line ~291)
- `cockpit-e2e-summary:` (line ~351)
- `needs: [..., cockpit-e2e-dispatcher]` or `needs: cockpit-e2e` referenced in the summary's `needs:`
- The summary's `needs.cockpit-e2e.result` reference (line ~359)
- The aggregator `required-pr-checks` job's `needs:` list, if it lists `cockpit-e2e` (line ~380+)

No edits required — GitHub aggregates matrix outcomes through `needs.cockpit-e2e.result`. The summary keeps working.

- [ ] **Step 6: Re-run the spec tests (now wired into CI as well as local)**

Run: `node --test scripts/ci-scope.spec.mjs scripts/cockpit-matrix.spec.mjs`

Expected: combined tally, both files green:
```
# tests 22  (15 ci-scope + 7 cockpit-matrix)
# pass 22
# fail 0
```

- [ ] **Step 7: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci(perf): dynamic cockpit-e2e matrix via dispatcher job

Replaces the hardcoded 24-cap matrix with one emitted by a new
cockpit-e2e-dispatcher job. The dispatcher runs scripts/cockpit-matrix.mjs
which derives caps from nx affected + project-graph metadata.

- PR touching 1 cap angular dir → 1 matrix entry (~46 CI-min saved vs
  today's 24-runner fan-out).
- PR touching libs/chat (fanout) → all 24 caps run via the
  empty-affected fallback in cockpit-matrix.mjs.
- Push to main → all 24 caps run (--full-fleet=true).

Also wires scripts/cockpit-matrix.spec.mjs into the ci-scope test job so
the 7 new unit tests gate PRs.

The cockpit-e2e-summary job is unchanged — needs.cockpit-e2e.result
correctly aggregates matrix outcomes.

Spec: docs/superpowers/specs/2026-05-23-dynamic-cockpit-e2e-matrix-design.md
Plan: docs/superpowers/plans/2026-05-23-dynamic-cockpit-e2e-matrix.md
"
```

---

### Task 4: Push, open PR, monitor first CI run

**Files:** none modified.

- [ ] **Step 1: Push the branch**

```bash
git push -u origin claude/cockpit-dyn-matrix
```

- [ ] **Step 2: Open the PR**

```bash
gh pr create --title "ci(perf): dynamic cockpit-e2e matrix" --body "$(cat <<'EOF'
## Summary

Replaces the hardcoded 24-cap \`cockpit-e2e\` matrix with one derived from \`nx affected\`.

- **PR touching 1 cap** → 1 matrix entry (~46 CI-min saved vs the 24-runner fan-out we have today).
- **PR touching libs/chat (fanout)** → all 24 caps run via the empty-affected fallback (no regression).
- **Push to main** → all 24 caps run (\`--full-fleet=true\`).

New pieces:
- \`scripts/cockpit-matrix.mjs\` — pure \`selectCockpitCaps\` classifier + CLI wrapper that derives caps from the nx project graph.
- \`scripts/cockpit-matrix.spec.mjs\` — 7 \`node:test\` unit tests, wired into the ci-scope test job.
- \`.github/workflows/ci.yml\` — new \`cockpit-e2e-dispatcher\` job; \`cockpit-e2e\` matrix now consumes \`fromJson(needs.cockpit-e2e-dispatcher.outputs.caps)\`. Summary aggregator unchanged.

This PR itself is a doc + scripts diff; nx affected on the PR base..head will return zero cockpit caps → empty-affected fallback fires → matrix runs all 24 (so we exercise the same surface as today on this very PR).

## Test plan

- [x] 7 new unit tests passing locally via \`node --test\`
- [x] CLI smoke-tested locally: \`--full-fleet true\` emits 24-entry JSON
- [ ] First CI run: dispatcher job succeeds + emits valid JSON + all 24 cockpit-e2e shards run + summary green

Spec: \`docs/superpowers/specs/2026-05-23-dynamic-cockpit-e2e-matrix-design.md\`
Plan: \`docs/superpowers/plans/2026-05-23-dynamic-cockpit-e2e-matrix.md\`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Verify dispatcher job + matrix expansion**

Wait ~2 min after push, then:

```bash
gh pr checks $(gh pr view --json number --jq .number)
```

Expected: `Cockpit — e2e dispatcher` appears as a check name. Once it completes, all 24 `Cockpit — e2e (cockpit-...-angular)` shards spawn.

- [ ] **Step 4: After CI completes, confirm green**

```bash
PR=$(gh pr view --json number --jq .number)
gh pr checks $PR | awk -F'\t' '$2=="fail"{print $1}'
```

Expected: no failures, or only pre-existing main flakes (Library/Website-e2e if not yet fixed). The dispatcher + 24 cockpit-e2e shards + summary must all be pass.

- [ ] **Step 5: Hand off to user**

The plan ends here. User decides when to admin-merge.

---

## Verification checklist (entire plan)

After all tasks, verify against `docs/superpowers/specs/2026-05-23-dynamic-cockpit-e2e-matrix-design.md`:

- ✅ `selectCockpitCaps(allCockpitCaps, affectedNames, {fullFleet})` exported as pure function
- ✅ 7 unit tests covering: 1 affected, multi affected, fullFleet+empty, fullFleet+subset, !fullFleet+empty, non-cockpit ignored, JSON round-trip
- ✅ CLI wrapper derives caps via `nx show projects --json` + per-project `nx show project --json`, filters by `targets.e2e`
- ✅ Empty-affected fallback fires when `!fullFleet && no cockpit cap in affected`
- ✅ Push events set `--full-fleet=true`
- ✅ Dispatcher job exposes `outputs.caps`
- ✅ `cockpit-e2e` matrix consumes via `fromJson(needs.cockpit-e2e-dispatcher.outputs.caps)`
- ✅ `cockpit-e2e-summary` unchanged
- ✅ `node --test` runs both `ci-scope.spec.mjs` and `cockpit-matrix.spec.mjs`
- ✅ YAML lint clean

If any item is unchecked, return to the task that owns it before requesting review.
