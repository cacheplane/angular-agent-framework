# cockpit e2e

Cross-stack E2E harness for cockpit example apps. Uses [`@copilotkit/aimock`](https://github.com/CopilotKit/aimock) as a deterministic mock for LLM API calls; the per-product Python LangGraph dev server is launched with `OPENAI_BASE_URL` pointed at it; Playwright drives the example Angular app in real Chromium.

Phase 1 covers `c-messages` only. Future phases each add one example (one fixture + one spec file per PR).

## Run the suite

```
npx nx e2e cockpit
```

Replay-only. No `OPENAI_API_KEY` needed. Reads committed fixtures from `fixtures/`.

## Refresh a fixture

Each captured fixture has a recipe script under `scripts/`. Example for the c-messages fixture:

```
OPENAI_API_KEY=sk-... uv run --project cockpit/langgraph/streaming/python \
  python apps/cockpit/e2e/scripts/record-c-messages.py
```

Commit the updated `fixtures/c-messages.json`. Scripts are dev-only; CI never runs them.

## Layout

- `aimock-runner.ts` — programmatic boot of the mock server (mirrors `examples/chat/aimock-e2e/aimock-runner.ts`).
- `test-helpers.ts` — `sendPromptAndWait` helper that waits on `chat-message[data-streaming="false"]`.
- `fixtures/` — committed JSON fixtures keyed by example.
- `scripts/` — fixture-capture recipes (one per fixture).
- `playwright.config.ts` — Playwright config with globalSetup that boots aimock + LangGraph + Angular dev server.
- `c-messages.spec.ts` — Phase 1 pilot.
