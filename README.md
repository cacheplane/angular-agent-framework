<p align="center">
  <img
    src="https://cacheplane.ai/assets/hero.svg"
    alt="Angular Agent Framework — The Angular Agent Framework for LangChain"
    width="100%"
  />
</p>

<p align="center">
  <em>The Angular Agent Framework for LangChain</em>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@cacheplane/langgraph">
    <img alt="npm version" src="https://img.shields.io/npm/v/@cacheplane%2Fangular?color=6C8EFF&labelColor=080B14&style=flat-square" />
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

`agent()` is the Angular equivalent of LangGraph's React `useStream()` hook — a full-parity implementation built on Angular Signals and the Angular Resource API. It gives enterprise Angular teams the same production-grade streaming primitives available to React developers on LangChain, without compromises or workarounds. Drop it into any Angular 20+ component, point it at your LangGraph Platform endpoint, and get reactive, signal-driven access to streaming state, messages, tool calls, interrupts, and thread history.

---

## Install

```bash
npm install @cacheplane/langgraph
```

**Peer dependencies:** `@angular/core ^20.0.0 || ^21.0.0`, `@langchain/core ^1.1.0`, `@langchain/langgraph-sdk ^1.7.0`, `rxjs ~7.8.0`

---

## 30-Second Example

```typescript
import { Component } from '@angular/core';
import { agent } from '@cacheplane/langgraph';
import type { BaseMessage } from '@langchain/core/messages';

@Component({
  selector: 'app-chat',
  template: `
    <ul>
      @for (msg of chat.messages(); track $index) {
        <li>{{ msg.content }}</li>
      }
    </ul>

    @if (chat.isLoading()) {
      <span>Streaming…</span>
    }

    <button (click)="send()">Send</button>
  `,
})
export class ChatComponent {
  chat = agent<{ messages: BaseMessage[] }>({
    apiUrl: 'https://your-langgraph-platform.com',
    assistantId: 'my-agent',
    messagesKey: 'messages',
  });

  send() {
    this.chat.submit({ messages: [{ role: 'human', content: 'Hello' }] });
  }
}
```

That's it. `chat.messages()` is an Angular Signal. Bind it directly in your template — no subscriptions, no `async` pipe, no zone.js required.

---

## Feature Comparison

| Feature | `agent()` (Angular) | `useStream()` (React) |
|---|---|---|
| Streaming state as reactive primitives | Angular Signals | React state |
| Messages signal | `messages()` | `messages` |
| Loading state | `isLoading()` | `isLoading` |
| Error state | `error()` | — |
| Resource status (idle/loading/resolved/error) | `status()` — full `ResourceStatus` | partial |
| Interrupt / human-in-the-loop | `interrupt()` / `interrupts()` | `interrupt` / `interrupts` |
| Tool call progress | `toolProgress()` | `toolProgress` |
| Tool calls with results | `toolCalls()` | `toolCalls` |
| Branch / history | `branch()` / `history()` | `branch` / `history` |
| Subagent streaming | `subagents()` / `activeSubagents()` | `subagents` / `activeSubagents` |
| Reactive thread switching | `Signal<string \| null>` input | prop |
| Submit | `submit(values, opts?)` | `submit(values, opts?)` |
| Stop | `stop()` | `stop()` |
| Reload last submission | `reload()` | — |
| Custom transport (for testing) | `MockStreamTransport` | mock fetch |
| Angular `ResourceRef<T>` compatibility | Full duck-type parity | N/A |
| Angular 20+ Signals API | Native | N/A |
| SSR / Server Components | Client-side only | React Server Components (React) |

---

## Architecture

<p align="center">
  <img
    src="https://cacheplane.ai/assets/arch-diagram.svg"
    alt="Angular Agent Framework architecture: Angular Component → agent() → StreamManager Bridge → LangGraph Platform, with signals returned reactively"
    width="100%"
  />
</p>

`agent()` creates 12 `BehaviorSubject`s at injection-context time — once, at component construction. The `StreamManager` bridge (the only file that touches `@langchain/langgraph-sdk` internals) pushes stream events into those subjects. `toSignal()` converts each subject to an Angular Signal, also at construction time. Dynamic actions (`submit`, `stop`, `switchThread`) push into the existing subjects — no new subjects are ever created after construction. This architecture is required because `toSignal()` must be called in an injection context and cannot be called again later.

---

## Documentation

- [Getting Started](https://cacheplane.ai/docs/getting-started)
- [API Reference](https://cacheplane.ai/api-reference)
- [Testing with MockStreamTransport](https://cacheplane.ai/docs/testing)
- [Human-in-the-Loop / Interrupts](https://cacheplane.ai/docs/interrupts)
- [Subagent Streaming](https://cacheplane.ai/docs/subagents)

---

## License

**MIT** — free for any use. See [`LICENSE`](./LICENSE).

`@cacheplane/langgraph` and all libraries in this repository are released under the [MIT License](./LICENSE). You are free to use, modify, and distribute them in both commercial and noncommercial projects without restriction.
