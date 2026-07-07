# @threadplane/ag-ui

Adapter that wraps an [AG-UI](https://github.com/ag-ui-protocol/ag-ui) `AbstractAgent` into the runtime-neutral `Agent` contract from `@threadplane/chat`. Works with any AG-UI-compatible backend.

<p align="center">
  <a href="https://www.npmjs.com/package/@threadplane/ag-ui">
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

> Talking to LangGraph Platform directly? See [`@threadplane/langgraph`](https://www.npmjs.com/package/@threadplane/langgraph) — same API shape, LangGraph SDK underneath.

---

## What it does

- Bridges any AG-UI-compatible backend into the Threadplane chat surface via `toAgent()`.
- Supports: LangGraph, CrewAI, Mastra, Microsoft Agent Framework, AG2, Pydantic AI, AWS Strands, CopilotKit runtime.
- Exposes messages, status, tool calls, and raw AG-UI state as Angular Signals, plus `submit()`/`stop()`/`regenerate()` actions — coverage depends on what the AG-UI backend emits.
- Ships `FakeAgent` and `provideFakeAgent` test doubles for unit testing without a live backend.

---

## Install

```bash
npm install @threadplane/ag-ui @threadplane/chat @ag-ui/client @ag-ui/core marked
```

**Peer dependencies:** `@threadplane/chat: *`, `@angular/core: ^20.0.0 || ^21.0.0`, `@ag-ui/client: *`, `@ag-ui/core: *`, `rxjs: ~7.8.0`

`marked` is the required markdown parser peer used by `@threadplane/chat` when you render assistant messages through `<chat>`.

---

## Quick start

Register the agent in your `ApplicationConfig`, then inject it into a component and bind it to `<chat>`.

```ts
// app.config.ts
import { provideAgent } from '@threadplane/ag-ui';

export const appConfig: ApplicationConfig = {
  providers: [provideAgent({ url: 'https://your.agent.endpoint' })],
};
```

```ts
// app.component.ts
import { Component } from '@angular/core';
import { ChatComponent } from '@threadplane/chat';
import { injectAgent } from '@threadplane/ag-ui';

@Component({
  imports: [ChatComponent],
  template: `<chat [agent]="agent" />`,
})
export class AppComponent {
  protected readonly agent = injectAgent();
}
```

Both `@threadplane/langgraph` and `@threadplane/ag-ui` expose `provideAgent`/`injectAgent` with the same shape — consumer code is identical regardless of which adapter is wired in.

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
| `customEvents()` | Non-`on_interrupt` `CUSTOM` events for live a2ui and app-specific side effects |
| `subagents()` | `ACTIVITY_*` entries with `activityType: 'subagent'`, projected to the neutral subagent contract |
| `clientTools` | Browser client-tool catalog, pending calls, and result resolution used by `<chat [clientTools]>` |

Which capabilities populate depends on the events the AG-UI backend emits. `submit()`, `stop()`, and `regenerate()` are supported.

### Interrupts (human-in-the-loop)

`agent.interrupt()` is a `Signal<AgentInterrupt | undefined>` populated from AG-UI `CUSTOM` events with `name: 'on_interrupt'`. The reducer JSON-parses string-serialized `value` payloads automatically (e.g. `ag-ui-langgraph` ships interrupts via `dump_json_safe`), so consumers see the structured object directly.

Resume with `agent.submit({ resume })` — this calls `runAgent({ forwardedProps: { command: { resume } } })`, and the server reads `forwarded_props.command.resume` (the `ag-ui-langgraph` convention).

Pair with `<chat-approval-card>` from `@threadplane/chat` for the approve/reject/edit UX:

```ts
import { Component } from '@angular/core';
import { ChatComponent, ChatApprovalCardComponent } from '@threadplane/chat';
import { injectAgent } from '@threadplane/ag-ui';

@Component({
  imports: [ChatComponent, ChatApprovalCardComponent],
  template: `
    <chat [agent]="agent" />
    <chat-approval-card
      [agent]="agent"
      matchKind="refund_approval"
      (action)="onAction($event)" />
  `,
})
export class App {
  protected readonly agent = injectAgent();
  onAction(a: 'approve' | 'cancel') {
    void this.agent.submit({ resume: { approved: a === 'approve' } });
  }
}
```

See `cockpit/ag-ui/interrupts` for a complete working example, and the [LangGraph interrupts guide](https://threadplane.ai/docs/langgraph/guides/interrupts) for the broader HITL contract — the same `Agent.interrupt` / `submit({ resume })` API works across both adapters.

### Citations

`bridgeCitationsState(thread, messages)` populates `Message.citations` from AG-UI state. Citations live under the `citations` key of the agent state, keyed by message ID (`state.citations[messageId]`).

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

---

## Testing

```ts
// Fake backend — streams canned tokens, no server:
import { provideFakeAgent } from '@threadplane/ag-ui';
providers: [provideFakeAgent({ tokens: ['Hello', ' world'] })];
```

For component/unit tests, use the neutral writable-signal mock `mockAgent()`
from `@threadplane/chat` — the ag-ui agent _is_ the neutral `Agent` contract,
so there is no adapter-specific mock. See
[Choosing an adapter → Testing](https://threadplane.ai/docs/choosing-an-adapter#testing).

---

## Reliability

`@threadplane/ag-ui` shares the same runtime-neutral `Agent` contract as `@threadplane/langgraph`, making it interchangeable at the `<chat [agent]>` binding. The library follows a patch-only `0.0.x` release policy. The CI job "Library — lint / test / build" runs lint, test, and build on every pull request.

---

## Documentation

- [Quickstart](https://threadplane.ai/docs/ag-ui/getting-started/quickstart)
- [AG-UI adapter guide](https://threadplane.ai/docs/chat/guides/writing-an-adapter)
- [AG-UI protocol](https://github.com/ag-ui-protocol/ag-ui)
- [Choosing an adapter (LangGraph vs AG-UI)](https://threadplane.ai/docs/choosing-an-adapter)

---

## License

MIT. See [LICENSE](../../LICENSE).
