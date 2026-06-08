# examples-ag-ui-angular e2e

Cross-stack E2E harness for the ag-ui example. Uses [`@copilotkit/aimock`](https://github.com/CopilotKit/aimock) as a deterministic mock for LLM API calls; the Python ag-ui backend (`uvicorn src.server:app`) is launched with `OPENAI_BASE_URL` pointed at it; Playwright drives the Angular `/embed` route in real Chromium.

The graph is identical to the chat example — aimock mocks the LLM provider _below_ the transport, so the same graph served over AG-UI with the same committed fixtures produces the same output. The only differences from the chat harness are the backend launcher (uvicorn ag-ui server on `:8000` instead of `langgraph dev` on `:2024`) and the Angular dev-server port (`:4201`).

## Run the suite

```
npx nx e2e examples-ag-ui-angular
```

Replay-only. No `OPENAI_API_KEY` needed. Reads committed fixtures from `fixtures/` (shared with the chat example).

## Layout

- `aimock-runner.ts` — programmatic boot of the mock server.
- `fixtures/` — committed JSON fixtures keyed by scenario name.
- `playwright.config.ts` — Playwright config with globalSetup that boots aimock + the ag-ui uvicorn backend + the Angular dev server.
- `global-setup.ts` — boots aimock (`:0`), uvicorn ag-ui backend (`:8000`, `OPENAI_BASE_URL` → aimock), and `nx serve examples-ag-ui-angular` (`:4201`); waits on `/ok` and `/` respectively.
- `global-teardown.ts` — SIGTERMs the angular + backend children and stops aimock.
- `test-helpers.ts` — pure DOM helpers (`sendPromptAndWait`, browser-hygiene attach, devtools open/close, etc.). Transport-agnostic; shared verbatim with the chat harness.

## Env vars

- `AIMOCK_FIXTURE` — path to a single fixture JSON file (relative to `e2e/`). Defaults to the whole `fixtures/` directory.
