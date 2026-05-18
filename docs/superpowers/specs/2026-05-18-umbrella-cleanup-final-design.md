# Umbrella cleanup (final) — design

> **Place in the larger plan.** Sub-project 6 of 6 — the last step in the per-cap migration chain that began with PR #413. All 11 c-* caps now serve from per-cap dirs for local dev (PRs #413, #417, #382, #421, #424). This sub-project re-routes the production shared-dev deployment to also source c-* graphs from per-cap dirs, then deletes the now-truly-dead duplicate code in `cockpit/langgraph/streaming/python/src/`.
>
> Split into two PRs for safety. PR 1 changes deployment behavior; PR 2 deletes code. Gating PR 2 on a green post-merge `Deploy LangGraph` run preserves the dead umbrella files as a fallback if the new deploy path breaks.

## Goal

Complete the per-cap migration by re-routing the shared-deployment manifest generator to iterate chat capabilities, trimming the umbrella's `langgraph.json` to a single graph, and deleting the duplicate graph source code from the umbrella's `src/`. After both PRs, the per-cap dirs are the **single source of truth** for c-* graphs across local dev AND production.

## Non-goals

- Renaming `cockpit/langgraph/streaming/` to remove the "umbrella" connotation. Out of scope (future structural-consistency sweep).
- Auditing `examples/chat/python` for dead code. Out of scope.
- Aimock spec for c-a2ui (separate sub-project).

## Render caps included (decision: 2026-05-18)

Render caps were originally filtered out alongside chat caps. They're real LangGraph backends (each calls `ChatOpenAI(gpt-5-mini)`), already in per-cap dirs with valid `langgraph.json` manifests. The exclusion was a stale assumption from when chat was excluded.

**This PR aligns render with the rest:** removes the filter entirely so all 4 product types (langgraph, deep-agents, chat, render) iterate via per-cap dirs. Shared-deploy manifest grows from 26 → 32 graphs (6 render caps added: spec-rendering, element-rendering, state-management, r-registry, repeat-loops, computed-functions).

## Background: how the deploy script reaches c-* graphs today

`scripts/generate-shared-deployment-config.ts` (104 lines) iterates `apps/cockpit/scripts/capability-registry.ts` and stages each cap's `pythonDir` into `deployments/shared-dev/deps/`. Line 54's filter skips both `chat` and `render` capabilities:

```typescript
if (capability.product !== 'langgraph' && capability.product !== 'deep-agents') {
  continue;
}
```

C-* graphs reach the manifest through the umbrella's own `langgraph.json` (which registers all 12 graphs and is staged as the `streaming` langgraph capability's dependency). After staging, the umbrella's manifest entries `c-messages: ./src/chat_graphs.py:c_messages` etc. become `./deps/streaming/src/chat_graphs.py:c_messages` in the generated `deployments/shared-dev/langgraph.json`.

This means production deploys still serve c-* from `chat_graphs.py` and friends, even though local dev for those caps now serves from per-cap dirs (via the migrations).

## PR 1: Re-route deploy + trim umbrella manifest

### What changes

**1. `scripts/generate-shared-deployment-config.ts` — remove the filter entirely:**

```typescript
// BEFORE
for (const capability of capabilities) {
  if (capability.product !== 'langgraph' && capability.product !== 'deep-agents') {
    continue;
  }
  const manifestPath = ...
  ...
}
// AFTER
for (const capability of capabilities) {
  const manifestPath = ...
  ...
}
```

All capabilities now iterate. Each cap's per-cap `langgraph.json` files supply the graphs. Chat (11 caps) re-routes from umbrella to per-cap; render (6 caps) gets added to the deploy for the first time.

**2. `cockpit/langgraph/streaming/python/langgraph.json` — trim from 12 entries to 1:**

```json
{
  "graphs": {
    "streaming": "./src/graph.py:graph"
  },
  "dependencies": ["."],
  "python_version": "3.12",
  "env": ".env"
}
```

### Order of changes within PR 1

Both edits must land in the same commit. If the script extension lands first without the manifest trim, `addGraph` collisions throw — every c-* graph gets registered twice (once from the chat-cap iteration with its per-cap path, once from the umbrella-as-streaming-cap iteration with its umbrella path, and `addGraph` rejects conflicting paths).

If the manifest trim lands first without the script extension, the deploy temporarily loses c-* graphs entirely.

Both edits in one atomic commit avoids both failure modes.

### Verification (PR 1)

**Local checks:**
- `npx tsx scripts/generate-shared-deployment-config.ts` succeeds.
- Generated `deployments/shared-dev/langgraph.json` now has **32 graphs** (26 existing + 6 render).
- The 11 c-* graphs' entrypoint paths change:
  - Before: `./deps/streaming/src/<file>.py:<symbol>` (e.g., `./deps/streaming/src/chat_graphs.py:c_messages`)
  - After: `./deps/c-<cap>/src/graph.py:graph` (e.g., `./deps/c-messages/src/graph.py:graph`)
- The 6 render graphs are newly registered with paths like `./deps/spec-rendering/src/graph.py:graph`.
- All other graph paths (langgraph caps, deep-agents caps, examples-chat, streaming) unchanged.
- **Full per-cap verification for all 6 render caps:** each must import (`from src.graph import graph` returns `CompiledStateGraph`), boot (`langgraph dev` registers exactly the expected graph id), and complete one SDK turn exchange ("Hello." → terminal status, ≥1 message in state). Uses gpt-5-mini × 6 turns; minor cost.
- `nx e2e cockpit-langgraph-streaming-angular`, `nx e2e cockpit-chat-tool-calls-angular`, `nx e2e cockpit-chat-subagents-angular` still pass (local dev unaffected).

**Post-merge gate (blocks PR 2):**
- The `Deploy LangGraph` workflow (`.github/workflows/deploy-langgraph.yml`) triggers automatically on merge to main (paths-filtered to `cockpit/**/python/**` etc.). It must run green.
- If `Deploy LangGraph` fails, revert PR 1. The umbrella's `chat_graphs.py` + friends still exist and the prior deploy path is restored on revert.

### Risk surface (PR 1)

- **First real production-deploy-path change in the chain.** Prior PRs were all local-dev only. This one re-routes how 11 chat graphs reach LangSmith Cloud AND adds 6 new render graphs for the first time. Risk: an oversight in a per-cap `langgraph.json` (malformed entry, wrong graph id) surfaces as a deploy failure.
- **Mitigation for chat caps:** every per-cap manifest was indirectly validated by the prior 5 migration PRs (SDK turn exchanges proved each graph loads from its per-cap dir). The change is structurally identical to what local dev has been doing.
- **Mitigation for render caps:** the full per-cap verification (import + boot + SDK turn) runs locally for each of the 6 render caps before push. Catches malformed manifests or missing dependencies before they reach CI.
- **Render-cap LangSmith side effects.** Adding 6 new graphs to LangSmith Cloud may have downstream cost or tracing implications. Worth a confirmation post-merge that nothing unexpected shows up in the LangSmith dashboard.
- **`addGraph` collision risk if the order is wrong.** Plan tasks order the verification of the trimmed manifest BEFORE running the generator to surface the collision early if anything's misaligned.

## PR 2: Delete dead umbrella source files

### Depends on

PR 1 merged AND its post-merge `Deploy LangGraph` run green.

### What changes

Delete six files from `cockpit/langgraph/streaming/python/src/`:

| File | Lines | Why dead |
|---|---:|---|
| `chat_graphs.py` | 198 | All c-* (messages, input, debug, theming, threads, timeline, tool-calls, subagents, interrupts, generative-ui re-export) served from per-cap dirs |
| `a2ui_graph.py` | 632 | c-a2ui served from per-cap dir |
| `dashboard_graph.py` | 177 | c-generative-ui served from per-cap dir |
| `dashboard_tools.py` | 78 | Only `dashboard_graph.py` imported it |
| `aviation_data.py` | 207 | Only `chat_graphs.py` + `a2ui_graph.py` + `dashboard_tools.py` imported it |
| `aviation_tools.py` | 90 | Only `chat_graphs.py` + `a2ui_graph.py` imported it |
| **Total** | **1382** | |

Survives: `src/graph.py` (53 lines, the `streaming` graph) + `src/index.ts` (nx hook).

### Verification (PR 2)

- Pre-flight repo-wide grep for imports of the deleted symbol names/paths from outside the umbrella. Expected: zero hits in live code.
- After deletion: `from src.graph import graph` in the umbrella imports clean (no orphan dependency).
- `langgraph dev --port 5500 --no-browser` in the umbrella registers exactly 1 graph (`streaming`).
- `scripts/generate-shared-deployment-config.ts` still produces a 32-graph manifest with the streaming cap contributing its one graph.
- Local dev + 3 cockpit e2es pass.

### Risk surface (PR 2)

- **Hidden consumer of deleted code.** Mitigated by repo-wide grep at pre-flight. If something turns up post-merge, revert is small (single-PR revert restores the 6 files).
- **`pyproject.toml` over-trim.** Umbrella's pyproject declares only `langgraph`, `langchain-openai`, `langsmith` — all still needed by `graph.py`. No deps to trim.

## Sequencing summary

```
PR 1 lands → Deploy LangGraph workflow runs → green? → PR 2 opens → CI green → PR 2 lands → DONE
                                            → fail? → revert PR 1 → debug → re-try
```

## Acceptance criteria

**PR 1:**
- Deploy script filter removed entirely (no product-type skip).
- Umbrella manifest registers exactly `streaming`.
- Generated shared-deploy manifest: 32 graphs (26 prior + 6 render); 11 c-* paths re-routed to per-cap dirs; 6 render graphs newly added; all other paths unchanged.
- All 6 render caps verified: import + boot + 1 SDK turn each.
- `nx e2e cockpit-langgraph-streaming-angular`, `cockpit-chat-tool-calls-angular`, `cockpit-chat-subagents-angular` still pass.
- Post-merge: `Deploy LangGraph` workflow run is green.

**PR 2:**
- Six listed umbrella src files deleted (~1382 lines).
- Umbrella src dir contains only `graph.py` + `index.ts` (+ `__pycache__/`).
- `from src.graph import graph` imports clean in the umbrella.
- Generated shared-deploy manifest still has 32 graphs.
- `nx e2e cockpit-langgraph-streaming-angular` + 2 cockpit-chat e2es still pass.
- Repo-wide grep finds zero live-code imports of the deleted symbols/paths.

**End state of the chain:**
- Per-cap dirs are the single source of truth for all 11 c-* graphs (local dev + production).
- Umbrella `cockpit/langgraph/streaming/python/` houses only the `streaming` capability (its rightful home — the dir is no longer an "umbrella" in any sense).
