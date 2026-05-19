# e2e-harness

Internal-only library that wraps [`@copilotkit/aimock`](https://github.com/CopilotKit/aimock) for our cockpit example aimock e2e suite.

NOT published. This lib is tightly coupled to repo-specific orchestration (langgraph + Angular dev server boot) and shouldn't appear in consumer-facing API surfaces.

> The `examples/chat/angular/e2e/` suite currently maintains its own inline harness copy and does not consume this lib. Cockpit per-example e2e suites are the only consumers.

## API

```typescript
// Cockpit consumers import via repo-root-relative path (no published package):
import { createGlobalSetup, submitAndWaitForResponse } from '../../../../../libs/e2e-harness/src';
```

- `createGlobalSetup(opts)` — returns a Playwright globalSetup function that boots aimock + langgraph + the named Angular dev server.
- `submitAndWaitForResponse(page, prompt, opts?)` — Playwright helper. Goes to a path (default `/`), sends the prompt, waits for `chat-message[data-role="assistant"][data-streaming="false"]` to attach, returns the bubble locator. Preferred over polling the "Stop generating" button for aimock-backed e2es where SSE chunks arrive in <100ms.
- `sendPromptAndWaitForInterrupt(page, prompt, opts?)` — Playwright helper for interrupt-flow specs. Sends the prompt and waits for `chat-interrupt-panel` to appear rather than waiting for the agent to go fully idle.
- `clickInterruptActionAndWaitFinal(page, label)` — Clicks an action button on the visible interrupt panel and waits for the resume continuation to finalize.

## Per-example consumer shape

```
cockpit/<product>/<example>/angular/e2e/
├── playwright.config.ts         // imports createGlobalSetup, passes app-specific opts
├── global-setup-impl.ts         // re-exports createGlobalSetup({...}) as default
├── fixtures/<example>.json
├── scripts/record-<example>.py
└── <example>.spec.ts
```

See `cockpit/langgraph/streaming/angular/e2e/` for a working example.
