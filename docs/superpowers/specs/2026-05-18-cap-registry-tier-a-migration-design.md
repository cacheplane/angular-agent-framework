# Tier A capability-registry migration — design

> **Place in the larger plan.** Sub-project 1 of the per-cap migration sequence that the umbrella-cleanup audit forced into existence. Eliminates 6 of 9 umbrella consumers by flipping their `pythonDir` pointer in `apps/cockpit/scripts/capability-registry.ts`. After this lands, only c-interrupts, c-generative-ui, and c-a2ui still consume the umbrella — each with its own follow-on sub-project.

## Goal

Switch six "Tier A" capabilities (`c-messages, c-input, c-debug, c-theming, c-threads, c-timeline`) from consuming the umbrella's `chat_graphs.py::_build_prompt_graph` to consuming the per-cap standalone backends that PR #396 already scaffolded.

## Non-goals

- Touching c-interrupts (in flight via PR #382; separate migration follow-up).
- Touching c-generative-ui (Tier C — own sub-project).
- Touching c-a2ui (Tier C — own sub-project; active parallel work on `claude/c-a2ui-confirm-booking-spec`).
- Modifying the umbrella's `chat_graphs.py`, `langgraph.json`, or any file in `cockpit/langgraph/streaming/python/` — the umbrella cleanup is the FINAL sub-project after all caps migrate.
- Renaming files, directories, or projects (the future structural-consistency sweep is separate).
- Changing the per-cap graph logic. The scaffolded graphs are functionally equivalent to the umbrella's `_build_prompt_graph(...)` factory.

## Why this is tiny

PR #396 already built each per-cap dir with a working `graph.py` + `langgraph.json` + `prompts/<cap>.md`. The capability registry just never pointed at them. The work is a 6-line edit + verification.

## What changes

### Single code edit

`apps/cockpit/scripts/capability-registry.ts` — change `pythonDir` on six rows:

| Cap id | Before | After |
|---|---|---|
| `c-messages` | `cockpit/langgraph/streaming/python` | `cockpit/chat/messages/python` |
| `c-input` | `cockpit/langgraph/streaming/python` | `cockpit/chat/input/python` |
| `c-debug` | `cockpit/langgraph/streaming/python` | `cockpit/chat/debug/python` |
| `c-theming` | `cockpit/langgraph/streaming/python` | `cockpit/chat/theming/python` |
| `c-threads` | `cockpit/langgraph/streaming/python` | `cockpit/chat/threads/python` |
| `c-timeline` | `cockpit/langgraph/streaming/python` | `cockpit/chat/timeline/python` |

All six rows keep their existing `pythonPort` (5501, 5502, 5509, 5510, 5506, 5507) — already aligned with the per-cap `proxy.conf.json` targets.

The remaining c-* rows (`c-tool-calls`, `c-subagents`, `c-interrupts`, `c-generative-ui`, `c-a2ui`) are untouched in this PR.

### No other files changed

- `cockpit/chat/<cap>/python/src/graph.py` — already exists, already works (verified by reading; each is 37–57 lines, mirrors `_build_prompt_graph` inlined).
- `cockpit/chat/<cap>/python/langgraph.json` — already registers exactly the one expected graph.
- `cockpit/chat/<cap>/python/prompts/<cap>.md` — already exists with aviation-themed content.
- `cockpit/chat/<cap>/angular/proxy.conf.json` — already targets the right port.
- `cockpit/chat/<cap>/angular/src/environments/environment.development.ts` — already uses `/api` + the correct `streamingAssistantId`.

## Verification

### Production deploy is preserved (corrected — local-dev-only migration)

**Original assumption was wrong.** `scripts/generate-shared-deployment-config.ts` line 54 skips chat capabilities entirely (`if (capability.product !== 'langgraph' && capability.product !== 'deep-agents') continue;`). The c-* graphs reach production via the umbrella's own `langgraph.json` (which registers all 12 graphs and is staged as the `streaming` capability's dependency).

**Actual effect of this PR:** local-dev tooling (`nx serve cockpit-chat-<cap>-angular`) that reads `pythonDir` will now boot the per-cap backend. Production deploy is **unchanged** — c-messages etc. continue to be served from the umbrella's `chat_graphs.py` in LangSmith. This matches the user's stated model: "for production, single langsmith instance."

Concrete check: diff the generated `deployments/shared-dev/langgraph.json` before/after the registry edit. The file must be **byte-identical** — every graph name, every entrypoint path, every order. If the diff is non-empty, something other than the local-dev `pythonDir` got swept up in the edit.

**Accepted tech debt:** after this PR, the per-cap `graph.py` files and the umbrella's `chat_graphs.py` are two copies of the same graphs. A follow-up PR is needed to extend the generator to iterate chat caps + drop c-* entries from the umbrella manifest, after which the per-cap dir becomes the single source of truth for both local + prod. That follow-up is part of the umbrella-cleanup chain.

### Local dev for each cap

For each of the six caps, boot via `npx nx serve cockpit-chat-<cap>-angular`, navigate to the page, send any prompt, expect a streamed response. The per-cap backend boots on its `pythonPort`; the angular dev proxy targets the same port.

### Per-cap prompt content drift

The umbrella's `cockpit/langgraph/streaming/python/prompts/<cap>.md` was the original source. The per-cap `cockpit/chat/<cap>/python/prompts/<cap>.md` was scaffolded from it. If they have drifted (the per-cap version is stale), the migration "works" but the user-facing prompt content silently changes.

Mitigation: a one-shot `diff` of each pair flags drift. Match content exactly, OR consciously choose the better version. The acceptance criterion is "the per-cap prompt content is the version we want going forward" — not "they're byte-identical to the umbrella."

### Reverse audit — the umbrella's chat_graphs.py is now 6 entries lighter

After the merge, `chat_graphs.py` still defines `c_messages, c_input, c_debug, c_theming, c_threads, c_timeline` as exported symbols, but no consumer references them. They become true dead code, ready for the final umbrella cleanup PR (after c-interrupts/c-generative-ui/c-a2ui also migrate).

## Risk surface

- **Per-cap graph never battle-tested.** The scaffolded `graph.py` files compile and import but haven't been exercised by a real local-dev session (the registry never pointed at them). Verification step "boot the angular dev + send a turn" catches any wiring issue per cap.
- **Prompt content drift.** Per-cap prompts may have been hand-tweaked since being scaffolded from the umbrella. Resolved by the explicit diff step.
- **Shared-checkout / parallel-agent chaos.** This repo's shared checkout has seen multiple branch switches mid-task during the brainstorm. Implementer must `git fetch origin && git checkout -b claude/cap-registry-tier-a origin/main` and verify the spec doc is on the branch before editing.

## Acceptance criteria

- `apps/cockpit/scripts/capability-registry.ts` shows the six listed caps with their new `pythonDir` values; no other rows changed.
- `npx tsx scripts/generate-shared-deployment-config.ts` produces a manifest with the **same 26 graph names** as origin/main; only the six migrated caps' entrypoint paths differ.
- For each of the six caps: `npx nx serve cockpit-chat-<cap>-angular` boots cleanly; sending a prompt returns a streamed assistant response.
- The six pairs of prompts (`cockpit/langgraph/streaming/python/prompts/<cap>.md` vs `cockpit/chat/<cap>/python/prompts/<cap>.md`) have been diffed; any meaningful drift is reconciled before merge (resolution decision documented in the PR description).
- No regression in existing cockpit e2e suites (`cockpit-langgraph-streaming-angular`, `cockpit-chat-tool-calls-angular`, `cockpit-chat-subagents-angular`).
- The umbrella's `chat_graphs.py` is untouched (lighter-by-six-consumers is the desired end state, not a code change).
