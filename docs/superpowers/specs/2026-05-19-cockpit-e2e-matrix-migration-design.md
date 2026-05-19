# cockpit-e2e GitHub Actions matrix migration — design

> **Place in the larger plan.** Cleanup #1 in the pre-batching arc. PR #462 (c-messages aimock pilot) surfaced two adjacent problems: (1) the existing `cockpit-e2e` job's sequential bash for-loop will scale poorly as the per-cap aimock coverage grows from 4 → 12 caps; (2) the shared `sendPromptAndWait` harness helper relies on observable loading state and is unreliable for fast-streaming aimock paths. This PR addresses both before the batch of 7 chat caps lands, so the batch PR becomes mechanical.

## Goal

Replace the cockpit-e2e job's single-runner sequential for-loop with a GitHub Actions matrix strategy (one runner per cap), and ship a durable e2e helper (`submitAndWaitForResponse`) that doesn't depend on the loading-state UI signal. After this PR, adding a new aimock cap is a one-line matrix entry plus zero changes to the shared harness.

## Non-goals

- Migrating `scripts/ci-scope.mjs` to `nx affected` (Task #16, separate later cycle).
- Scaffolding generator for new cap e2es (Task #15, separate cycle).
- Reopening the c-messages aimock e2e pilot itself (Task #4, follows this).
- Refactoring `cockpit-build-test`, `cockpit-examples`, `cockpit-smoke`, `cockpit-deploy-smoke`, or any other cockpit CI job that isn't the per-cap aimock e2e suite.
- Removing `sendPromptAndWait` from the harness — keep both helpers; existing 4 cap e2es continue to use the original.

## Background — current cockpit-e2e shape

Today's `.github/workflows/ci.yml` cockpit-e2e job (single runner, ~13 min):

```yaml
cockpit-e2e:
  steps:
    - npm ci
    - uv sync cockpit/langgraph/streaming/python
    - uv sync cockpit/chat/tool-calls/python
    - uv sync cockpit/chat/subagents/python
    - uv sync cockpit/chat/interrupts/python
    - playwright install
    - bash loop:
        for proj in <4 angular project names>; do
          npx nx e2e "$proj" --skip-nx-cache
          sleep 5  # OS port-release workaround
        done
    - upload trace (single artifact name)
```

The 5s `sleep` was added pre-migration when all caps shared port 8123 via the umbrella langgraph dev. Post-PR-#432 each cap has its own `pythonPort` (5501/5503/...) from the capability registry — the workaround is stale.

## New shape — matrix strategy

```yaml
cockpit-e2e:
  needs: ci-scope
  if: github.event_name == 'push' || needs.ci-scope.outputs.cockpit_e2e == 'true'
  runs-on: ubuntu-latest
  strategy:
    fail-fast: false
    max-parallel: 5
    matrix:
      cap:
        - { angular: cockpit-langgraph-streaming-angular, python: cockpit/langgraph/streaming/python }
        - { angular: cockpit-chat-tool-calls-angular,     python: cockpit/chat/tool-calls/python }
        - { angular: cockpit-chat-subagents-angular,      python: cockpit/chat/subagents/python }
        - { angular: cockpit-chat-interrupts-angular,     python: cockpit/chat/interrupts/python }
  name: "Cockpit — e2e (${{ matrix.cap.angular }})"
  steps:
    - uses: actions/checkout@v6.0.2
    - uses: actions/setup-node@v6.3.0
      with:
        node-version: 22
        cache: npm
    - uses: astral-sh/setup-uv@v8.0.0
      with:
        python-version: '3.12'
    - run: npm ci
    - working-directory: ${{ matrix.cap.python }}
      run: uv sync
    - run: npx playwright install --with-deps chromium
    - run: npx nx e2e "${{ matrix.cap.angular }}" --skip-nx-cache
    - name: Upload Playwright trace on failure
      if: failure()
      uses: actions/upload-artifact@v4
      with:
        name: cockpit-e2e-trace-${{ matrix.cap.angular }}
        path: cockpit/**/angular/e2e/test-results/
        retention-days: 7

cockpit-e2e-summary:
  name: "Cockpit — e2e"
  needs: cockpit-e2e
  if: always() && (github.event_name == 'push' || needs.ci-scope.outputs.cockpit_e2e == 'true')
  runs-on: ubuntu-latest
  steps:
    - name: Aggregate matrix outcome
      run: |
        if [[ "${{ needs.cockpit-e2e.result }}" != "success" ]]; then
          echo "Matrix outcome: ${{ needs.cockpit-e2e.result }}"
          exit 1
        fi
        echo "All matrix expansions passed."
```

Key properties:

- **`name: "Cockpit — e2e"` on the summary job** preserves the existing branch-protection required-check name. No admin action needed to update branch protection settings.
- **`fail-fast: false`** — one flaky cap doesn't cancel the others.
- **`max-parallel: 5`** — runners limited to 5 concurrent. With 12 future caps this gives ~3x wall-time improvement over sequential while staying friendly to GH Actions CDN (Playwright install pulls ~100MB) and the org's overall concurrency budget.
- **Per-runner `uv sync ${{ matrix.cap.python }}`** — each runner installs deps for only its own cap. No more 4-step uv-sync block; eliminates ~30-60s of redundant sync work per cap.
- **No `sleep 5`** — matrix runners are fully isolated; no inter-cap port contention possible.
- **Per-cap trace artifact name** (`cockpit-e2e-trace-<angular-project>`) — concurrent matrix uploads no longer clobber each other.
- **`if: always()` on the summary job** ensures it runs even if some matrix expansions fail, then explicitly reports failure via `exit 1`.

## New helper — `submitAndWaitForResponse`

Add to `libs/e2e-harness/src/test-helpers.ts` alongside the existing `sendPromptAndWait`:

```typescript
/**
 * Send a user prompt and wait for the final assistant bubble to render.
 *
 * Unlike `sendPromptAndWait` (which polls for the "Stop generating" button
 * visibility), this waits directly on the durable end-state:
 * `chat-message[data-role="assistant"][data-streaming="false"]`.
 *
 * Use this helper for caps where the streaming pass is too fast for Playwright
 * to observe an intermediate loading state — typically aimock-backed e2es
 * where the SSE chunks arrive in <100ms. The "Stop generating" button is
 * conditionally rendered (`@if (isLoading() && canStop())`), and signal-
 * batched updates can collapse the visible state below Playwright's polling
 * resolution.
 *
 * Compatible with all cap shapes — composed `<chat>` AND raw primitive
 * components — because the assertion is on the rendered `chat-message`
 * element's data attributes, not on input/button affordances.
 */
export async function submitAndWaitForResponse(
  page: Page,
  prompt: string,
  opts?: { path?: string; timeoutMs?: number },
): Promise<Locator> {
  const path = opts?.path ?? '/';
  const timeoutMs = opts?.timeoutMs ?? 30_000;
  await page.goto(path);
  const input = page.getByRole('textbox', { name: /message|prompt/i });
  await input.fill(prompt);
  await page.getByRole('button', { name: /send message/i }).click();
  const finalAssistant = page
    .locator('chat-message[data-role="assistant"][data-streaming="false"]')
    .last();
  await expect(finalAssistant).toBeAttached({ timeout: timeoutMs });
  return finalAssistant;
}
```

Export from `libs/e2e-harness/src/index.ts` alongside `sendPromptAndWait`. Both coexist: existing 4 cap e2es continue using `sendPromptAndWait` (they have observable loading state because they use the composed `<chat>` component); future caps choose whichever fits their UI shape.

## Files changed

- `.github/workflows/ci.yml` — replace `cockpit-e2e` job body with matrix strategy + add `cockpit-e2e-summary` job.
- `libs/e2e-harness/src/test-helpers.ts` — add `submitAndWaitForResponse`.
- `libs/e2e-harness/src/index.ts` — re-export `submitAndWaitForResponse`.

No changes to: `apps/cockpit/scripts/capability-registry.ts`, `apps/cockpit/cockpit-e2e-wiring.spec.ts`, any per-cap `project.json`, `scripts/ci-scope.mjs`, the existing 4 cap e2e specs.

## Verification

### Local

1. `npx tsc --noEmit libs/e2e-harness/src/test-helpers.ts` clean.
2. `npx tsc --noEmit libs/e2e-harness/src/index.ts` clean.
3. `npx nx test e2e-harness --skip-nx-cache` (if the harness has tests) passes.
4. `actionlint .github/workflows/ci.yml` (or equivalent yamllint) passes — matrix syntax + summary job depend chain valid.
5. Pre-flight grep: `grep -n 'sleep 5' .github/workflows/ci.yml` returns nothing (workaround removed).
6. Pre-flight grep: `grep -c '${{ matrix.cap' .github/workflows/ci.yml` ≥ 4 (matrix references applied).

### CI (the PR itself is the test)

1. PR push triggers `Cockpit — e2e` summary check + 4 matrix expansions (one per cap).
2. **Each of the 4 matrix expansions passes** — existing aimock specs unaffected by the runner-isolation change.
3. **`Cockpit — e2e` summary check passes** — branch-protection-compatible name preserved.
4. Per-cap trace artifacts (if any failure) named uniquely: `cockpit-e2e-trace-cockpit-chat-tool-calls-angular`, etc.
5. Wall-time check: total time for matrix (max across 4) < total time for previous sequential loop (~13 min → ~5-6 min expected).
6. No regression on `Cockpit — build / test`, `Cockpit — build all examples`, `Cockpit — smoke`, `Cockpit — deploy smoke dry-run`, `Cockpit — representative capability smoke`.

## Risk surface

- **GitHub UI clutter.** Matrix expansion creates 4 (eventually 12+) visible status checks per PR. Mitigated by the summary job — that's the one branch protection cares about. Reviewers see per-cap pass/fail in the Checks tab.
- **Concurrent npm cache hits.** All matrix runners pull the same `setup-node` cache key. GitHub caches are read-shareable; should be fine. If we see cache-stampede issues in the first PR, can lower `max-parallel` further.
- **Playwright install bandwidth.** 5 runners × ~100MB browser download = ~500MB peak from GH's CDN per PR. Manageable; if CDN throttling shows up, switch to `actions/cache` for the Playwright browsers (orthogonal optimization, not blocking).
- **Matrix `if:` semantics.** Today the gate `if: needs.ci-scope.outputs.cockpit_e2e == 'true'` lives on the parent job. With matrix, ALL expansions evaluate the same gate. Verify CI scope correctly emits `cockpit_e2e=true` for any path that should trigger the new matrix.
- **Summary job result aggregation.** GitHub's `needs.cockpit-e2e.result` is `success`, `failure`, `cancelled`, or `skipped` for the entire matrix. If even one expansion fails, the summary fails. Correct behavior, but the summary's failure message is opaque — the reviewer must click into the Checks tab to see which cap failed. Acceptable.
- **`submitAndWaitForResponse` rollout.** Adding a helper is harmless on its own; the matrix migration doesn't change which helper any existing cap uses. The new helper sits ready for the c-messages pilot retry and the 7-cap batch follow-up.

## Branch protection follow-up

The summary job uses `name: "Cockpit — e2e"` — identical to today's required check name. **No admin action needed to update branch protection.** Documented in the PR description; if the org's branch protection somehow tracks check names case-sensitively or with the matrix-expansion suffix, the PR description includes a fallback note for the admin.

## Acceptance criteria

- `.github/workflows/ci.yml`'s `cockpit-e2e` job uses `strategy.matrix.cap` with one entry per current aimock cap (4 today).
- `fail-fast: false` and `max-parallel: 5` present.
- Per-runner `uv sync ${{ matrix.cap.python }}` step (single, not a list of 4).
- No `sleep 5` anywhere in the cockpit-e2e job or its comments.
- Per-runner `npx nx e2e "${{ matrix.cap.angular }}" --skip-nx-cache` step.
- Per-cap trace artifact name: `cockpit-e2e-trace-${{ matrix.cap.angular }}`.
- `cockpit-e2e-summary` job added with `name: "Cockpit — e2e"` and `needs: cockpit-e2e`, exits non-zero if matrix fails.
- `libs/e2e-harness/src/test-helpers.ts` exports `submitAndWaitForResponse`.
- `libs/e2e-harness/src/index.ts` re-exports `submitAndWaitForResponse`.
- All 4 existing cap aimock e2es pass on the matrix.
- `Cockpit — e2e` summary check appears in the PR's Checks tab and passes.
- Wall-time for cockpit-e2e materially lower than current sequential (~13 min → ~5-6 min expected).

**End state:** Adding a 5th aimock cap (next PR: c-messages re-pilot) becomes one matrix entry in ci.yml + one new e2e/ directory under `cockpit/chat/messages/angular/`. The 7-cap batch PR after that becomes 7 matrix entries + 7 e2e/ directories — mechanical.
