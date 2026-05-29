<p align="center">
  <img
    src="https://threadplane.ai/assets/hero.svg"
    alt="Threadplane — agent UI primitives for Angular"
    width="100%"
  />
</p>

<p align="center">
  <em>Threadplane — Production-ready chat, threads, and generative UI for AI agents.</em>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@threadplane/langgraph">
    <img alt="npm version" src="https://img.shields.io/npm/v/@threadplane%2Flanggraph?color=6C8EFF&labelColor=080B14&style=flat-square" />
  </a>
  <a href="https://angular.dev">
    <img alt="Angular 20+" src="https://img.shields.io/badge/Angular-20%2B-6C8EFF?labelColor=080B14&style=flat-square" />
  </a>
  <a href="https://langchain-ai.github.io/langgraph/">
    <img alt="LangGraph" src="https://img.shields.io/badge/LangGraph-SDK-6C8EFF?labelColor=080B14&style=flat-square" />
  </a>
</p>

---

Threadplane is a production-ready agent UI framework for Angular. Use `@threadplane/chat` for chat surfaces, `@threadplane/langgraph` for LangGraph-backed agents, `@threadplane/ag-ui` for AG-UI event streams, and `@threadplane/render` for generative UI that stays inside your Angular design system.

When you are building on LangGraph, `injectAgent()` is the Angular equivalent of LangGraph's React `useStream()` hook, projected into a runtime-neutral `Agent` contract consumed by `@threadplane/chat`. Configure it once with `provideAgent({...})`, inject it into any Angular 20+ component, and get signal-driven access to messages, status, tool calls, interrupts, subagents, regenerate, and thread history.

---

## Install

```bash
npm install @threadplane/langgraph @threadplane/chat
```

**Peer dependencies:** `@angular/core ^20.0.0 || ^21.0.0`, `@langchain/core ^1.1.0`, `@langchain/langgraph-sdk ^1.7.0`, `rxjs ~7.8.0`

---

## 30-Second Example

```typescript
// app.config.ts — wire the adapter once
import { provideAgent } from '@threadplane/langgraph';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAgent({
      apiUrl: 'https://your-langgraph-platform.com',
      assistantId: 'my-agent',
    }),
  ],
};

// support-chat.component.ts
import { Component } from '@angular/core';
import { ChatComponent as ThreadplaneChatComponent } from '@threadplane/chat';
import { injectAgent } from '@threadplane/langgraph';

@Component({
  selector: 'app-support-chat',
  imports: [ThreadplaneChatComponent],
  template: `
    <chat [agent]="chat" />

    @if (chat.isLoading()) {
      <span>Streaming…</span>
    }

    <button (click)="send()">Send</button>
  `,
})
export class SupportChatComponent {
  protected readonly chat = injectAgent();

  send() {
    void this.chat.submit({ message: 'Hello' });
  }
}
```

That's it. `chat.messages()` and `chat.status()` are Angular Signals. Bind them directly in your template — no subscriptions, no `async` pipe, no zone.js required.

---

## Feature Comparison

| Feature | `injectAgent()` (Angular) | `useStream()` (React) |
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
    src="https://threadplane.ai/assets/arch-diagram.svg"
    alt="Threadplane architecture: Angular Component → agent() → StreamManager Bridge → LangGraph Platform, with signals returned reactively"
    width="100%"
  />
</p>

`injectAgent()` resolves an agent whose internal `BehaviorSubject`s were created at injection-context time — once, when `provideAgent()`'s factory ran. The `StreamManager` bridge (the only file that touches `@langchain/langgraph-sdk` internals) pushes stream events into those subjects. `toSignal()` converts each subject to an Angular Signal, also at construction time. Dynamic actions (`submit`, `stop`, `switchThread`) push into the existing subjects — no new subjects are ever created after construction. This architecture is required because `toSignal()` must be called in an injection context and cannot be called again later.

---

## Documentation

- [LangGraph Quickstart](https://threadplane.ai/docs/langgraph/getting-started/quickstart)
- [injectAgent() API](https://threadplane.ai/docs/langgraph/api/inject-agent)
- [Choosing an adapter (LangGraph vs AG-UI)](https://threadplane.ai/docs/choosing-an-adapter)
- [Chat Introduction](https://threadplane.ai/docs/chat/getting-started/introduction)
- [Human-in-the-Loop / Interrupts](https://threadplane.ai/docs/langgraph/guides/interrupts)
- [Subgraph and Subagent Streaming](https://threadplane.ai/docs/langgraph/guides/subgraphs)

---

## License

Most published libraries in this repository (`@threadplane/render`, `@threadplane/langgraph`, `@threadplane/ag-ui`, `@threadplane/a2ui`, `@threadplane/licensing`, `@threadplane/telemetry`) are released under the **MIT License** — free for any use, including commercial, with attribution.

**`@threadplane/chat`** is the exception. It is dual-licensed under **PolyForm Noncommercial 1.0.0** for free noncommercial use, or a **Threadplane Commercial license** for production use inside a for-profit context. See [`libs/chat/LICENSE.md`](./libs/chat/LICENSE.md), [`libs/chat/COMMERCIAL-USE.md`](./libs/chat/COMMERCIAL-USE.md), [`COMMERCIAL.md`](./COMMERCIAL.md), and [threadplane.ai/docs/licensing](https://threadplane.ai/docs/licensing) for details.
