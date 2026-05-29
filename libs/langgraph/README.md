# @threadplane/langgraph

LangChain/LangGraph adapter for Angular. Wraps a LangGraph agent into the runtime-neutral `Agent` contract from `@threadplane/chat` — signal-driven access to messages, status, tool calls, interrupts, subagents, regenerate, and thread history. The Angular equivalent of LangGraph's React `useStream()` hook.

Part of [Threadplane](https://github.com/cacheplane/angular-agent-framework). MIT licensed.

> Talking to a non-LangGraph backend? See [`@threadplane/ag-ui`](https://www.npmjs.com/package/@threadplane/ag-ui) — same API shape, AG-UI protocol underneath.

## Install

```bash
npm install @threadplane/langgraph @threadplane/chat
```

**Peer dependencies:** `@angular/core ^20.0.0 || ^21.0.0`, `@langchain/core ^1.1.0`, `@langchain/langgraph-sdk ^1.7.0`, `rxjs ~7.8.0`

## What it does

- **`provideAgent()`** — wire the LangGraph adapter into Angular DI. Provided at the root injector or at any component subtree (multi-thread UIs work via Angular's hierarchical DI).
- **`injectAgent()`** — retrieve the configured `LangGraphAgent` in any component. No arguments — config flows through DI.
- **Signal-driven runtime** — `messages()`, `status()`, `isLoading()`, `error()`, `interrupt()`, `toolCalls()`, plus actions (`submit`, `stop`, `regenerate`, `reload`).
- **Thread persistence** — pass `threadId: signal(...)` + `onThreadId` in the config to round-trip thread IDs through your own storage (localStorage, URL, etc.).
- **`MockAgentTransport`** — deterministic in-memory transport for tests. Never mock `injectAgent()` itself; swap the transport instead.
- **`extractCitations()`** — populates `Message.citations` from LangGraph message metadata. Reads from `additional_kwargs.citations` (preferred) or `additional_kwargs.sources` (fallback).

## Quick start

```ts
// app.config.ts
import { provideAgent } from '@threadplane/langgraph';

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
import { injectAgent } from '@threadplane/langgraph';
import { ChatComponent } from '@threadplane/chat';

@Component({
  imports: [ChatComponent],
  template: `<chat [agent]="agent" />`,
})
export class ChatComponentHost {
  protected readonly agent = injectAgent();
}
```

> Need a different agent for a specific component subtree (e.g., a sidebar showing a separate conversation)? Re-provide `provideAgent({...})` in that component's `providers: []` array — Angular's hierarchical DI takes care of the rest.

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

// Message.citations auto-populates in @threadplane/chat via extractCitations()
```

## Documentation

- [Quickstart](https://threadplane.ai/docs/langgraph/getting-started/quickstart)
- [`injectAgent()` API reference](https://threadplane.ai/docs/langgraph/api/inject-agent)
- [`provideAgent()` API reference](https://threadplane.ai/docs/langgraph/api/provide-agent)
- [Human-in-the-loop / interrupts](https://threadplane.ai/docs/langgraph/guides/interrupts)
- [Thread persistence](https://threadplane.ai/docs/langgraph/guides/persistence)
- [Testing with `MockAgentTransport`](https://threadplane.ai/docs/langgraph/guides/testing)
- [Choosing an adapter (LangGraph vs AG-UI)](https://threadplane.ai/docs/choosing-an-adapter)

## License

MIT — free for any use. See [LICENSE](../../LICENSE).
