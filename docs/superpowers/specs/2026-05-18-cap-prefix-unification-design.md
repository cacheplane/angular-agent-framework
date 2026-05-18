# Cockpit cap prefix unification (render + deep-agents) — design

> **Place in the larger plan.** Sub-project of Task #2 (rename + structural-consistency sweep) of the post-migration follow-up queue. Threads B + C combined. Chat already uses uniform `c-*` prefix; this PR brings render and deep-agents to the same shape. Thread A (ag-ui registry integration) is a separate sub-project after this.

## Goal

Within each cockpit product type, every cap uses the same prefix scheme:
- **chat:** `c-*` for all 11 caps (already done — PR chain)
- **deep-agents:** `da-*` for all 6 caps (today: only 2 of 6 prefixed)
- **render:** `r-*` for all 6 caps (today: only 1 of 6 prefixed)
- **langgraph:** bare for all 8 caps (no collisions; unchanged)

The renamed value is **both** the capability-registry `id` and the per-cap `langgraph.json` graph name. The two must stay in lockstep (lesson from PR #432's render-registry inconsistency).

## Non-goals

- Renaming cockpit/<product>/<topic>/ directory paths. Those stay bare; only assistant ids get prefixed.
- Renaming angular/python project names like `cockpit-render-spec-rendering-angular`. Those derive from the topic, not the assistant id.
- Cleaning up orphaned LangSmith assistants programmatically. Documented post-merge cleanup.
- Thread A (ag-ui registry integration) — separate sub-project after this.
- Touching langgraph caps (no collisions; no churn for no gain).

## Naming changes

### Render (6 caps)

| Before (id + graphName) | After |
|---|---|
| `spec-rendering` | `r-spec-rendering` |
| `element-rendering` | `r-element-rendering` |
| `state-management` | `r-state-management` |
| `r-registry` (already prefixed) | `r-registry` (unchanged) |
| `repeat-loops` | `r-repeat-loops` |
| `computed-functions` | `r-computed-functions` |

5 renames; the existing `r-registry` row stays as-is.

### Deep-agents (6 caps)

| Before (id + graphName) | After |
|---|---|
| `planning` | `da-planning` |
| `filesystem` | `da-filesystem` |
| `da-subagents` (already prefixed) | `da-subagents` (unchanged) |
| `da-memory` (already prefixed) | `da-memory` (unchanged) |
| `skills` | `da-skills` |
| `sandboxes` | `da-sandboxes` |

4 renames; the existing `da-subagents` + `da-memory` rows stay as-is.

**Total: 9 caps renamed.**

## Architecture

Each cap rename touches ~8 files in lockstep:

1. `apps/cockpit/scripts/capability-registry.ts` — 1 row's `id` + `graphName` fields.
2. `cockpit/<product>/<topic>/python/langgraph.json` — the one graph entry's key.
3. `cockpit/<product>/<topic>/python/src/index.ts` — the module-id string the cockpit app uses for nav.
4. `cockpit/<product>/<topic>/angular/src/index.ts` — analogous module-id string.
5. `libs/cockpit-registry/src/lib/manifest.ts` — any hardcoded id references.
6. `libs/cockpit-registry/src/lib/manifest.spec.ts` — fixture/snapshot updates.
7. `libs/cockpit-docs/src/lib/docs-bundle.spec.ts` — same.
8. `scripts/assemble-examples.ts` — same.

**Order within the PR (one atomic commit per cap):** for each of the 9 caps, change all of its references in one commit. Avoids any intermediate state where the registry row and the graph name diverge.

## Production deploy impact

Each rename produces a new LangSmith Cloud assistant under the new id. The 9 old assistants (`spec-rendering, element-rendering, state-management, repeat-loops, computed-functions, planning, filesystem, skills, sandboxes`) become orphaned post-merge. Orphans don't cost anything significant; a human can clean them up via the LangSmith dashboard at their leisure. This PR does NOT programmatically delete them.

## Verification

### Local (per-commit + cumulative)

For each of the 9 per-cap commits:
- The cap's registry row + langgraph.json + index.ts files are all updated to the new id.
- `npx tsc --noEmit apps/cockpit/scripts/capability-registry.ts --skipLibCheck` clean.

After all 9 commits land:
- `npx tsx scripts/generate-shared-deployment-config.ts` succeeds.
- Generated manifest has 32 graphs (same count as before; just 9 names changed).
- The 9 renamed entrypoint paths all reflect the new ids.
- The 23 unchanged paths (langgraph + chat caps + extras + streaming) are byte-identical to before.

### Spot-check graph boot

For 2 representative renamed caps (one render + one deep-agents):
- `from src.graph import graph` succeeds.
- `langgraph dev` registers exactly the new graph id, no traceback.

Don't spot-check all 9 — the prior migration PRs validated each per-cap dir's manifest plumbing. Pre-flight grep + lockstep edits are the primary trust.

### Library tests

- `nx test cockpit-registry` passes after manifest.spec.ts fixture updates.
- `nx test cockpit-docs` passes after docs-bundle.spec.ts updates.

### Existing cockpit aimock e2es

All 4 (streaming, tool-calls, subagents, c-interrupts) must still pass. None of them touch the renamed caps' graphs, but they share the cockpit app's runtime — a registry typo could surface here.

### Post-merge

`Deploy LangGraph` workflow must succeed. The shared-dev manifest will now reference the 9 new assistants; LangSmith Cloud creates them on first deploy.

## Risk surface

- **Hidden cap-id consumer.** A docs page, hardcoded URL, config file somewhere references a bare id. Pre-flight repo-wide grep before each per-cap commit + a final grep at the end catch this.
- **Per-cap lockstep failure.** If a commit updates the registry row but misses the langgraph.json, the cap's deploy is misaligned (same root cause as PR #432's render-registry bug). Per-cap commit boundaries make this easy to spot in code review.
- **Production assistant orphans.** Accepted; documented in PR description.
- **CI domain churn.** User warned `examples/chat — e2e` may stay red on main. Use admin-merge if only unrelated jobs fail, as for PR #445.
- **Library test snapshot churn.** manifest.spec.ts likely has a snapshot of all 32 cap ids. Updating it is mechanical but easy to miss in spot-checks.

## Acceptance criteria

- `apps/cockpit/scripts/capability-registry.ts`:
  - All 11 chat caps `c-*` (unchanged from main).
  - All 6 deep-agents caps `da-*`.
  - All 6 render caps `r-*`.
  - All 8 langgraph caps bare (unchanged from main).
- Each per-cap `langgraph.json` registers the matching graph id.
- 18 `src/index.ts` files (9 caps × 2 sides) reference the new id.
- `scripts/generate-shared-deployment-config.ts` succeeds; 32-graph manifest.
- Spot-check graph boot for one render + one deep-agents renamed cap.
- `nx test cockpit-registry` + `nx test cockpit-docs` pass after fixture updates.
- 4 cockpit aimock e2es pass.
- Final grep finds zero references to any of the 9 bare ids in live code.
- Post-merge Deploy LangGraph green.

## Out of scope (deferred follow-ups)

- Thread A: ag-ui registry integration (Task #6 in the queue).
- Orphan LangSmith assistant cleanup (manual post-merge by a human).
- Renaming cockpit/<product>/<topic>/ dir paths or angular project names.
- Adding `lg-*` prefix to langgraph caps (no collisions, would be churn for no gain).
