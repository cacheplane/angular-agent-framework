# Dynamic cockpit-e2e matrix — design

**Status:** Approved
**Date:** 2026-05-23
**Goal:** Replace ci.yml's hardcoded 24-cap `cockpit-e2e` matrix with one derived from `nx affected`. A PR that touches one cap should run one matrix entry, not 24. A PR that touches a fanned-out library or a push to main still runs all 24.

## Why now

From the e2e-strategy audit: the cockpit-e2e matrix fires all 24 runners on every PR that flips `cockpit_e2e=true`, regardless of which caps the PR actually affects. The 23 redundant runners cost ~46 CI-minutes per typical single-cap PR. The audit ranked this 🟡 medium with the highest single-PR savings of any remaining opportunity.

## Approach

A new **pre-job dispatcher** (`cockpit-e2e-dispatcher`) emits a JSON array of cap entries. The `cockpit-e2e` matrix consumes that array via `fromJson(needs.cockpit-e2e-dispatcher.outputs.caps)`. The cap shape (`{angular, python}`) is unchanged; only the source flips from hardcoded to dynamic.

**Why a dedicated dispatcher** (not extend ci-scope):
- Keeps `ci-scope.mjs` focused on its existing role (scope booleans).
- Isolates the matrix-emission logic in a pure-function script that can be unit-tested with the same `node:test` pattern as `ci-scope.spec.mjs`.
- Failure modes are scoped: dispatcher fail → matrix doesn't run; ci-scope unaffected.

## Architecture

```
ci-scope (existing)         cockpit-e2e-dispatcher (new)
   │                              │
   │ outputs.cockpit_e2e          │ outputs.caps (JSON array)
   ▼                              ▼
   if: scope says run ─────► matrix.cap: ${{ fromJson(...) }}
                                  │
                                  ▼
                           cockpit-e2e (existing, matrix dynamic now)
                                  │
                                  ▼
                           cockpit-e2e-summary (existing, unchanged)
```

## Components

### 1. `scripts/cockpit-matrix.mjs` (new)

Pure-function classifier + executable wrapper.

**Exported pure function:**

```js
/**
 * @param {Array<{angular: string, python: string}>} allCockpitCaps
 *        All cockpit angular projects with an e2e target, paired with
 *        their python sibling path. Derived from the project graph.
 * @param {Set<string>} affectedNames
 *        Set of project names nx-affected returned for this diff.
 * @param {boolean} fullFleet
 *        Force-emit all caps regardless of affected set. True on:
 *        - push events (vs. pull_request)
 *        - cockpit_e2e=true with empty affected ∩ cockpit caps
 *          (lib fanout that nx attributed only to the lib).
 * @returns {Array<{angular: string, python: string}>}
 */
export function selectCockpitCaps(allCockpitCaps, affectedNames, { fullFleet }) {
  if (fullFleet) return allCockpitCaps;
  return allCockpitCaps.filter((cap) => affectedNames.has(cap.angular));
}
```

**Top-level script** (when run as `node scripts/cockpit-matrix.mjs`):

1. Read CLI args: `--base <sha>`, `--head <sha>`, `--full-fleet <true|false>`.
2. Run `npx nx show projects --json` → all project names.
3. For each name matching `^cockpit-.+-angular$`, run `npx nx show project <name> --json` and keep it iff it has an `e2e` target. Derive its python sibling: replace `-angular` suffix with `-python` and look up its `sourceRoot` → strip `/src` to get the python project dir. (Convention is consistent across all 24 caps.)
4. Run `npx nx show projects --affected --base <base> --head <head> --json` → affected names.
5. Call `selectCockpitCaps(allCockpitCaps, new Set(affected), { fullFleet: argFullFleet })`.
6. Write `caps=<JSON.stringify(result)>` to `$GITHUB_OUTPUT`.

If any nx call fails, exit non-zero before writing the output. GitHub Actions will fail the dispatcher job, which fails the dependent matrix job.

### 2. `scripts/cockpit-matrix.spec.mjs` (new)

`node:test` unit tests for `selectCockpitCaps`. Covered cases:

1. **One affected cap** — returns `[{angular, python}]` with just that one.
2. **Multiple affected caps** — returns each one, ordering matches `allCockpitCaps` input.
3. **`fullFleet: true` with empty affected** — returns all caps.
4. **`fullFleet: true` with subset affected** — returns all caps (full-fleet wins).
5. **`fullFleet: false` with empty affected** — returns `[]`.
6. **Non-cockpit affected entries** (`chat`, `langgraph`) — filtered out, no false matches.
7. **Output is JSON-serializable round-trip** — `JSON.parse(JSON.stringify(result))` equals `result`.

### 3. `.github/workflows/ci.yml` modifications

**New job `cockpit-e2e-dispatcher`:**

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
        fetch-depth: 0  # need base..head for nx affected
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

**Modified `cockpit-e2e` job** (only the `needs:` and `strategy.matrix:` change):

```yaml
cockpit-e2e:
  name: "Cockpit — e2e (${{ matrix.cap.angular }})"
  needs: [ci-scope, cockpit-e2e-dispatcher]
  if: github.event_name == 'push' || needs.ci-scope.outputs.cockpit_e2e == 'true'
  runs-on: ubuntu-latest
  strategy:
    fail-fast: false
    max-parallel: 5
    matrix:
      cap: ${{ fromJson(needs.cockpit-e2e-dispatcher.outputs.caps) }}
  steps:
    # ... unchanged ...
```

**`cockpit-e2e-summary` job: unchanged.** GitHub Actions' `needs.<job>.result` aggregates matrix outcomes correctly.

## Data flow per scenario

| Trigger | Dispatcher emits | Matrix runs |
|---|---|---|
| PR touches 1 cap angular dir | 1 entry | 1 runner |
| PR touches 3 cap angular dirs | 3 entries | 3 runners |
| PR touches `libs/chat` (fanout) | 24 entries (full-fleet fallback) | all 24 |
| PR touches docs only | dispatcher job's `if:` short-circuits (cockpit_e2e=false); matrix's `if:` also short-circuits | none |
| Push to main | 24 entries (full-fleet via event_name) | all 24 |

## Error handling

- `nx show projects` fails → script exits non-zero → dispatcher fails → matrix fails fast.
- Empty caps array → fine when `cockpit_e2e=false` (matrix's outer `if:` filters before expansion); never expected when `cockpit_e2e=true` (full-fleet fallback prevents).
- `fromJson` parse failure → workflow-level error. Defensive: script always writes valid JSON or exits before writing.

## Validation post-merge

1. **Single-cap PR** — touch `cockpit/chat/messages/angular/src/foo.ts`. Verify dispatcher emits `[{angular: "cockpit-chat-messages-angular", python: "cockpit/chat/messages/python"}]` and only 1 matrix entry runs.
2. **Lib-fanout PR** — touch `libs/chat/src/foo.ts`. Verify full-fleet path fires, all 24 entries run. (Same behavior as today.)
3. **Push to main** — verify all 24 run on the merge commit. (Same behavior as today.)

## Out of scope

- Dynamic matrix for `examples-chat-e2e` (already a 4-way Playwright shard, not cap-based).
- Dynamic matrix for `cockpit-smoke` (separate job, hardcoded `--projects=` list).
- Reading per-project python sibling path from project graph metadata via dependencies (script uses name convention: `<basename>-angular` → `<basename>-python`).
- Changing `max-parallel: 5`.
- Caching dispatcher's `npm ci` further (already uses `setup-node` cache:npm).
- Reducing dispatcher's ~20-30s wall-time floor.

## Risks

- **nx affected attribution surprises** — if nx doesn't attribute a change to the expected cap, the matrix could under-run. Mitigation: the full-fleet fallback catches the "empty affected ∩ caps" case. If nx ever attributes incorrectly to ONE wrong cap, that's a real silent miss — but it would already be a miss today's lib-fanout heuristic. Same risk surface, not worse.
- **Dispatcher wall-time floor** — every PR pays ~20-30s for the dispatcher even when it would have skipped the matrix entirely. Acceptable: cheaper than running 24 redundant matrix runners.
- **JSON-output edge cases** — single-quote injection in cap names, etc. Caps follow nx project naming rules (alphanumeric + dash), so no injection vector.

## References

- `scripts/ci-scope.mjs:49-62` — pattern this script follows.
- `scripts/ci-scope.spec.mjs` — test shape this script's tests follow.
- `.github/workflows/ci.yml:291-349` — current cockpit-e2e job + matrix.
- `.github/workflows/ci.yml:351-363` — cockpit-e2e-summary (unchanged).
- E2e strategy audit (in-session research, not committed) — opportunity ranked 🟡 medium, est. ~46 CI-min savings per single-cap PR.
