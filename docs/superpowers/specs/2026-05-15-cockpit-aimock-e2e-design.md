# Cockpit aimock E2E — design

> **Place in the larger plan.** Cockpit examples (15+ Angular apps demonstrating different agent capabilities) have no automated agent-flow coverage today: the existing `apps/cockpit/e2e/all-examples-smoke.spec.ts` either checks UI shell only or skips when `OPENAI_API_KEY` is absent (so the send-message tests are dead in CI). This design proposes a new Nx project that replaces the existing cockpit e2e surface entirely with aimock-driven per-example coverage.

## Goal

Build cross-stack E2E test coverage for cockpit example apps, modeled after the chat aimock harness ([`examples/chat/aimock-e2e/`](../../../examples/chat/aimock-e2e/)). The new harness lives at the existing `apps/cockpit/e2e/` location — it IS the cockpit e2e from here on. The cockpit Nx project's existing `e2e` target is rewired to drive the new harness. Phase 1 lands the harness scaffolding + one pilot example (`streaming`). Phases 2+ add one example per PR.

## Library

Same as the chat harness: [`@copilotkit/aimock`](https://github.com/CopilotKit/aimock). The runner uses the `addFixturesFromJSON` API (proven in Phase 2d) so fixture entries can carry richer match shapes (`toolName`, `hasToolResult`, `turnIndex`).

## Non-goals

- Cockpit web-app shell coverage (the `cockpit.spec.ts` and `dark-mode.spec.ts` flows in the existing `apps/cockpit/e2e/` project). The existing project is deleted. A separate effort can rebuild cockpit-shell coverage if needed.
- Replacing the chat aimock harness at `examples/chat/aimock-e2e/`. Fully independent.
- Multi-product coverage in Phase 1 (e.g., deep-agents, ag-ui, render). The pilot is langgraph-product-only; other products can be added later.
- Production code changes outside of CI workflow files and the new Nx project (no proxy.conf changes, no app code changes).

## What "replace the existing cockpit e2e" means concretely

Phase 1 deletes:
- `apps/cockpit/e2e/cockpit.spec.ts`
- `apps/cockpit/e2e/dark-mode.spec.ts`
- `apps/cockpit/e2e/all-examples-smoke.spec.ts`
- `apps/cockpit/e2e/production-smoke.spec.ts` (orphaned — was opt-in for production checks)
- `apps/cockpit/playwright.config.ts` (moves into `apps/cockpit/e2e/playwright.config.ts`)

Phase 1 modifies:
- `apps/cockpit/project.json`'s `e2e` target — points at the new `apps/cockpit/e2e/playwright.config.ts`, no other changes.

Phase 1 adds (all under `apps/cockpit/e2e/`):
- aimock harness modules (runner, helpers, globalSetup/teardown, playwright config)
- One pilot fixture + spec for streaming
- One capture script

The `Cockpit — e2e` CI job in `.github/workflows/ci.yml` is renamed/rewired (the existing `npx nx e2e cockpit` invocation now drives the new harness because the target's config path changed).

The shell tests catch real regressions on Next.js routing + hydration, but cockpit-shell coverage isn't this phase's value. Per the user direction: "we can always have a cockpit web app e2e test in the future."

## Architecture

```
[Playwright test on CI/local]
    ↓ drives real Chromium
[Angular dev server :4300 (cockpit-langgraph-streaming-angular)]
    ↓ /api proxy → :8123
[LangGraph dev server :8123 (cockpit/langgraph/streaming/python)]
    ↓ OPENAI_BASE_URL=http://localhost:AIMOCK_PORT/v1
[aimock node process]
    ↑ reads fixtures/*.json
```

The langgraph deployment at `cockpit/langgraph/streaming/python/langgraph.json` already registers 12 graphs (`streaming`, `c-messages`, `c-input`, `c-debug`, `c-interrupts`, `c-theming`, `c-threads`, `c-timeline`, `c-tool-calls`, `c-subagents`, `c-a2ui`, `c-generative-ui`) from one process. The pilot uses graph `streaming`. Future per-example specs that hit graphs in `streaming/python` reuse the same langgraph process; specs that need a graph from a different python project (e.g., `memory`, `interrupts`) get a second langgraph spawned by globalSetup on a different port + a per-example proxy override.

Phase 1 only covers `streaming`, so only `streaming/python` is launched.

## Why `streaming` is the pilot (not `c-a2ui`, `c-messages`, or `c-tool-calls`)

The Phase 1 pilot targets the foundational invariant — "an LLM-driven response routes through the cockpit chat composition into rendered DOM." `streaming` is the cleanest fit because:

- It calls a real LLM (`ChatOpenAI.ainvoke()` from `build_streaming_graph()` in `cockpit/langgraph/streaming/python/src/graph.py`, with a system prompt from `prompts/streaming.md`), so aimock is meaningfully exercised.
- The angular app `cockpit-langgraph-streaming-angular` uses the **full `<chat>` composition** from `@ngaf/chat`, which renders `<chat-message>` elements with the `data-streaming` attribute the harness's `sendPromptAndWait` helper waits on.
- No tool bindings, no interrupts, no subagents — the assertion is just "assistant text rendered." Matches Phase 2a/2b's `hi.json` smoke pattern.

Other candidates were rejected during brainstorming + implementation:

- **`c-a2ui`** — graph is fully hardcoded (returns a `CONTACT_FORM_JSONL` constant). No LLM call. Aimock would be a tree falling in the forest.
- **`c-messages`** — graph IS LLM-driven (via `_build_prompt_graph("messages.md")`), but the angular app `cockpit-chat-messages-angular` uses `<chat-message-list>` without providing message-template slots, so it never renders any messages. The pilot's DOM assertions can't ever match.
- **`c-tool-calls`** — same shape as `c-messages` (LLM-driven graph, but the angular app uses primitives without templates). The system prompt also SAYS the LLM has tools, but the graph doesn't actually `bind_tools()`.
- **`c-generative-ui`** — uses `dashboard_graph.py` which IS a real multi-node LLM-driven flow with tool binding. Too complex for the pilot; Phase 2+ candidate after the c-* refactor sub-phase lands.

> **Sub-phase memo (out of scope here):** Most `c-*` graphs need to be refactored to actually exercise their named capability (real tools bound for `c-tool-calls`, real `interrupt({...})` for `c-interrupts`, real subagent dispatch for `c-subagents`, real `render_a2ui_surface` for `c-a2ui`). That refactor unblocks per-capability aimock test coverage in subsequent phases. Captured in the user's project memory under `project_cockpit_chat_examples_llm_driven_followup.md`.

## File layout

```
apps/cockpit/e2e/
├── aimock-runner.ts         # Copy of examples/chat/aimock-e2e/aimock-runner.ts.
├── fixtures/
│   └── streaming.json          # Captured assistant text response for the streaming example.
├── global-setup.ts          # Boots aimock + streaming/python langgraph + streaming Angular dev server.
├── global-teardown.ts       # Reverse order shutdown.
├── playwright.config.ts     # Cockpit aimock e2e Playwright config.
├── README.md
├── scripts/
│   └── record-streaming.py     # Fixture-capture recipe (dev-only).
├── test-helpers.ts          # sendPromptAndWait helper (waiting on data-streaming="false").
├── tsconfig.json
└── streaming.spec.ts           # Phase 1 pilot.
```

No new Nx project. The existing `cockpit` Nx project's `e2e` target is reused — only its `config` path changes from `apps/cockpit/playwright.config.ts` to `apps/cockpit/e2e/playwright.config.ts`. Build/serve/test targets are untouched.

Module duplication from `examples/chat/aimock-e2e/`: `aimock-runner.ts` (~85 lines) and `test-helpers.ts` (~30 lines) are byte-for-byte copies. Acceptable cost for keeping the two harnesses fully independent (per user direction). Promotion to a shared library lands as a separate spec when a third harness wants the same code.

## Components

### `aimock-runner.ts`

Identical to `examples/chat/aimock-e2e/aimock-runner.ts` as of [PR #330](https://github.com/cacheplane/angular-agent-framework/pull/330). Uses `LLMock({ port: 0, chunkSize: 4096 })` and `mock.addFixturesFromJSON(entries)` so fixture entries can carry the full match-discriminator surface aimock supports.

### `global-setup.ts`

Boots in order:
1. **aimock** via the runner module, fixtures dir = `apps/cockpit/e2e/fixtures`.
2. **streaming/python langgraph** as a child process: `uv run langgraph dev --port 8123 --no-browser`, env `OPENAI_BASE_URL=<aimock.baseUrl>` + `OPENAI_API_KEY=test-not-used`. cwd = `cockpit/langgraph/streaming/python`.
3. **streaming Angular dev server** as a child process: `npx nx serve cockpit-langgraph-streaming-angular --port 4300`. cwd = repo root.

Waits for each to be ready (HTTP GET `/ok` or `/`) with a 60–120s timeout before proceeding.

When future phases add examples hitting a different python project (e.g., `cockpit/langgraph/memory/python`), the globalSetup grows to spawn the additional langgraph processes on different ports. The Angular env per-example already knows its langgraph URL via `environment.langGraphApiUrl`; for cross-port deployments, we either override that env at build time or use a thin per-example proxy config update. Deferred until needed.

### `test-helpers.ts`

`sendPromptAndWait(page, prompt)` — exact copy of the helper from [PR #327](https://github.com/cacheplane/angular-agent-framework/pull/327). Waits on `chat-message[data-role="assistant"][data-streaming="false"]` before returning the finalized bubble locator.

### `playwright.config.ts`

Standard Playwright config:
- `testDir: '.'`
- `testMatch: '**/*.spec.ts'`
- `testIgnore: ['aimock-runner.spec.ts']` if a runner spec is added later (Phase 1 doesn't include one — runner is copy-pasted and already exercised by the chat harness).
- `projects: [{ name: 'chromium', use: devices['Desktop Chrome'] }]` to suppress the webkit-deps warning being addressed in [PR #339](https://github.com/cacheplane/angular-agent-framework/pull/339).
- `globalSetup`, `globalTeardown` wired.
- `workers: 1`, `fullyParallel: false` for Phase 1 (single langgraph, single Angular dev server can't safely run parallel tests yet).
- `retries: 2` in CI, `0` locally.

### `streaming.spec.ts` (Phase 1 pilot)

Captures a real text response from `gpt-5-mini` for a fixed prompt (same capture-script pattern as Phase 2a's `hi.json`). Asserts:

1. The finalized assistant bubble (`chat-message[data-role="assistant"][data-streaming="false"]`) is in the DOM.
2. The bubble's text contains a distinctive phrase from the captured fixture — proves the LLM response routed through aimock + langgraph + the cockpit chat composition into rendered DOM.
Matches the strictness level chosen during brainstorming ("B" — finalized streaming wait + content-phrase match, no per-component structural assertions).

### `fixtures/streaming.json`

Captured from a real `gpt-5-mini` run via a python script that mirrors the streaming graph's LLM setup (`_build_prompt_graph("messages.md")` with the `prompts/messages.md` system prompt). Same capture pattern as Phase 2a's `hi.json` — the python script is committed under `scripts/` for fixture refresh, the JSON fixture is committed.

The fixture's `match.userMessage` exact-matches the prompt the spec sends. The `response` carries `content` (the captured assistant text). No continuation entry needed for Phase 1 — the assertion is on the rendered text, not on a multi-turn flow.

### `README.md`

Short doc covering: how to run locally, how to capture a new fixture (referencing the throwaway python script pattern), what each file is for, links to the chat harness for the analogous infrastructure.

## CI integration

### Update the existing `Cockpit — e2e` job

Edit `.github/workflows/ci.yml`:

- **Keep** the existing `cockpit-e2e` job (named "Cockpit — e2e"). It already invokes `npx nx e2e cockpit`, which after this phase drives the new harness because `apps/cockpit/project.json`'s `e2e` target points at the new playwright config.
- **Add** the steps the new harness needs (uv install, python sync, fail-trace upload). The chromium install is already there.

The updated job body:

```yaml
cockpit-e2e:
  name: Cockpit — e2e
  runs-on: ubuntu-latest
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
    - working-directory: cockpit/langgraph/streaming/python
      run: uv sync
    - run: npx playwright install --with-deps chromium
    - run: npx nx e2e cockpit --skip-nx-cache
    - name: Upload Playwright trace on failure
      if: failure()
      uses: actions/upload-artifact@v4
      with:
        name: cockpit-e2e-trace
        path: apps/cockpit/e2e/test-results/
        retention-days: 7
```

- **No `deploy.needs` change** — the job name stays `cockpit-e2e` so the existing entry in the `deploy` job's `needs:` list keeps working.

## Local dev workflow

```
# Run the suite (replay only — no OPENAI_API_KEY needed)
npx nx e2e cockpit

# Capture or refresh a fixture (needs OPENAI_API_KEY)
OPENAI_API_KEY=sk-... uv run --project cockpit/langgraph/streaming/python \
  python apps/cockpit/e2e/scripts/record-<example>.py
```

Each captured fixture's recipe script is committed to `apps/cockpit/e2e/scripts/` (different from the chat harness — these scripts are useful enough to keep around for refresh, unlike the truly-throwaway Phase 2c script). The script is dev-only; CI never runs it.

## Coordination with open PR #339

[PR #339](https://github.com/cacheplane/angular-agent-framework/pull/339) modifies `apps/cockpit/playwright.config.ts` and `apps/website/playwright.config.ts` to scope to chromium and drops two orphaned worktree gitlinks. This phase deletes `apps/cockpit/playwright.config.ts` (moves into `apps/cockpit/e2e/playwright.config.ts`), making the cockpit half of #339 moot.

Coordination plan:
- Merge #339 first (it's a clean small fix; reviewers expect it).
- Then this phase deletes the old `apps/cockpit/playwright.config.ts` and replaces it with `apps/cockpit/e2e/playwright.config.ts`, superseding the cockpit half of #339.
- The website half of #339 (`apps/website/playwright.config.ts` and the gitlink removal) is kept and continues to provide value.

## Risks and unknowns

- **streaming/python boot time.** The streaming graph is registered alongside 11 other graphs in `streaming/python/langgraph.json`. Cold start may be slower than the chat harness's `examples/chat/python` startup. Mitigation: `waitForPort` timeout = 90s (vs. 60s for chat). Real measurement happens during Task 0 de-risk.
- **OPENAI_BASE_URL handoff for cockpit.** Phase 2a verified this works for `examples/chat/python`. The cockpit `streaming/python` agent code might construct OpenAI clients differently. Task 0 de-risk reads `cockpit/langgraph/streaming/python/src/` and confirms no hardcoded `base_url=` overrides.
- **Angular nx serve startup time.** Each cockpit example uses `@angular/build:dev-server`. First serve may be ~30s including a cold build. Spec timeouts (`toBeAttached({ timeout: 45_000 })`) need to be generous enough.
- **Future per-example proxy concerns.** When phases 2+ add examples hitting a python project other than `streaming/python`, the per-example proxy target (currently always `:8123`) needs a per-example mapping. This is a future-phase concern — Phase 1 doesn't need it.

## Acceptance criteria

Phase 1 merges when:
- The four existing specs at `apps/cockpit/e2e/` (cockpit, dark-mode, all-examples-smoke, production-smoke) are deleted.
- `apps/cockpit/playwright.config.ts` is deleted (moved to `apps/cockpit/e2e/playwright.config.ts`).
- `apps/cockpit/project.json`'s `e2e` target's `config` path points to the new `apps/cockpit/e2e/playwright.config.ts`.
- New harness modules + fixture + pilot spec live under `apps/cockpit/e2e/`.
- `nx e2e cockpit` passes locally + in CI against the new harness.
- One pilot spec (`streaming.spec.ts`) passes 3/3 consecutive local runs with retry-free CI.
- One committed fixture at `apps/cockpit/e2e/fixtures/streaming.json`, captured from a real `gpt-5-mini` run (text response — NOT envelopes/toolCalls).
- One capture script at `apps/cockpit/e2e/scripts/record-streaming.py` for fixture refresh.
- The existing `Cockpit — e2e` CI job is updated with the steps the new harness needs (uv install, python sync, fail-trace upload); job name + position in `deploy.needs` unchanged.

## What lands next (Phases 2+, NOT this phase)

For sizing, the likely follow-up shape (one PR per phase):

- **Phase 2** — second `c-*` example from the streaming/python langgraph (e.g., `c-tool-calls`, `c-interrupts`, `c-subagents`, `c-generative-ui`). Reuses the existing langgraph process; just adds a fixture + spec file.
- **Phase 3** — first example from a different python project (e.g., `memory` from `cockpit/langgraph/memory/python`). Tests the multi-langgraph globalSetup pattern.
- **Phase 4+** — one PR per remaining cockpit example, prioritized by which capabilities have shipped product regressions historically.
- **Eventually** — promote the duplicated `aimock-runner.ts` + `test-helpers.ts` to a shared `libs/internal/aimock-harness/` library when a third harness is on the horizon.
