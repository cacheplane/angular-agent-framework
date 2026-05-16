# e2e-harness

Internal-only library that wraps [`@copilotkit/aimock`](https://github.com/CopilotKit/aimock) for our cockpit example aimock e2e suite.

NOT published. This lib is tightly coupled to repo-specific orchestration (langgraph + Angular dev server boot) and shouldn't appear in consumer-facing API surfaces.

> The `examples/chat/angular/e2e/` suite currently maintains its own inline harness copy and does not consume this lib. Cockpit per-example e2e suites are the only consumers.

## API

```typescript
// Cockpit consumers import via repo-root-relative path (no published package):
import { createGlobalSetup, sendPromptAndWait } from '../../../../../libs/e2e-harness/src';
```

- `createGlobalSetup(opts)` — returns a Playwright globalSetup function that boots aimock + langgraph + the named Angular dev server.
- `sendPromptAndWait(page, prompt, opts?)` — Playwright helper. Goes to a path (default `/`), sends the prompt, waits for `chat-message[data-role="assistant"][data-streaming="false"]`, returns the bubble locator.

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
