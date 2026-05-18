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
- `initial-render.spec.ts` — checklist pre-flight browser hygiene and welcome-state render.
- `send-receive.spec.ts` — basic deterministic send/receive and stream completion.
- `stop-streaming.spec.ts` — skipped harness pilot for stop-button abort behavior.
- `markdown-surfaces.spec.ts` — final-state markdown matrix.
- `regenerate.spec.ts` — regenerate replacement and server-state invariants.
- `mode-routing.spec.ts` — embed/popup/sidebar routing and cross-mode persistence.
- `model-picker.spec.ts` — model picker persistence and backend state.
- `debug-devtools.spec.ts` — chat-debug accessibility plus sidebar coexistence.
- `control-palette.spec.ts` — palette default/collapsed state and route controls.
- `color-scheme.spec.ts` — light/dark persistence and A2UI theme sync.
- `keyboard-accessibility.spec.ts` — keyboard send/newline, Escape, and core button names.
- `error-handling.spec.ts` — network-failure alert and recovery.
- `lifecycle.spec.ts` — reload reconnect, new conversation, welcome suggestion submit.
- `browser-hygiene.spec.ts` — pilot automation for repeated mode-switch hygiene.
- `visual-polish.spec.ts` — responsive overflow checks at checklist widths.
- `a2ui-single-bubble.spec.ts`, `interrupt-approval.spec.ts`, `research-subagent.spec.ts` — capability smoke coverage for GenUI, HITL, and subagents.

## Checklist coverage

The suite mirrors `examples/chat/smoke/CHECKLIST.md` by section. Items that
need live-model semantics or visual judgment stay represented by deterministic
proxies here and by the smoke checklist for manual release validation. The
browser-hygiene coverage has graduated into CI-grade assertions using Chromium
performance metrics and repeated route churn. The remaining skipped pilot is
stop-streaming, which needs the harness to expose an in-flight stream state
reliably enough for deterministic abort assertions.

## Env vars

- `AIMOCK_FIXTURE` — path to the fixture JSON file. Defaults per-test.
- `AIMOCK_MODE` — `replay` (default) or `record`. Tests run only in replay.
