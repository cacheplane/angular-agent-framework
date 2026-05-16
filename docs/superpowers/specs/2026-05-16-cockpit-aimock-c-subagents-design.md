# Cockpit aimock E2E — Phase 3: c-subagents

> **Place in the larger plan.** Second per-example spec under the harness library landed in Phase 2 ([#356](https://github.com/cacheplane/angular-agent-framework/pull/356)). Validates the harness on a richer scenario than the c-tool-calls pilot — the orchestrator emits N task-tool fanouts (subagent dispatches) rather than a single tool call.

## Goal

Add an aimock-driven Playwright spec for `c-subagents`: the orchestrator LLM dispatches subagents via the `task` tool, the `<chat-subagents>` UI primitive renders cards, the orchestrator's final summary surfaces in the conversation. One new per-example e2e dir at `cockpit/chat/subagents/angular/e2e/`. No harness library changes — the library handles this scenario as-is.

## Architecture

Same per-example shape as Phase 2's `c-tool-calls/`. Differences:

- **Angular project:** `cockpit-chat-subagents-angular` on port 4505 (per `apps/cockpit/scripts/capability-registry.ts`).
- **LangGraph port:** `8125`, next in sequence after streaming (8123) and tool-calls (8124). Avoids the TIME_WAIT collision pattern fixed in Phase 2.
- **Python graph:** `c_subagents` from `cockpit/langgraph/streaming/python/src/chat_graphs.py:_build_subagents_graph()` — orchestrator LLM bound with one `task` tool that dispatches to three subagent functions (research / booking / itinerary).
- **Multi-turn fixture shape:** parent's first call emits N `task` tool_calls (one or more, depends on what the captured LLM returns); ToolNode executes each `task(role, description)` server-side; orchestrator continuation emits final summary text. Same `hasToolResult: true` discriminator on the continuation entry as Phase 2's c-tool-calls.

## File layout

```
cockpit/chat/subagents/angular/e2e/
├── playwright.config.ts             # relative-import ../../../../../libs/internal/aimock-harness/src
├── global-setup-impl.ts             # langgraphPort: 8125
├── tsconfig.json
├── .gitignore
├── fixtures/c-subagents.json        # captured: parent task tool_calls + orchestrator continuation
├── scripts/record-c-subagents.py    # dev-only capture recipe
└── c-subagents.spec.ts              # asserts subagent card + final summary phrase
```

Modified:
- `cockpit/chat/subagents/angular/proxy.conf.json` — `target: "http://localhost:8125"` (was `:8123`)
- `cockpit/chat/subagents/angular/project.json` — add `e2e` target
- `.github/workflows/ci.yml` — add `cockpit-chat-subagents-angular` to the per-example CI loop

## Components

### `fixtures/c-subagents.json`

Captured from real `gpt-5-mini` via the recipe script. The orchestrator's behavior under the `task` tool is what we mock:

```json
{
  "fixtures": [
    {
      "match": { "userMessage": "<PROMPT>", "hasToolResult": true },
      "response": { "content": "<orchestrator final summary referencing trip details>" }
    },
    {
      "match": { "userMessage": "<PROMPT>" },
      "response": {
        "toolCalls": [
          { "name": "task", "arguments": { "role": "research", "task_description": "..." } },
          { "name": "task", "arguments": { "role": "booking", "task_description": "..." } },
          { "name": "task", "arguments": { "role": "itinerary", "task_description": "..." } }
        ]
      }
    }
  ]
}
```

If the LLM dispatches subagents one-at-a-time across multiple LLM calls (rather than fanning out in a single response), the fixture needs intermediate entries. The capture script discovers the actual shape and writes whatever the LLM did. The spec's assertions stay loose enough to tolerate both shapes.

### `scripts/record-c-subagents.sh`

Direct-LLM-invocation capture (Phase 2 c-tool-calls pattern) does NOT work for c-subagents: the `task` tool dispatches to subagent functions that EACH run their own LLM-driven agent loop. Direct invocation captures only the orchestrator's calls; subagent LLM calls (with role-specific system prompts and possibly tool-driven sub-rounds) go uncaptured and aimock 404s on them at replay time.

The right capture is at the HTTP boundary. The script orchestrates three subprocesses:

1. **aimock** in `--record` mode (`npx aimock --record --provider-openai https://api.openai.com --fixtures <out>`). Proxies unmatched LLM requests to real OpenAI, saves every interaction as a fixture entry.
2. **langgraph dev** for the cockpit-streaming python project, with `OPENAI_BASE_URL=http://aimock:port/v1`.
3. **A LangGraph SDK HTTP call** that creates a thread, submits a run with the prompt against the `c-subagents` graph, polls until the run completes.

After cleanup, the fixture file has entries for every LLM call in the full graph: orchestrator first call, each subagent role's calls, any sub-rounds within subagent agent loops, and the orchestrator continuation. Aimock's replay engine matches each call by its own discriminators (user/system message, tool result presence, etc.) — no manual entry hand-stitching needed.

This is the canonical "capture multi-LLM flows" pattern and is reusable for future cockpit examples with similar shape (c-interrupts when refactored, c-generative-ui dashboard, etc.).

### `c-subagents.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
import { sendPromptAndWait } from '../../../../../libs/internal/aimock-harness/src';

const PROMPT = 'Plan a trip from LAX to JFK';

test('c-subagents: orchestrator dispatches task subagents, summary surfaces in bubble', async ({ page }) => {
  const bubble = await sendPromptAndWait(page, PROMPT);

  // At least one subagent card rendered in the chat-subagents UI primitive.
  // Proves the orchestrator's `task` tool_call routed through the chat-subagents
  // primitive's filter (default subagentToolNames = ['task']).
  const subagentCard = page.locator('chat-subagent-card').first();
  await expect(subagentCard).toBeAttached({ timeout: 30_000 });

  // Final summary text contains an aviation-related phrase from the captured
  // continuation. Loose match so refactors to the subagent prompts don't
  // break the test.
  const finalText = await bubble.innerText();
  expect(finalText.toLowerCase()).toMatch(/lax|jfk|itinerary|trip|flight/);
});
```

### `global-setup-impl.ts`

```typescript
import { resolve } from 'node:path';
import { createGlobalSetup } from '../../../../../libs/internal/aimock-harness/src';

export default createGlobalSetup({
  langgraphCwd: 'cockpit/langgraph/streaming/python',
  langgraphPort: 8125,
  angularProject: 'cockpit-chat-subagents-angular',
  angularPort: 4505,
  fixturesDir: resolve(__dirname, 'fixtures'),
});
```

### CI loop update

In `.github/workflows/ci.yml`:

```yaml
for proj in cockpit-langgraph-streaming-angular cockpit-chat-tool-calls-angular cockpit-chat-subagents-angular; do
```

One-line addition to the existing loop.

## Risks and unknowns

- **Orchestration shape varies per LLM call.** The `gpt-5-mini` model might dispatch 3 task tool_calls in one response, or one at a time across 3 LLM rounds, or some hybrid. The capture script handles the actual shape; the spec's assertions stay loose. If the LLM happens to NOT dispatch any task calls on the captured run (just emits text), STOP and try a more explicit prompt.
- **Subagent card selector.** Spec asserts `chat-subagent-card`. Verified via `libs/chat/src/lib/compositions/chat-subagent-card/chat-subagent-card.component.ts:33` selector. If a future refactor renames the component, the spec breaks visibly with a clear locator-not-found error, not silently.
- **Port 8125 conflict.** Already used elsewhere in dev tooling? Quick grep verified no current bindings in the repo. Future cockpit examples pick 8126, 8127, etc.
- **No new harness changes.** The library's globalSetup factory already accepts `langgraphPort`. No risk to other examples; Phase 2's streaming and tool-calls keep their existing ports.

## Acceptance criteria

Phase 3 merges when:
- `cockpit/chat/subagents/angular/e2e/` exists with all per-example files (config, fixture, spec, capture script, tsconfig, .gitignore).
- `cockpit/chat/subagents/angular/proxy.conf.json` targets `:8125`.
- `cockpit/chat/subagents/angular/project.json` has an `e2e` target pointing at the new playwright config.
- `nx e2e cockpit-chat-subagents-angular` passes locally + 3/3 stability runs.
- The CI loop in `.github/workflows/ci.yml` runs all three examples (streaming + tool-calls + subagents) green sequentially.
- No changes to `libs/internal/aimock-harness/` (proves library design is sound for richer scenarios).

## What lands next (Phase 4+, NOT this PR)

- Each remaining cockpit example targeted by aimock — one PR each.
- Eventually: migrate the chat aimock harness (`examples/chat/aimock-e2e/`) onto the same library to eliminate the duplicate `aimock-runner.ts`.
