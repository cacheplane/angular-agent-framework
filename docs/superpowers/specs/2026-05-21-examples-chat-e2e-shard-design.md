# examples/chat e2e — matrix sharding design

## Goal

Reduce wall-time of the `examples/chat — e2e` CI job by running it across multiple GitHub Actions matrix shards in parallel, mirroring the cockpit fleet's matrix philosophy. Borrow the architectural pattern without restructuring the underlying e2e harness.

## Current state

- 31 tests across 19 spec files under `examples/chat/angular/e2e/`.
- Playwright config: `fullyParallel: false, workers: 1, retries: 2`.
- Bespoke `global-setup.ts` spawns aimock subprocess + `langgraph dev` (:2024, with `OPENAI_BASE_URL` pointed at aimock) + Angular dev server (:4200).
- Single CI job (`examples/chat — e2e`) runs all 31 tests sequentially. Observed wall time on recent runs: 6+ minutes.

By contrast, the cockpit fleet runs 24 caps as a 24-way matrix with `max-parallel: 5`, finishing the whole fleet in ~5 minutes. Each cockpit cap has 1-2 tests and pays the same setup tax in parallel.

## Approach: Playwright `--shard=N/M`

A single change to `.github/workflows/ci.yml`: add a 4-way matrix to the `examples/chat — e2e` job and forward `--shard=N/4` to Playwright. Matrix uses a numeric `shard` index (1-4) rather than a `'N/M'` string, because GitHub Actions artifact names cannot contain `/`.

```yaml
strategy:
  fail-fast: false
  matrix:
    shard: [1, 2, 3, 4]
steps:
  # ... existing setup steps ...
  - run: npx nx e2e examples-chat-angular --skip-nx-cache -- --shard=${{ matrix.shard }}/4
```

Job display name templated as `examples/chat — e2e (${{ matrix.shard }}/4)` so each shard appears as a distinct required check (e.g. `examples/chat — e2e (1/4)`, `examples/chat — e2e (2/4)`, …).

The `--skip-nx-cache` flag from the current command is preserved; the `--` separator passes everything after it through to Playwright.

No application code, no test code, no harness changes. The bespoke `global-setup.ts`/`aimock-runner.ts` and the local `test-helpers.ts` stay as-is.

## Why 4 shards (not 2, not 19)

- **2 shards** — only halves wall time; under-uses parallelism budget.
- **19 shards** (one per spec) — 19× the setup tax (each shard spends ~1-2 min on `npm ci` + langgraph startup + Angular dev server for ~10s of actual tests). Setup dominates; mostly idle CPU.
- **4 shards** — sweet spot: ~8 tests/shard, ~30-60s of test work + ~1-2 min setup ≈ 2-3 min per shard. Quarters wall time without quadrupling CI compute waste.

If the first run shows uneven distribution (one shard much slower than the others), we can either bump to 6 or move a specific spec file via test-file naming, but neither is in scope here.

## Why Playwright `--shard` (not a custom matrix manifest)

- Built-in flag; standard Playwright pattern. No custom dispatcher to maintain.
- Distributes test files by alphabetical sort + round-robin into M buckets. Deterministic across runs.
- New spec files are auto-assigned to a shard without manifest edits.
- Tradeoff: distribution is by file count, not by runtime. If one spec is much slower than the others, its shard runs longer. Acceptable given current uniformity of the suite.

## URL routing and `--shard` interaction

`--shard` divides test FILES, not tests within a file. `fullyParallel: false, workers: 1` inside a shard is preserved — tests within a file still run sequentially, so any intra-file ordering invariants are safe. Cross-file ordering was never relied on (Playwright doesn't guarantee it); this is verified by the fact that the local `playwright.config.ts` already uses `fullyParallel: false` without specifying file order.

## Components affected

| File | Change |
|---|---|
| `.github/workflows/ci.yml` | Add `strategy.matrix.shard` + `--shard` flag to the `examples/chat — e2e` job; update `name:` template |
| `examples/chat/angular/e2e/README.md` (if present) | Note the matrix shape |
| Branch protection rules (manual / out-of-PR) | Required-checks list must include `examples/chat — e2e (1/4)`, `examples/chat — e2e (2/4)`, `examples/chat — e2e (3/4)`, `examples/chat — e2e (4/4)` instead of the singular old name |

`examples/chat/angular/e2e/playwright.config.ts` — **no change**. `--shard` is a CLI flag; no config-side opt-in is needed.

## Data flow per shard

Identical to today, per shard:

1. `actions/checkout`, `setup-node`, `npm ci`
2. `aimock` subprocess starts (replay mode, reads `e2e/fixtures/*.json`)
3. `langgraph dev` spawned on :2024 with `OPENAI_BASE_URL` pointed at aimock
4. Angular dev server boots on :4200
5. Playwright runs `--shard=N/4` against http://localhost:4200
6. Teardown via `global-teardown.ts`

Each shard is fully self-contained — no shared state, no inter-shard communication.

## Error handling

- `fail-fast: false` — one shard's failure doesn't cancel siblings (so we see the full failure picture)
- Per-shard `retries: 2` — same semantics as today, just applied per shard
- Per-shard Playwright trace artifact name templated as `examples-chat-e2e-trace-shard-${{ matrix.shard }}` to avoid collision (`actions/upload-artifact@v4` does not merge same-named uploads across matrix jobs and would error on identical names)

## Required-checks update (post-merge action item)

GitHub branch protection rules currently reference the singular `examples/chat — e2e` check. After this lands, that name no longer exists; the rule must be updated to require the 4 templated names. This is a repo-admin action, not a code change. Without it, the PR gate would wait forever on a name that's never reported.

## Testing / validation

1. **Local dry-run** — `npx nx e2e examples-chat-angular -- --shard=1/4 --list-files` confirms file distribution; sum across 1/4..4/4 = 19 unique files.
2. **First CI run** — observe per-shard wall time. Confirm aggregate test count = 31. Confirm no test runs twice.
3. **Stability check** — at least one green PR cycle on main before relying on the shape; watch for any newly-flaky tests surfaced by the changed relative ordering.

## Out of scope

- Migrating to `@ngaf-internal/e2e-harness` (deliberately tabled; bespoke setup has guards the shared factory lacks — see earlier audit)
- Reducing `retries` from 2 (orthogonal flake-reduction work)
- Enabling `fullyParallel: true` inside a shard (would require validating that shared dev servers tolerate parallel browser contexts; separate design)
- Re-tuning Playwright timeouts or browser config
- Speeding up the per-shard setup tax (langgraph startup, `npm ci`, Angular boot)
- Cross-shard test result aggregation beyond what GitHub Actions provides natively

## Risks

- **Uneven shard runtime**: if one spec dominates, its shard runs long; the other shards sit idle. Mitigation: monitor first run, re-tune count or split spec only if needed.
- **Flake surfaced by new ordering**: tests that implicitly relied on global state set by an earlier file may break. Mitigation: `retain-on-failure` traces already enabled; debug if observed.
- **Branch protection blocker**: PR cannot merge until the required-checks rule is updated. Mitigation: call this out in PR description.
