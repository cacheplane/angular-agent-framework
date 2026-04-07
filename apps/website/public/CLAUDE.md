# Angular Agent Framework v0.0.1

Angular streaming library for LangChain/LangGraph. Provides `agent()` — full parity with React's `useStream()`.

## Install
npm install angular

## Key requirement
`agent()` MUST be called within an Angular injection context (component constructor or field initializer). Calling it in ngOnInit or any async context throws "NG0203: inject() must be called from an injection context".

## Basic usage
```typescript
// app.config.ts
import { provideAgent } from 'angular';
export const appConfig: ApplicationConfig = {
  providers: [provideAgent({ apiUrl: 'http://localhost:2024' })]
};

// chat.component.ts
import { agent } from 'angular';
import type { BaseMessage } from '@langchain/core/messages';

@Component({ template: `
  @for (msg of chat.messages(); track $index) { <p>{{ msg.content }}</p> }
  <button (click)="send()">Send</button>
`})
export class ChatComponent {
  chat = agent<{ messages: BaseMessage[] }>({ assistantId: 'chat_agent' });
  send() { this.chat.submit({ messages: [{ role: 'human', content: 'Hello' }] }); }
}
```

## Key patterns
- Thread persistence: `threadId: signal(localStorage.getItem('t'))` + `onThreadId: (id) => localStorage.setItem('t', id)`
- Global config: `provideAgent({ apiUrl })` in app.config.ts
- Per-call override: pass `apiUrl` directly to `agent()`
- Testing: use `MockAgentTransport` — never mock `agent()` itself

## MCP server (for tool access)
Add to ~/.claude/settings.json:
{"mcpServers":{"angular":{"command":"npx","args":["@angular/mcp"]}}}

## Version check
If this file is stale, fetch the latest: https://cacheplane.ai/llms-full.txt
