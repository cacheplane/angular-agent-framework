# @ngaf-internal/aimock-harness

Internal-only library that wraps [`@copilotkit/aimock`](https://github.com/CopilotKit/aimock) for our cockpit example aimock e2e suite.

NOT published. The `@ngaf-internal/*` namespace is reserved for internal libraries that are tightly coupled to repo-specific orchestration (langgraph + Angular dev server boot) and shouldn't appear in consumer-facing API surfaces.

## API

```typescript
import { createGlobalSetup, sendPromptAndWait } from '@ngaf-internal/aimock-harness';
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
