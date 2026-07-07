# Threadplane v0.0.55

Production-ready chat, durable threads, interrupts, subagents, planning, memory, and generative UI for Angular agent apps.

## Install
npm install @threadplane/chat @threadplane/langgraph @langchain/core @langchain/langgraph-sdk marked

## Key requirement
`injectAgent()` MUST be called within an Angular injection context (component constructor or field initializer). Calling it in ngOnInit or any async context throws "NG0203: inject() must be called from an injection context".

## Basic usage
```typescript
// app.config.ts
import type { ApplicationConfig } from '@angular/core';
import { provideAgent } from '@threadplane/langgraph';
export const appConfig: ApplicationConfig = {
  providers: [provideAgent({ apiUrl: 'http://localhost:2024', assistantId: 'chat_agent' })]
};

// chat.component.ts
import { Component } from '@angular/core';
import { injectAgent } from '@threadplane/langgraph';
import { ChatComponent as ThreadplaneChatComponent } from '@threadplane/chat';

@Component({
  imports: [ThreadplaneChatComponent],
  template: `
    <chat [agent]="chat" />
  `,
})
export class ChatComponent {
  chat = injectAgent();
}
```

## Key patterns
- Thread persistence: configure `provideAgent({ assistantId, threadId: signal(localStorage.getItem('t')), onThreadId })`
- Global config: `provideAgent({ apiUrl, assistantId })` in app.config.ts
- Scoped config: re-provide `provideAgent({ apiUrl, assistantId })` in a component `providers` array for a subtree
- Testing: use `MockAgentTransport` — never mock `injectAgent()` itself

## Version check
If this file is stale, fetch the latest: https://threadplane.ai/llms-full.txt
