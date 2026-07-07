# @threadplane/langgraph

Adapter that wraps a LangGraph agent into the runtime-neutral `Agent` contract from `@threadplane/chat`. The Angular equivalent of LangGraph's React `useStream()` hook — signal-driven access to messages, status, tool calls, interrupts, subagents, branch history, and thread persistence.

<p align="center">
  <a href="https://www.npmjs.com/package/@threadplane/langgraph">
    <img alt="npm version" src="https://img.shields.io/npm/v/@threadplane%2Flanggraph?color=6C8EFF&labelColor=080B14&style=flat-square" />
  </a>
  <a href="https://angular.dev">
    <img alt="Angular 20+" src="https://img.shields.io/badge/Angular-20%2B%20%7C%2021-6C8EFF?labelColor=080B14&style=flat-square" />
  </a>
  <a href="https://opensource.org/licenses/MIT">
    <img alt="MIT" src="https://img.shields.io/badge/License-MIT-6C8EFF?labelColor=080B14&style=flat-square" />
  </a>
</p>

> Talking to a non-LangGraph backend? See [`@threadplane/ag-ui`](https://www.npmjs.com/package/@threadplane/ag-ui) — same API shape, AG-UI protocol underneath.

## What it does

- **`provideAgent()`** — wire the LangGraph adapter into Angular DI. Provided at the root injector or at any component subtree (multi-thread UIs work via Angular's hierarchical DI).
- **`injectAgent()`** — retrieve the configured `LangGraphAgent` in any component. Returns a `LangGraphAgent` whose entire state surface (`messages`, `status`, `isLoading`, `error`, `interrupt`, `toolCalls`, `subagents`, `queue`, `branch`, `history`, and more) is exposed as Angular Signals. No subscriptions, no `async` pipe, no zone.js required.
- **Human-in-the-loop** — `interrupt()` delivers a runtime-neutral interrupt value; `langGraphInterrupts()` exposes the raw LangGraph interrupt list when you need it.
- **Subagent streaming** — `subagents()` + `getSubagent(toolCallId)`, `getSubagentsByType(type)`, `getSubagentsByMessage(msg)`, and `activeSubagents()` surface streaming subgraph state without extra bookkeeping.
- **Time-travel and thread persistence** — `branch()` / `history()` / `experimentalBranchTree()` enable checkpoint navigation; `LangGraphThreadsAdapter` provides SDK-backed thread CRUD so you never have to hand-roll thread management.

## Install

```bash
npm install @threadplane/langgraph @threadplane/chat @langchain/core @langchain/langgraph-sdk
```

**Peer dependencies:**

```
@threadplane/chat          *
@angular/core              ^20.0.0 || ^21.0.0
@langchain/core            ^1.1.33
@langchain/langgraph-sdk   ^1.7.4
rxjs                       ~7.8.0
```

## Quick start

Configure the LangGraph endpoint once in `app.config.ts`:

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

Then call `injectAgent()` in any component and pass the result to `<chat />`:

```ts
// chat.component.ts
import { Component } from '@angular/core';
import { injectAgent } from '@threadplane/langgraph';
import { ChatComponent } from '@threadplane/chat';

@Component({
  imports: [ChatComponent],
  template: `<chat [agent]="chat" />`,
})
export class ChatComponentHost {
  protected readonly chat = injectAgent();
}
```

> `injectAgent()` must be called within an Angular injection context — a component field initializer or constructor. Calling it in `ngOnInit` or any async context throws `NG0203: inject() must be called from an injection context`.

> Need a different agent for a specific component subtree (e.g., a sidebar showing a separate conversation)? Re-provide `provideAgent({...})` in that component's `providers: []` array — Angular's hierarchical DI takes care of the rest.

## Capabilities

### Messages, status, and errors

| Signal | Type | Description |
|---|---|---|
| `messages()` | `Message[]` | Accumulated chat messages from the stream |
| `status()` | `'idle' \| 'running' \| 'error'` | Runtime-neutral run status |
| `isLoading()` | `boolean` | `true` while a run is streaming |
| `error()` | `unknown \| null` | Last error, if any |

### Human-in-the-loop (interrupts)

```ts
const pending = chat.interrupt();       // runtime-neutral interrupt value
const raw = chat.langGraphInterrupts(); // raw LangGraph Interrupt[]
```

Resume by calling `chat.submit(response)`.

### Tool calls

`toolCalls()` is a Signal of all tool call entries observed in the current run, updated incrementally as the stream progresses.

### Subagents

```ts
chat.subagents()                       // Signal<Map<string, Subagent>> of all subagents
chat.activeSubagents()                 // currently streaming subagents (SubagentStreamRef[])
chat.getSubagent(toolCallId)           // look up by tool call ID
chat.getSubagentsByType(type)          // filter by subagent type
chat.getSubagentsByMessage(msg)        // filter by parent message
```

### Queue

`queue()` exposes pending run entries when the agent is configured with a multitask strategy that queues concurrent submissions.

### Branch, history, and time-travel

```ts
chat.branch()                   // current branch identifier Signal
chat.setBranch(b)               // switch to a checkpoint branch
chat.history()                  // runtime-neutral history entries
chat.langGraphHistory()         // raw LangGraph ThreadState[]
chat.experimentalBranchTree()   // full branching tree for time-travel UI
```

### Actions

```ts
chat.submit(input, opts?)                   // send a new message
chat.stop()                                 // cancel the active run
chat.regenerate(assistantMessageIndex)      // re-run from a prior assistant turn
chat.reload()                               // re-run the last submission
chat.switchThread(threadId)                 // load a different thread
chat.joinStream(runId, lastEventId?)        // reconnect to an in-flight run
```

### Thread persistence

`LangGraphThreadsAdapter` is a drop-in, SDK-backed thread store. Provide it alongside the agent config:

```ts
import { provideAgent, LangGraphThreadsAdapter, LANGGRAPH_THREADS_CONFIG } from '@threadplane/langgraph';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAgent({ apiUrl: 'https://your-langgraph-platform.com', assistantId: 'my-agent' }),
    { provide: LANGGRAPH_THREADS_CONFIG, useValue: { apiUrl: 'https://your-langgraph-platform.com' } },
    LangGraphThreadsAdapter,
  ],
};
```

Pair it with the lifecycle helpers to keep your thread list fresh:

```ts
import { refreshOnRunEnd, refreshOnTransition } from '@threadplane/langgraph';

refreshOnRunEnd(chat, () => threadsAdapter.refresh());
```

### Citations

`extractCitations(msg)` reads citation metadata from a LangGraph message's `additional_kwargs`, returning `Citation[] | undefined` (`undefined` when no citation metadata is present). It checks `additional_kwargs.citations` first, falling back to `additional_kwargs.sources`.

```ts
import { extractCitations } from '@threadplane/langgraph';

const citations = extractCitations(message);
```

`Citation` is a type from `@threadplane/chat`; `CitationsResolverService` and `provideChat` also live there.

## Testing

```ts
// Fake backend — streams canned tokens, no server:
import { provideFakeAgent } from '@threadplane/langgraph';
providers: [provideFakeAgent({ tokens: ['Hello', ' world'] })];
```

For component/unit tests, use the writable-signal mock `mockLangGraphAgent()`
(it extends the neutral `mockAgent` from `@threadplane/chat`). See
[Choosing an adapter → Testing](https://threadplane.ai/docs/choosing-an-adapter#testing).

Need to hand-script exact wire events (tool calls, interrupts, multi-batch
lifecycles)? `MockAgentTransport` is the advanced escape hatch — swap the
transport, never mock `injectAgent()` itself.

## Reliability

**Runtime-neutral contract.** `LangGraphAgent` implements the `Agent` contract from `@threadplane/chat`. Components that depend only on that contract are portable across adapters (`@threadplane/ag-ui`, future adapters) without modification.

**Release policy.** Patch-only `0.0.x` releases — every change, including breaking ones, increments the patch version until the library reaches `1.0.0`.

**CI.** The "Library — lint / test / build" job runs lint, tests, and build on every pull request.

## Documentation

- [Quickstart](https://threadplane.ai/docs/langgraph/getting-started/quickstart)
- [`injectAgent()` API reference](https://threadplane.ai/docs/langgraph/api/inject-agent)
- [`provideAgent()` API reference](https://threadplane.ai/docs/langgraph/api/provide-agent)
- [Human-in-the-loop / interrupts](https://threadplane.ai/docs/langgraph/guides/interrupts)
- [Thread persistence](https://threadplane.ai/docs/langgraph/guides/persistence)
- [Testing with `MockAgentTransport`](https://threadplane.ai/docs/langgraph/guides/testing)
- [Choosing an adapter (LangGraph vs AG-UI)](https://threadplane.ai/docs/choosing-an-adapter)

## License

MIT. See [LICENSE](../../LICENSE).
