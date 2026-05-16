# examples-chat-angular e2e

Cross-stack E2E harness for the chat example. Uses [`@copilotkit/aimock`](https://github.com/CopilotKit/aimock) as a deterministic mock for LLM API calls; the Python LangGraph dev server is launched with `OPENAI_BASE_URL` pointed at it; Playwright drives the Angular `/embed` route in real Chromium.

## Run the suite

```
npx nx e2e examples-chat-angular
```

Replay-only. No `OPENAI_API_KEY` needed. Reads committed fixtures from `fixtures/`.

## Refresh a fixture

```
OPENAI_API_KEY=sk-... npx nx run examples-chat-angular:record -- hi
```

Captures a real OpenAI run for the named scenario, writes the result to `fixtures/<name>.json`. Commit the updated fixture.

## Detect fixture drift

```
OPENAI_API_KEY=sk-... npx nx run examples-chat-angular:drift
```

Re-records each committed fixture against real OpenAI and reports byte-level diffs. CI runs this on a daily schedule and opens an issue when drift is detected; it does NOT auto-update fixtures.

## Layout

- `aimock-runner.ts` — programmatic boot of the mock server.
- `fixtures/` — committed JSON fixtures keyed by scenario name.
- `scripts/record.ts` — dev-only fixture-capture CLI.
- `scripts/drift.ts` — CI fixture-drift comparison.
- `playwright.config.ts` — Playwright config with globalSetup that boots aimock + LangGraph + Angular dev server.
- `smoke.spec.ts` — Phase 2a smoke test (one scenario: "hi").

## Env vars

- `AIMOCK_FIXTURE` — path to the fixture JSON file. Defaults per-test.
- `AIMOCK_MODE` — `replay` (default) or `record`. Tests run only in replay.
