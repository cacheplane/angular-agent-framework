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

## What it does

- **Signal-first agent handle** — `agent()` returns a `LangGraphAgent` whose entire state surface (`messages`, `status`, `isLoading`, `error`, `interrupt`, `toolCalls`, `subagents`, `queue`, `branch`, `history`, and more) is exposed as Angular Signals. No subscriptions, no `async` pipe, no zone.js required.
- **Human-in-the-loop** — `interrupt()` delivers a runtime-neutral interrupt value; `langGraphInterrupts()` exposes the raw LangGraph interrupt list when you need it.
- **Subagent streaming** — `subagents()` + `getSubagent(toolCallId)`, `getSubagentsByType(type)`, `getSubagentsByMessage(msg)`, and `activeSubagents()` surface streaming subgraph state without extra bookkeeping.
- **Time-travel and thread persistence** — `branch()` / `history()` / `experimentalBranchTree()` enable checkpoint navigation; `LangGraphThreadsAdapter` provides SDK-backed thread CRUD so you never have to hand-roll thread management.

## Install

```bash
npm install @threadplane/langgraph @threadplane/chat
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
    }),
  ],
};
```

Then call `agent()` in any component and pass the result to `<chat />`:

```ts
// chat.component.ts
import { Component } from '@angular/core';
import { agent } from '@threadplane/langgraph';
import { ChatComponent } from '@threadplane/chat';

@Component({
  imports: [ChatComponent],
  template: `<chat [agent]="chat" />`,
})
export class ChatComponentHost {
  chat = agent({
    assistantId: 'my-agent',
  });
}
```

> `agent()` must be called within an Angular injection context — a component field initializer or constructor. Calling it in `ngOnInit` or any async context throws `NG0203: inject() must be called from an injection context`.

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
chat.subagents()                       // all SubagentStreamRef entries
chat.activeSubagents()                 // currently streaming subagents
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
    provideAgent({ apiUrl: 'https://your-langgraph-platform.com' }),
    { provide: LANGGRAPH_THREADS_CONFIG, useValue: { apiUrl: 'https://your-langgraph-platform.com' } },
    LangGraphThreadsAdapter,
  ],
};
```

Pair it with the lifecycle helpers to keep your thread list fresh:

```ts
import { refreshOnRunEnd, refreshOnTransition } from '@threadplane/langgraph';

refreshOnRunEnd(chat, () => threadsAdapter.loadThreads());
```

### Citations

`extractCitations(msg)` reads citation metadata from a LangGraph message's `additional_kwargs`, returning a `Citation[]`. It checks `additional_kwargs.citations` first, falling back to `additional_kwargs.sources`.

```ts
import { extractCitations } from '@threadplane/langgraph';

const citations = extractCitations(message);
```

`Citation` is a type from `@threadplane/chat`; `CitationsResolverService` and `provideChat` also live there.

## Reliability

**Testing.** `MockAgentTransport` is a deterministic in-memory transport that replays scripted stream events. The rule is: swap the transport, never mock `agent()` itself. `mockLangGraphAgent(options?)` is a convenience factory for unit tests.

```ts
import { MockAgentTransport, mockLangGraphAgent } from '@threadplane/langgraph';
```

**Runtime-neutral contract.** `LangGraphAgent` implements the `Agent` contract from `@threadplane/chat`. Components that depend only on that contract are portable across adapters (`@threadplane/ag-ui`, future adapters) without modification.

**Release policy.** Patch-only `0.0.x` releases — every change, including breaking ones, increments the patch version until the library reaches `1.0.0`.

**CI.** The "Library — lint / test / build" job runs lint, tests, and build on every pull request.

## Documentation

- [Quickstart](https://threadplane.ai/docs/agent/getting-started/quickstart)
- [`agent()` API reference](https://threadplane.ai/docs/agent/api/agent)
- [Human-in-the-loop / interrupts](https://threadplane.ai/docs/agent/guides/interrupts)
- [Thread persistence](https://threadplane.ai/docs/agent/guides/persistence)
- [Testing with `MockAgentTransport`](https://threadplane.ai/docs/agent/guides/testing)

## License

MIT. See [LICENSE](../../LICENSE).
