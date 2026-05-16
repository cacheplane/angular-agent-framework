<p align="center">
  <img
    src="https://cacheplane.ai/assets/hero.svg"
    alt="Agent UI for Angular — agent UI primitives for Angular"
    width="100%"
  />
</p>

<p align="center">
  <em>Agent UI primitives and LangGraph streaming adapters for Angular</em>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@ngaf/langgraph">
    <img alt="npm version" src="https://img.shields.io/npm/v/@ngaf%2Flanggraph?color=6C8EFF&labelColor=080B14&style=flat-square" />
  </a>
  <a href="./LICENSE">
    <img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-6C8EFF?labelColor=080B14&style=flat-square" />
  </a>
  <a href="https://angular.dev">
    <img alt="Angular 20+" src="https://img.shields.io/badge/Angular-20%2B-6C8EFF?labelColor=080B14&style=flat-square" />
  </a>
  <a href="https://langchain-ai.github.io/langgraph/">
    <img alt="LangGraph" src="https://img.shields.io/badge/LangGraph-SDK-6C8EFF?labelColor=080B14&style=flat-square" />
  </a>
</p>

---

`agent()` is the Angular equivalent of LangGraph's React `useStream()` hook, projected into a runtime-neutral `Agent` contract consumed by `@ngaf/chat`. Drop it into any Angular 20+ component, point it at your LangGraph Platform endpoint, and get signal-driven access to messages, status, tool calls, interrupts, subagents, regenerate, and thread history.

---

## Install

```bash
npm install @ngaf/langgraph @ngaf/chat
```

**Peer dependencies:** `@angular/core ^20.0.0 || ^21.0.0`, `@langchain/core ^1.1.0`, `@langchain/langgraph-sdk ^1.7.0`, `rxjs ~7.8.0`

---

## 30-Second Example

```typescript
import { Component } from '@angular/core';
import { ChatComponent as NgafChatComponent } from '@ngaf/chat';
import { agent } from '@ngaf/langgraph';

@Component({
  selector: 'app-support-chat',
  imports: [NgafChatComponent],
  template: `
    <chat [agent]="chat" />

    @if (chat.isLoading()) {
      <span>Streaming…</span>
    }

    <button (click)="send()">Send</button>
  `,
})
export class SupportChatComponent {
  chat = agent({
    apiUrl: 'https://your-langgraph-platform.com',
    assistantId: 'my-agent',
  });

  send() {
    void this.chat.submit({ message: 'Hello' });
  }
}
```

That's it. `chat.messages()` and `chat.status()` are Angular Signals. Bind them directly in your template — no subscriptions, no `async` pipe, no zone.js required.

---

## Feature Comparison

| Feature | `agent()` (Angular) | `useStream()` (React) |
|---|---|---|
| Streaming state as reactive primitives | Angular Signals | React state |
| Messages signal | `messages()` | `messages` |
| Loading state | `isLoading()` | `isLoading` |
| Error state | `error()` | — |
| Runtime-neutral status | `status()` — `'idle' \| 'running' \| 'error'` | partial |
| Interrupt / human-in-the-loop | `interrupt()` / `interrupts()` | `interrupt` / `interrupts` |
| Tool call progress | `toolCalls()` | `toolCalls` |
| Tool calls with results | `toolCalls()` | `toolCalls` |
| Branch / history | `branch()` / `history()` / `experimentalBranchTree()` | `branch` / `history` / `experimental_branchTree` |
| Pending run queue | `queue()` | `queue` |
| Subagent streaming and lookup helpers | `subagents()` / `getSubagent()` | `subagents` / helper methods |
| Reactive thread switching | `Signal<string \| null>` input | prop |
| Submit | `submit(values, opts?)` | `submit(values, opts?)` |
| Stop | `stop()` | `stop()` |
| Regenerate response | `regenerate(assistantMessageIndex)` | — |
| Reload last submission | `reload()` | — |
| Custom transport (for testing) | `MockAgentTransport` | mock fetch |
| Angular `ResourceRef<T>` compatibility | Full duck-type parity | N/A |
| Angular 20+ Signals API | Native | N/A |
| SSR / Server Components | Client-side only | React Server Components (React) |

---

## Architecture

<p align="center">
  <img
    src="https://cacheplane.ai/assets/arch-diagram.svg"
    alt="Agent UI for Angular architecture: Angular Component → agent() → StreamManager Bridge → LangGraph Platform, with signals returned reactively"
    width="100%"
  />
</p>

`agent()` creates its internal `BehaviorSubject`s at injection-context time — once, at component construction. The `StreamManager` bridge (the only file that touches `@langchain/langgraph-sdk` internals) pushes stream events into those subjects. `toSignal()` converts each subject to an Angular Signal, also at construction time. Dynamic actions (`submit`, `stop`, `switchThread`) push into the existing subjects — no new subjects are ever created after construction. This architecture is required because `toSignal()` must be called in an injection context and cannot be called again later.

---

## Documentation

- [Agent Quickstart](https://cacheplane.ai/docs/agent/getting-started/quickstart)
- [agent() API](https://cacheplane.ai/docs/agent/api/agent)
- [Chat Introduction](https://cacheplane.ai/docs/chat/getting-started/introduction)
- [Human-in-the-Loop / Interrupts](https://cacheplane.ai/docs/agent/guides/interrupts)
- [Subgraph and Subagent Streaming](https://cacheplane.ai/docs/agent/guides/subgraphs)

---

## License

**MIT** — free for any use. See [`LICENSE`](./LICENSE).

`@ngaf/langgraph` and all libraries in this repository are released under the [MIT License](./LICENSE). You are free to use, modify, and distribute them in both commercial and noncommercial projects without restriction.
