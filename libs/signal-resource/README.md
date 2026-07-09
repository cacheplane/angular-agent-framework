# @threadplane/signal-resource

Signal-backed chat resource adapter for `@threadplane/chat`.

Use this package when your chat runtime already exposes Angular signals for
message history, loading state, errors, and send/stop/retry methods. The adapter
wraps that structural resource shape in Threadplane's runtime-neutral `Agent`
contract, so the same `<chat>` UI can render it.

## Install

```bash
npm install @threadplane/chat @threadplane/signal-resource
```

## Provide An Agent

```ts
import { bootstrapApplication } from '@angular/platform-browser';
import { provideAgent } from '@threadplane/signal-resource';
import { AppComponent } from './app.component';
import { createChatResource } from './chat-resource';

bootstrapApplication(AppComponent, {
  providers: [
    provideAgent(() => {
      const resource = createChatResource();
      return resource;
    }),
  ],
});
```

## Use With Chat

```ts
import { Component } from '@angular/core';
import { ChatComponent } from '@threadplane/chat';
import { injectAgent } from '@threadplane/signal-resource';

@Component({
  selector: 'app-root',
  imports: [ChatComponent],
  template: `<chat [agent]="agent" />`,
})
export class AppComponent {
  readonly agent = injectAgent();
}
```

## Resource Shape

The resource is structural. It does not need to inherit from a Threadplane base
class.

```ts
import type { Signal } from '@angular/core';
import type {
  SignalChatResourceMessage,
} from '@threadplane/signal-resource';

interface ChatResource {
  value: Signal<SignalChatResourceMessage[]>;
  isLoading: Signal<boolean>;
  error: Signal<Error | undefined>;
  sendMessage(message: { role: 'user'; content: unknown }): void;
  stop(): void;
  setMessages(messages: SignalChatResourceMessage[]): void;
  resendMessages?(): void;
  reload?(): boolean;
}
```

The adapter projects resource tool-call state into `Agent.toolCalls`, but it
does not take over provider-owned tool execution or result submission.
