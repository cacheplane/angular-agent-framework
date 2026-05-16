# Cockpit aimock E2E — Phase 2: harness library + per-example layout

> **Place in the larger plan.** Phase 1 ([#349](https://github.com/cacheplane/angular-agent-framework/pull/349)) shipped the cockpit aimock harness as a single dir under `apps/cockpit/e2e/` with one pilot (`streaming`). That pattern doesn't scale to 15+ cockpit examples — every new example would have to extend the same `globalSetup` to spin up an additional Angular dev server. Phase 2 restructures to a per-example layout backed by a shared internal library, then lands `c-tool-calls` as the second example to validate the new pattern.

## Goal

Refactor the cockpit aimock harness so each cockpit example owns its own e2e directory next to its Angular app. A shared internal library (`libs/internal/aimock-harness`) holds the runner, helpers, and a `createGlobalSetup` factory. Per-example dirs contain only the playwright config (calling the factory with this app's specifics) + fixtures + spec. Phase 2 ships the library, migrates `streaming`, and adds `c-tool-calls`.

## Library

Same as Phase 1: [`@copilotkit/aimock`](https://github.com/CopilotKit/aimock). The new internal library wraps it with the project's specific orchestration (langgraph + Angular dev server boot).

## Non-goals

- Adding more than two example specs in this PR (`streaming` migrated, `c-tool-calls` added). PRs 3+ each add one example.
- Promoting `libs/internal/aimock-harness` to a published `@ngaf/*` library — internal-only for now.
- Changing the chat aimock harness at `examples/chat/aimock-e2e/`. Independent and untouched (the chat harness doesn't have the same scaling concern — it's one example).
- CI workflow restructure beyond what's needed to invoke `nx run-many` over the cockpit-*-angular projects.

## Architecture

```
[Playwright test on CI/local]
    ↓ drives real Chromium
[Angular dev server (per example, port from project.json)]
    ↓ /api proxy → :8123
[LangGraph dev server :8123 (cockpit/langgraph/streaming/python)]
    ↓ OPENAI_BASE_URL=http://localhost:AIMOCK_PORT/v1
[aimock node process (one per Playwright run, fixtures from per-example dir)]
```

Each example's e2e run boots ONE Angular dev server (the one for that example), shares the langgraph dev server (the streaming/python deployment serving 12 graphs), and points aimock at the per-example fixtures dir.

When Phase 3+ adds an example whose graph lives in a different python project (e.g., `cockpit/langgraph/memory/python`), that example's `playwright.config.ts` passes a different `langgraphCwd` to `createGlobalSetup`. The factory handles the difference; per-example configs stay simple.

## File layout

### Internal library (new)

```
libs/internal/aimock-harness/
├── src/
│   ├── aimock-runner.ts         # Copy of examples/chat/aimock-e2e/aimock-runner.ts (proven shape).
│   ├── test-helpers.ts          # sendPromptAndWait helper. Path defaults to '/' (single-page cockpit examples) but accepts an override.
│   ├── global-setup-factory.ts  # createGlobalSetup({ langgraphCwd, angularProject, angularPort, fixturesDir }) → globalSetup function.
│   ├── global-teardown.ts       # Generic teardown; reads the shared state slot.
│   └── index.ts                 # Public exports.
├── project.json                 # Nx library: name "internal-aimock-harness", no published artifact.
├── tsconfig.json
└── README.md
```

`project.json` declares `tags: ["scope:internal"]` and is excluded from the publish workflow.

### Per-example e2e dirs

For each cockpit example getting aimock coverage:

```
cockpit/<product>/<example>/angular/e2e/
├── playwright.config.ts         # imports createGlobalSetup from @ngaf-internal/aimock-harness; passes app-specific opts.
├── fixtures/
│   └── <example>.json           # captured aimock fixture for this example.
├── scripts/
│   └── record-<example>.py      # dev capture recipe for this example's fixture.
├── tsconfig.json
└── <example>.spec.ts            # Playwright test.
```

The Angular project's existing `project.json` gains an `e2e` target pointing at the per-example playwright config. CI invokes `npx nx run-many --target=e2e --projects=cockpit-*-angular --skip-nx-cache`.

### Phase 2 PR concretely

**Created (library + per-example dirs for streaming and tool-calls):**
- `libs/internal/aimock-harness/` (new lib + 5 src files + project.json + tsconfig + README)
- `cockpit/langgraph/streaming/angular/e2e/` (5 files: playwright.config.ts, tsconfig.json, fixtures/streaming.json, scripts/record-streaming.py, streaming.spec.ts)
- `cockpit/chat/tool-calls/angular/e2e/` (5 files: same shape)

**Modified:**
- `cockpit/langgraph/streaming/angular/project.json` — add `e2e` target.
- `cockpit/chat/tool-calls/angular/project.json` — add `e2e` target.
- `apps/cockpit/project.json` — drop the now-orphaned `e2e` target.
- `.github/workflows/ci.yml` — `Cockpit — e2e` job runs `nx run-many --target=e2e --projects=cockpit-*-angular`.
- `tsconfig.json` (root) or `nx.json` paths — register the new internal library import alias if needed.

**Deleted:**
- `apps/cockpit/e2e/` — entire directory (everything moved out).

## Components

### `libs/internal/aimock-harness/src/aimock-runner.ts`

Byte-for-byte port of `examples/chat/aimock-e2e/aimock-runner.ts`. Same `LLMock({ port: 0, chunkSize: 4096 })` setup. Same `addFixturesFromJSON` API.

The chat harness's copy stays as-is — the two harnesses are still independent per the Phase 1 spec; promoting the chat harness onto this library is out of scope (a future cleanup).

### `libs/internal/aimock-harness/src/test-helpers.ts`

```typescript
export interface SendPromptAndWaitOptions {
  /** Route to navigate to before sending the prompt. Default: '/'. */
  path?: string;
}

export async function sendPromptAndWait(
  page: Page,
  prompt: string,
  opts?: SendPromptAndWaitOptions,
): Promise<Locator>;
```

Same wait-on-`data-streaming="false"` invariant as today's helper. Path is configurable; cockpit examples default to `/`, but consumers like an `/embed`-routed app can pass `{path: '/embed'}`.

### `libs/internal/aimock-harness/src/global-setup-factory.ts`

```typescript
export interface CreateGlobalSetupOpts {
  /** Repo-relative path to the python langgraph project (e.g., 'cockpit/langgraph/streaming/python'). */
  langgraphCwd: string;
  /** Port the langgraph dev server binds. Defaults to 8123. Override when an example uses a different python project AND another langgraph might be running on 8123. */
  langgraphPort?: number;
  /** Nx project name of the Angular dev server (e.g., 'cockpit-chat-tool-calls-angular'). */
  angularProject: string;
  /** Port the Angular dev server should bind. */
  angularPort: number;
  /** Repo-relative path to the per-example fixtures dir. */
  fixturesDir: string;
  /** Optional: timeout overrides. */
  langgraphReadyTimeoutMs?: number;
  angularReadyTimeoutMs?: number;
}

export function createGlobalSetup(opts: CreateGlobalSetupOpts): () => Promise<void>;
```

Phase 3+ examples that hit a different python project pass their own `langgraphPort`. When `nx run-many --parallel=N` (N>1) is enabled later, this also avoids cross-run port collisions.

Boots aimock + langgraph (with `OPENAI_BASE_URL` injected) + the named Angular dev server, in order. Stores the shared state on a global slot keyed by `angularProject` so concurrent Playwright workers don't collide (today they don't run concurrently per Phase 1 config; this is just defensive).

### `libs/internal/aimock-harness/src/global-teardown.ts`

```typescript
export default async function globalTeardown(): Promise<void>;
```

Walks the shared state slots, kills processes in reverse order, awaits aimock stop. Idempotent.

### Per-example `playwright.config.ts`

```typescript
// SPDX-License-Identifier: MIT
import { defineConfig, devices } from '@playwright/test';
import { createGlobalSetup } from '@ngaf-internal/aimock-harness';
import { resolve } from 'node:path';

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4504',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  globalSetup: resolve(__dirname, './global-setup-impl.ts'),
  globalTeardown: '@ngaf-internal/aimock-harness/global-teardown',
});
```

The `globalSetup` field needs a file path (Playwright loads it as a module). We have two options:
- (a) Per-example `global-setup-impl.ts` that re-exports `createGlobalSetup({ ... })` with this app's specifics.
- (b) Use Playwright's globalSetup feature with the factory called inside.

Option (a) is cleaner — one ~5-line file per example, fully explicit about which app it's wiring. Spec design picks (a).

### Per-example `global-setup-impl.ts`

```typescript
// SPDX-License-Identifier: MIT
import { createGlobalSetup } from '@ngaf-internal/aimock-harness';
import { resolve } from 'node:path';

export default createGlobalSetup({
  langgraphCwd: 'cockpit/langgraph/streaming/python',
  angularProject: 'cockpit-chat-tool-calls-angular',
  angularPort: 4504,
  fixturesDir: resolve(__dirname, 'fixtures'),
});
```

### Per-example `<example>.spec.ts`

Standard Playwright spec, importing `sendPromptAndWait` from `@ngaf-internal/aimock-harness`.

## c-tool-calls pilot scenario

**Prompt:** `"What's the status of UA123?"`

**Captured fixture (`fixtures/c-tool-calls.json`) — TWO entries, ordered:**
- `match: { userMessage: PROMPT, hasToolResult: true }`, `response: { content: "<final text mentioning UA123 details>" }` — continuation call after tool result is in history.
- `match: { userMessage: PROMPT }`, `response: { toolCalls: [{ name: "lookup_flight", arguments: { flight_number: "UA123" } }] }` — first call.

The `lookup_flight` tool itself executes server-side in the langgraph ToolNode (returns canned UA123 data from `aviation_data.py`). Aimock doesn't mock the tool — only the LLM calls.

**Spec assertions:**
1. A `<chat-tool-call-card>` (or whatever the `<chat-tool-calls>` primitive renders per call) is in the DOM with text mentioning `lookup_flight`. Proves the parent's tool_call routed through the chat-tool-calls UI.
2. The finalized assistant bubble (`chat-message[data-role="assistant"][data-streaming="false"]`) contains a phrase from the captured continuation response (likely `UA123` or the flight's origin/destination from the canned aviation data). Proves the continuation completed end-to-end.

**Capture script:** mirrors `chat_graphs.py`'s `_build_tool_calls_graph()`: ChatOpenAI(gpt-5-mini, streaming=True) bound with `AVIATION_TOOLS`, system prompt from `prompts/tool-calls.md`. Captures parent first call (tool_calls), then re-invokes with synthetic AIMessage(tool_calls) + ToolMessage(tool result from `lookup_flight`) in history to capture the continuation. Same pattern as chat aimock Phase 2d's research-subagent capture.

## CI integration

Update the existing `Cockpit — e2e` job (no rename, no `deploy.needs` change):

```yaml
- run: npx nx run-many --target=e2e --projects=cockpit-*-angular --skip-nx-cache
```

Each cockpit example with an `e2e` target runs sequentially in this single job. When wall-clock becomes a problem (probably 4–5 examples in), shard via Nx affected logic or split into per-product matrix jobs.

The existing setup (`uv sync` for streaming/python, playwright install) stays — Phase 2 examples still hit `streaming/python`. Future examples hitting other python projects get additional `uv sync` steps when needed.

## Local dev workflow

```
# Run a single example's e2e:
npx nx e2e cockpit-chat-tool-calls-angular

# Run all cockpit example e2e:
npx nx run-many --target=e2e --projects=cockpit-*-angular

# Refresh a fixture (needs OPENAI_API_KEY):
OPENAI_API_KEY=sk-... uv run --project cockpit/langgraph/streaming/python \
  python cockpit/chat/tool-calls/angular/e2e/scripts/record-c-tool-calls.py
```

## Library import path

Use Nx's TypeScript path aliases. Add to root `tsconfig.json` (or `tsconfig.base.json` if present):

```json
"paths": {
  "@ngaf-internal/aimock-harness": ["libs/internal/aimock-harness/src/index.ts"],
  "@ngaf-internal/aimock-harness/global-teardown": ["libs/internal/aimock-harness/src/global-teardown.ts"]
}
```

Why `@ngaf-internal/*` prefix: signals "internal use only, not published" without colliding with the published `@ngaf/*` namespace. Pattern can be reused for future internal libraries.

## Risks and unknowns

- **Path-alias resolution at Playwright runtime.** Playwright loads its config as Node ESM/CJS; need to confirm the alias works at runtime (vitest/Angular handle aliases, but Playwright's Node loader may not). If aliases don't resolve, fall back to a relative import path from each playwright.config.ts (`import { createGlobalSetup } from '../../../../libs/internal/aimock-harness/src'`). De-risk first thing in the implementation plan.
- **Per-example port collisions during Nx parallel runs.** `nx run-many` by default runs targets in parallel. If two `e2e` runs try to bind the same `8123` langgraph port simultaneously, they collide. Mitigations: (a) make langgraph port configurable per example (most cockpit examples will use 8123 anyway since they share `streaming/python`), (b) configure `nx run-many --parallel=1` in the CI invocation. Phase 2 will start with `--parallel=1` for safety; future phase optimizes.
- **Migrating streaming spec without regression.** Phase 1's streaming spec passed in CI. Migration must preserve: same fixture content, same prompt, same assertion. Diff should be path moves only.
- **`apps/cockpit/project.json` e2e target removal.** Anything in CI workflow files or scripts that references `nx e2e cockpit` needs updating to `nx run-many --target=e2e --projects=cockpit-*-angular`. Grep confirms there's only the one CI step today (per recent PR #349).

## Acceptance criteria

Phase 2 merges when:
- `libs/internal/aimock-harness/` exists with the runner, helpers, factory, teardown, and a README documenting the API.
- TypeScript path alias `@ngaf-internal/aimock-harness` resolves at Playwright runtime.
- `cockpit/langgraph/streaming/angular/e2e/` exists with the migrated streaming spec; `nx e2e cockpit-langgraph-streaming-angular` passes.
- `cockpit/chat/tool-calls/angular/e2e/` exists with the new c-tool-calls spec; `nx e2e cockpit-chat-tool-calls-angular` passes.
- Both specs pass 3/3 consecutive local runs (with port cooldown between).
- `nx run-many --target=e2e --projects=cockpit-*-angular --parallel=1` runs both green.
- `apps/cockpit/e2e/` deleted entirely; `apps/cockpit/project.json` no longer has an `e2e` target.
- CI `Cockpit — e2e` job updated to use `nx run-many`; passes on PR.
- The chat aimock harness at `examples/chat/aimock-e2e/` is unchanged.

## What lands next (Phase 3+, NOT this PR)

- **Phase 3**: `c-subagents` (also unblocked by PR #347). Adds one e2e dir, one fixture, one spec. The library handles all the orchestration.
- **Phase 4+**: c-interrupts, c-generative-ui, c-a2ui, etc. — each one PR.
- **Eventual cleanup**: migrate the chat aimock harness (`examples/chat/aimock-e2e/`) onto the same library. Currently independent for historical reasons; promoting once a third+ harness wants the same code.
