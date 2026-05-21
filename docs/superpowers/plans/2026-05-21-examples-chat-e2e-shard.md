# examples/chat e2e — matrix sharding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut wall-time of the `examples/chat — e2e` CI job by running it across a 4-way matrix using Playwright's built-in `--shard=N/M` flag.

**Architecture:** A single change site (`.github/workflows/ci.yml`): convert the `examples-chat-e2e` job from a single runner to a `matrix.shard: [1, 2, 3, 4]` job that forwards `--shard=N/4` to Playwright. Each shard runs ~8 of the 31 tests across the 19 spec files. Per-shard trace artifact is renamed to include the shard index to avoid name collisions in `actions/upload-artifact@v4`. Downstream jobs that `need:` this job (`release-please` aggregator at line 374, `demo-deploy` at line 544) continue to work as-is because GitHub aggregates matrix job results: `needs.examples-chat-e2e.result == 'success'` only if all 4 shards succeed.

**Tech Stack:** GitHub Actions, Playwright (`@playwright/test`), Nx (`@nx/playwright:playwright` executor).

**Out of scope** (per spec): harness consolidation, retry tuning, `fullyParallel: true` within a shard, timeout retuning, branch-protection rule updates (done by repo admin post-merge).

---

### Task 1: Convert `examples-chat-e2e` to a 4-way shard matrix

**Files:**
- Modify: `.github/workflows/ci.yml:242-271`

- [ ] **Step 1: Read the current job text to confirm starting state**

Run: `sed -n '242,271p' .github/workflows/ci.yml`

Expected output begins with `  examples-chat-e2e:` and ends with the artifact `retention-days: 7` line. The current run command is:

```
      - run: npx nx e2e examples-chat-angular --skip-nx-cache
```

The current artifact name is `examples-chat-e2e-trace`.

If the output differs, stop and reconcile against the spec at `docs/superpowers/specs/2026-05-21-examples-chat-e2e-shard-design.md` before editing.

- [ ] **Step 2: Apply the matrix + shard-flag + templated name + unique artifact**

Replace the block at `.github/workflows/ci.yml:242-271` with:

```yaml
  examples-chat-e2e:
    name: "examples/chat — e2e (${{ matrix.shard }}/4)"
    needs: ci-scope
    if: github.event_name == 'push' || needs.ci-scope.outputs.examples_chat == 'true'
    runs-on: ubuntu-latest
    timeout-minutes: 35
    strategy:
      fail-fast: false
      matrix:
        shard: [1, 2, 3, 4]
    steps:
      - uses: actions/checkout@v6.0.2
      - uses: actions/setup-node@v6.3.0
        with:
          node-version: 22
          cache: npm
      - name: Install uv
        uses: astral-sh/setup-uv@v8.0.0
        with:
          python-version: '3.12'
      - run: npm ci
      - working-directory: examples/chat/python
        run: uv sync
      - run: npx playwright install --with-deps chromium
      - run: npx nx e2e examples-chat-angular --skip-nx-cache -- --shard=${{ matrix.shard }}/4
      - name: Upload Playwright trace on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: examples-chat-e2e-trace-shard-${{ matrix.shard }}
          path: |
            test-results/
            examples/chat/angular/e2e/test-results/
          retention-days: 7
```

Three substantive changes vs. the prior block:
1. `name:` is quoted and templated with `${{ matrix.shard }}/4` so each matrix entry surfaces a distinct check name like `examples/chat — e2e (1/4)`.
2. New `strategy:` block above `steps:` with `fail-fast: false` and `matrix: { shard: [1, 2, 3, 4] }`.
3. The `npx nx e2e` line forwards `--shard=N/4` to Playwright after the Nx executor's `--` separator. `--skip-nx-cache` is preserved.
4. Artifact `name:` includes `-shard-${{ matrix.shard }}` — required because `actions/upload-artifact@v4` errors on duplicate artifact names across matrix entries.

- [ ] **Step 3: Run a YAML syntax check**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"`

Expected: no output, exit code 0.

If a `ScannerError` or `ParserError` fires, the most likely cause is indentation drift on the `strategy:` block. Compare against the cockpit-e2e job at `.github/workflows/ci.yml:273` for a reference matrix-strategy shape that already parses.

- [ ] **Step 4: Confirm the downstream `needs:` references are still valid**

Run: `grep -n 'examples-chat-e2e' .github/workflows/ci.yml`

Expected: 4 matches —
- Line ~242: the job definition (`  examples-chat-e2e:`)
- Line ~374: inside the aggregator job's `needs: [...]` list
- Line ~544: inside `demo-deploy`'s `needs: [examples-chat-smoke, examples-chat-e2e]`
- Line ~554: inside `demo-deploy`'s gate `if [ "${{ needs.examples-chat-e2e.result }}" != "success" ]`

No changes to those four sites: GitHub aggregates matrix job results — `needs.examples-chat-e2e.result` is `success` iff every shard succeeds, `failure` if any shard fails.

If the line numbers have drifted (e.g. another edit landed first), update this checklist's expectations but do NOT modify those lines.

- [ ] **Step 5: Local dry-run — verify shard distribution**

A local Playwright `--list-files` confirms that the 4 shards collectively cover the 19 spec files with no overlap.

Run (from repo root, after `npm ci` if not already done):

```bash
for n in 1 2 3 4; do
  echo "=== shard $n/4 ==="
  npx playwright test --config=examples/chat/angular/e2e/playwright.config.ts \
    --shard=$n/4 --list 2>/dev/null \
    | grep -E '\.spec\.ts' | sed 's/^ *//' | sort -u
done
```

Expected:
- Each shard prints a non-empty list of spec files.
- Union across all 4 shards has 19 unique paths (matches `ls examples/chat/angular/e2e/*.spec.ts | grep -v aimock-runner | wc -l`).
- Intersection between any two shards is empty.

Quick union sanity check in one line:

```bash
for n in 1 2 3 4; do npx playwright test --config=examples/chat/angular/e2e/playwright.config.ts --shard=$n/4 --list 2>/dev/null; done \
  | grep -oE 'examples/chat/angular/e2e/[a-z-]+\.spec\.ts' | sort -u | wc -l
```

Expected output: `19` (the count of `.spec.ts` files under that directory excluding `aimock-runner.spec.ts`, which is excluded by `testIgnore` in playwright.config.ts).

If the count differs from 19, do NOT proceed — investigate. The most likely cause is that a new spec was added that Playwright doesn't include in any shard (unlikely with `--shard` default behavior, but possible if `testMatch` excludes it).

- [ ] **Step 6: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: shard examples/chat e2e into 4 parallel matrix jobs

Playwright's --shard=N/M flag auto-distributes the 19 spec files
across 4 GitHub Actions matrix entries. Mirrors the cockpit fleet's
matrix philosophy. Expected wall-time: ~6 min → ~2-3 min.

- strategy.matrix.shard: [1, 2, 3, 4], fail-fast: false
- name templated: examples/chat — e2e (1/4), (2/4), ...
- --shard=N/4 passed through Nx executor's -- separator
- Trace artifact templated examples-chat-e2e-trace-shard-N to avoid
  same-name collision in actions/upload-artifact@v4

Downstream needs: references (release aggregator, demo-deploy gate)
unchanged — GitHub aggregates matrix results automatically.

POST-MERGE ACTION ITEM: update GitHub branch protection required-checks
list from 'examples/chat — e2e' to the 4 templated names.

Spec: docs/superpowers/specs/2026-05-21-examples-chat-e2e-shard-design.md
"
```

---

### Task 2: Push, open PR, verify first CI run

**Files:**
- None modified (CI observation + PR metadata only)

- [ ] **Step 1: Push the branch**

Run: `git push -u origin claude/chat-e2e-shard`

Expected: push succeeds, branch tracked.

- [ ] **Step 2: Open the PR**

Run:

```bash
gh pr create --title "ci: shard examples/chat e2e into 4 parallel matrix jobs" --body "$(cat <<'EOF'
## Summary

- Convert the singular \`examples/chat — e2e\` CI job into a 4-way matrix using Playwright's built-in \`--shard=N/M\` flag.
- Mirrors the cockpit fleet's matrix philosophy without touching the underlying e2e harness.
- Expected wall-time: ~6 min → ~2-3 min.

## ⚠️ Post-merge action item

GitHub branch protection rules currently require the singular check \`examples/chat — e2e\`. After this lands, that name no longer exists; the rule must be updated to require all four templated names:

- \`examples/chat — e2e (1/4)\`
- \`examples/chat — e2e (2/4)\`
- \`examples/chat — e2e (3/4)\`
- \`examples/chat — e2e (4/4)\`

Until that update, future PR gates may fail to evaluate. **Repo admin should update branch protection immediately after merge.**

## Test plan

- [ ] All four \`examples/chat — e2e (N/4)\` matrix entries report success on this PR
- [ ] Per-shard wall-time is ~2-3 min (vs. ~6 min single-job baseline)
- [ ] Aggregate test count across shards is 31 (no test runs twice, no test is dropped)
- [ ] No flake surfaced by the changed relative test order

Spec: \`docs/superpowers/specs/2026-05-21-examples-chat-e2e-shard-design.md\`
Plan: \`docs/superpowers/plans/2026-05-21-examples-chat-e2e-shard.md\`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: a URL to the new PR is printed.

- [ ] **Step 3: Wait for CI to start, then list the new check names**

Run (a minute or two after the push):

```bash
gh pr checks $(gh pr view --json number --jq .number)
```

Expected: 4 lines containing `examples/chat — e2e (1/4)` … `(4/4)`. If only 1 line for the old name appears, the matrix was not picked up — recheck Step 2 of Task 1.

- [ ] **Step 4: After CI completes, verify per-shard outcomes**

Run:

```bash
PR=$(gh pr view --json number --jq .number)
RUN=$(gh run list --branch claude/chat-e2e-shard --workflow=ci.yml --limit 1 --json databaseId --jq '.[0].databaseId')
gh run view $RUN --json jobs --jq '.jobs[] | select(.name | startswith("examples/chat — e2e")) | {name, conclusion, startedAt, completedAt}'
```

Expected: 4 entries, each with `conclusion: "success"`. Note `startedAt`/`completedAt` to compute per-shard duration; the slowest shard is the new wall-time of this job.

- [ ] **Step 5: Confirm aggregate test count from one shard's log (sanity check)**

Run:

```bash
JOB_ID=$(gh run view $RUN --json jobs --jq '.jobs[] | select(.name=="examples/chat — e2e (1/4)") | .databaseId')
gh run view --job=$JOB_ID --log 2>&1 | grep -E "[0-9]+ passed" | tail -3
```

Expected: a line like `N passed (Mm Ss)` where N is roughly 31/4 ≈ 7-8 tests. Repeat for the other shards mentally; rough sum should be ≥31 (Playwright may report retries as additional "passed" entries).

- [ ] **Step 6: Hand off to user for merge decision**

The plan ends here. The user decides when to merge (and remembers to update branch protection — see PR body).

---

## Verification checklist (entire plan)

After all tasks: verify against spec at `docs/superpowers/specs/2026-05-21-examples-chat-e2e-shard-design.md`:

- ✅ Matrix is 4-way with numeric shard values
- ✅ `fail-fast: false`
- ✅ Job display name templated with shard index
- ✅ `--shard=N/4` passed through Nx `--` separator
- ✅ `--skip-nx-cache` preserved
- ✅ Trace artifact name templated with shard index
- ✅ No application code, test code, or harness change
- ✅ `playwright.config.ts` unchanged
- ✅ Downstream `needs:` references untouched
- ✅ PR body flags the required-checks update for repo admin

If any item is unchecked, return to the task that owns it before requesting review.
