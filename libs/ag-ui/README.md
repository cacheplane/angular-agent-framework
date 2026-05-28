# @threadplane/ag-ui

Adapter that wraps an [AG-UI](https://github.com/ag-ui-protocol/ag-ui) `AbstractAgent` into the runtime-neutral `Agent` contract from `@threadplane/chat`. Works with any AG-UI-compatible backend.

<p align="center">
  <a href="https://www.npmjs.com/package/@threadplane%2Fag-ui">
    <img alt="npm version" src="https://img.shields.io/npm/v/@threadplane%2Fag-ui?color=6C8EFF&labelColor=080B14&style=flat-square" />
  </a>
  <a href="https://angular.dev">
    <img alt="Angular 20+" src="https://img.shields.io/badge/Angular-20%2B%20%7C%2021-6C8EFF?labelColor=080B14&style=flat-square" />
  </a>
  <a href="../../LICENSE">
    <img alt="MIT" src="https://img.shields.io/badge/License-MIT-6C8EFF?labelColor=080B14&style=flat-square" />
  </a>
</p>

Part of [Threadplane](https://github.com/cacheplane/angular-agent-framework).

---

## What it does

- Bridges any AG-UI-compatible backend into the Threadplane chat surface via `toAgent()`.
- Supports: LangGraph, CrewAI, Mastra, Microsoft Agent Framework, AG2, Pydantic AI, AWS Strands, CopilotKit runtime.
- Exposes messages, status, tool calls, interrupts, subagents, citations, and history as Angular Signals — coverage depends on what the AG-UI backend emits.
- Ships `FakeAgent` and `provideFakeAgUiAgent` test doubles for unit testing without a live backend.

---

## Install

```bash
npm install @threadplane/ag-ui @threadplane/chat @ag-ui/client
```

**Peer dependencies:** `@threadplane/chat: *`, `@angular/core: ^20.0.0 || ^21.0.0`, `@ag-ui/client: *`, `rxjs: ~7.8.0`

---

## Quick start

Register the agent in your `ApplicationConfig`, then inject it into a component and bind it to `<chat>`.

```ts
// app.config.ts
import { provideAgUiAgent } from '@threadplane/ag-ui';

export const appConfig: ApplicationConfig = {
  providers: [provideAgUiAgent({ url: 'https://your.agent.endpoint' })],
};
```

```ts
// app.component.ts
import { Component, inject } from '@angular/core';
import { ChatComponent } from '@threadplane/chat';
import { injectAgUiAgent } from '@threadplane/ag-ui';

@Component({
  imports: [ChatComponent],
  template: `<chat [agent]="agent" />`,
})
export class AppComponent {
  protected readonly agent = injectAgUiAgent();
}
```

You can also inject the token directly with `inject(AG_UI_AGENT)` if you need it alongside other providers.

---

## Capabilities

`toAgent()` translates AG-UI events into Angular Signals on the runtime-neutral `Agent` contract:

| Signal | Description |
|---|---|
| `messages()` | Chat message history |
| `status()` | `'idle' \| 'running' \| 'error'` |
| `isLoading()` | True while a run is active |
| `toolCalls()` | In-progress and completed tool calls |
| `error()` | Last run error, if any |
| `state()` | Raw AG-UI state snapshot |

Which capabilities populate depends on the events the AG-UI backend emits. `submit()`, `stop()`, and `regenerate()` are supported.

### Citations

`bridgeCitationsState(thread, messages)` populates `Message.citations` from AG-UI STATE_DELTA events. Citations are keyed by message ID at the JSON Pointer path `/citations/{messageId}` in the agent state.

Example state shape:

```json
{
  "state": {
    "citations": {
      "msg-123": [
        {
          "id": "src1",
          "index": 1,
          "title": "Example Source",
          "url": "https://example.com",
          "snippet": "Relevant excerpt from the source..."
        }
      ]
    }
  }
}
```

Each citation supports `id`, `index`, `title`, `url`, `snippet`, and custom `extra` fields. The message ID key matches the corresponding message in the chat history.

### Testing

`FakeAgent` is a test-only `AbstractAgent` implementation. `provideFakeAgUiAgent(config?)` registers it in the Angular injector so unit tests run without a live AG-UI backend.

---

## Reliability

`@threadplane/ag-ui` shares the same runtime-neutral `Agent` contract as `@threadplane/langgraph`, making it interchangeable at the `<chat [agent]>` binding. The library follows a patch-only `0.0.x` release policy. The CI job "Library — lint / test / build" runs lint, test, and build on every pull request.

---

## Documentation

- [Quickstart](https://threadplane.ai/docs/agent/getting-started/quickstart)
- [AG-UI adapter guide](https://threadplane.ai/docs/chat/guides/writing-an-adapter)
- [AG-UI protocol](https://github.com/ag-ui-protocol/ag-ui)

---

## License

MIT. See [LICENSE](../../LICENSE).
