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
  <a href="https://scorecard.dev/viewer/?uri=github.com/cacheplane/angular-agent-framework">
    <img alt="OpenSSF Scorecard" src="https://api.scorecard.dev/projects/github.com/cacheplane/angular-agent-framework/badge" />
  </a>
</p>

---

Threadplane is a production-ready agent UI framework for Angular. `@threadplane/chat` provides chat surfaces (headless primitives, opinionated compositions, interrupts, generative UI). `@threadplane/langgraph` adapts a LangGraph Platform endpoint into Angular Signals via `provideAgent()` + `injectAgent()`. `@threadplane/ag-ui` bridges any AG-UI-compatible backend into the same chat surface. `@threadplane/render` renders JSON specs to Angular components inside your design system.

`injectAgent()` is the Angular equivalent of LangGraph's React `useStream()` hook, projected through a runtime-neutral `Agent` contract that `@threadplane/chat` consumes. Configure it once with `provideAgent({...})`, inject it into any Angular 20+ component, and get signal-driven access to messages, status, tool calls, interrupts, subagents, history, and thread management — no subscriptions, no `async` pipe, no zone.js required.

---

## Install

```bash
npm install @threadplane/langgraph @threadplane/chat
```

**Peer dependencies:** `@angular/core ^20.0.0 || ^21.0.0`, `@langchain/core ^1.1.33`, `@langchain/langgraph-sdk ^1.7.4`, `rxjs ~7.8.0`

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

`chat.messages()` and `chat.status()` are Angular Signals. Bind them directly in your template — no subscriptions, no `async` pipe, no zone.js required.

---

## Feature Comparison

| Feature | `injectAgent()` (Angular) | `useStream()` (React) |
|---|---|---|
| Streaming state as reactive primitives | Angular Signals | React state |
| Messages signal | `messages()` | `messages` |
| Loading state | `isLoading()` | `isLoading` |
| Error state | `error()` | — |
| Runtime-neutral status | `status()` — `'idle' \| 'running' \| 'error'` | partial |
| Interrupt / human-in-the-loop | `interrupt()` (runtime-neutral) / `langGraphInterrupts()` (raw plural) | `interrupt` / `interrupts` |
| Tool call progress | `toolCalls()` | `toolCalls` |
| Branch / history | `branch()` / `history()` / `experimentalBranchTree()` | `branch` / `history` / `experimental_branchTree` |
| Pending run queue | `queue()` | `queue` |
| Subagent map and lookup | `subagents()` — `Signal<Map<string, Subagent>>` / `getSubagent(toolCallId)` | `subagents` / helper methods |
| Reactive thread switching | `switchThread(id)` | prop |
| Submit | `submit(values, opts?)` | `submit(values, opts?)` |
| Stop | `stop()` | `stop()` |
| Regenerate response | `regenerate(assistantMessageIndex)` | — |
| Reload last submission | `reload()` | — |
| Custom transport (for testing) | `MockAgentTransport` | mock fetch |
| Angular `ResourceRef<T>` compatibility | Full duck-type parity | N/A |
| Angular 20+ Signals API | Native | N/A |
| SSR / Server Components | Client-side only | React Server Components (React) |

---

## Packages

All packages are published at version `0.0.47` under a patch-only `0.0.x` release policy.

| Package | Purpose | License |
|---|---|---|
| `@threadplane/chat` | Drop-in agent chat UI for Angular: headless primitives and opinionated compositions (`<chat>`, popup, sidebar, interrupts, GenUI) | PolyForm Noncommercial + Commercial (dual) |
| `@threadplane/langgraph` | LangGraph adapter; `provideAgent()`/`injectAgent()` exposes a LangGraph run as Angular Signals | MIT |
| `@threadplane/ag-ui` | AG-UI adapter; bridges any `@ag-ui/client`-compatible backend into the chat surface | MIT |
| `@threadplane/render` | `@json-render/core`-backed Angular engine that renders JSON specs to components (powers GenUI) | MIT |
| `@threadplane/a2ui` | A2UI protocol types, streaming parser, and dynamic-value resolver; pure TypeScript, no Angular dependency | MIT |
| `@threadplane/licensing` | Browser-safe Ed25519 license-token verification and evaluation (backs the chat commercial check) | MIT |
| `@threadplane/telemetry` | Transparent, opt-out anonymous usage telemetry (node + browser) | MIT |

---

## Architecture

<p align="center">
  <img
    src="https://threadplane.ai/assets/arch-diagram.svg"
    alt="Threadplane architecture: Angular Component → injectAgent() → StreamManager Bridge → LangGraph Platform, with signals returned reactively"
    width="100%"
  />
</p>

`provideAgent()` creates the agent's internal `BehaviorSubject`s at injection-context time — once, when the provider factory runs. `injectAgent()` retrieves the configured `LangGraphAgent` in any component. The `StreamManager` bridge (the only file that touches `@langchain/langgraph-sdk` internals) pushes stream events into those subjects. `toSignal()` converts each subject to an Angular Signal, also at construction time. Dynamic actions (`submit`, `stop`, `switchThread`) push into the existing subjects — no new subjects are ever created after construction. This architecture is required because `toSignal()` must be called in an injection context and cannot be called again later.

The runtime-neutral `Agent` contract is the stability boundary between adapters and the chat surface. `@threadplane/chat` consumes `Agent` — not `LangGraphAgent` — so swapping `@threadplane/langgraph` for `@threadplane/ag-ui` requires no changes to your chat components or templates.

**Reliability:** Every pull request runs the "Library — lint / test / build" CI job across all packages. Testing uses `MockAgentTransport` to swap the transport layer, so you never need to mock `injectAgent()` itself — just substitute the transport. The patch-only `0.0.x` release policy ensures no minor or major version bumps silently break your lockfile.

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
