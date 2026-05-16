# @ngaf/langgraph

Adapter that wraps a LangGraph agent into the runtime-neutral `Agent` contract from `@ngaf/chat`. The Angular equivalent of LangGraph's React `useStream()` hook — signal-driven access to messages, status, tool calls, interrupts, subagents, regenerate, and thread history.

Part of [Agent UI for Angular](https://github.com/cacheplane/angular-agent-framework). MIT licensed.

## Install

```bash
npm install @ngaf/langgraph @ngaf/chat
```

**Peer dependencies:** `@angular/core ^20.0.0 || ^21.0.0`, `@langchain/core ^1.1.0`, `@langchain/langgraph-sdk ^1.7.0`, `rxjs ~7.8.0`

## What it does

- **`agent()`** — Angular Signal-based handle to a LangGraph streaming run. Returns `messages()`, `status()`, `isLoading()`, `error()`, `interrupt()`, `toolCalls()`, plus actions (`submit`, `stop`, `regenerate`, `reload`).
- **`provideAgent()`** — configure the LangGraph endpoint once in `app.config.ts`. Per-call overrides are accepted by `agent()` itself.
- **Thread persistence** — pass `threadId: signal(...)` + `onThreadId` to round-trip thread IDs through your own storage (localStorage, URL, etc.).
- **`MockAgentTransport`** — deterministic in-memory transport for tests. Never mock `agent()` itself; swap the transport instead.
- **`extractCitations()`** — populates `Message.citations` from LangGraph message metadata. Reads from `additional_kwargs.citations` (preferred) or `additional_kwargs.sources` (fallback).

## Quick start

```ts
// app.config.ts
import { provideAgent } from '@ngaf/langgraph';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAgent({
      apiUrl: 'https://your-langgraph-platform.com',
      assistantId: 'my-agent',
    }),
  ],
};
```

```ts
// chat.component.ts
import { Component } from '@angular/core';
import { agent } from '@ngaf/langgraph';
import { ChatComponent } from '@ngaf/chat';

@Component({
  imports: [ChatComponent],
  template: `<chat [agent]="chat" />`,
})
export class ChatComponentHost {
  chat = agent({ assistantId: 'my-agent' });
}
```

> `agent()` must be called within an Angular injection context (component field initializer or constructor). Calling it in `ngOnInit` or any async context throws `NG0203: inject() must be called from an injection context`.

## Citations example

```ts
// In your LangGraph node:
const response = await llm.invoke([...]);

return new AIMessage({
  content: response.content,
  additional_kwargs: {
    citations: [
      {
        id: 'doc-1',
        index: 1,
        title: 'Example Article',
        url: 'https://example.com/article',
        snippet: 'Relevant excerpt...',
      },
    ],
  },
});

// Message.citations auto-populates in @ngaf/chat via extractCitations()
```

## Documentation

- [Quickstart](https://cacheplane.ai/docs/agent/getting-started/quickstart)
- [`agent()` API reference](https://cacheplane.ai/docs/agent/api/agent)
- [Human-in-the-loop / interrupts](https://cacheplane.ai/docs/agent/guides/interrupts)
- [Thread persistence](https://cacheplane.ai/docs/agent/guides/persistence)
- [Testing with `MockAgentTransport`](https://cacheplane.ai/docs/agent/guides/testing)

## License

MIT — free for any use. See [LICENSE](../../LICENSE).
