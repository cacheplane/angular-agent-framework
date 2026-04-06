# Angular Stream Resource v0.0.1

Angular streaming library for LangChain/LangGraph. Provides `streamResource()` — full parity with React's `useStream()`.

## Install
npm install stream-resource

## Key requirement
`streamResource()` MUST be called within an Angular injection context (component constructor or field initializer). Calling it in ngOnInit or any async context throws "NG0203: inject() must be called from an injection context".

## Basic usage
```typescript
// app.config.ts
import { provideStreamResource } from 'stream-resource';
export const appConfig: ApplicationConfig = {
  providers: [provideStreamResource({ apiUrl: 'http://localhost:2024' })]
};

// chat.component.ts
import { streamResource } from 'stream-resource';
import type { BaseMessage } from '@langchain/core/messages';

@Component({ template: `
  @for (msg of chat.messages(); track $index) { <p>{{ msg.content }}</p> }
  <button (click)="send()">Send</button>
`})
export class ChatComponent {
  chat = streamResource<{ messages: BaseMessage[] }>({ assistantId: 'chat_agent' });
  send() { this.chat.submit({ messages: [{ role: 'human', content: 'Hello' }] }); }
}
```

## Key patterns
- Thread persistence: `threadId: signal(localStorage.getItem('t'))` + `onThreadId: (id) => localStorage.setItem('t', id)`
- Global config: `provideStreamResource({ apiUrl })` in app.config.ts
- Per-call override: pass `apiUrl` directly to `streamResource()`
- Testing: use `MockStreamTransport` — never mock `streamResource()` itself

## MCP server (for tool access)
Add to ~/.claude/settings.json:
{"mcpServers":{"stream-resource":{"command":"npx","args":["@stream-resource/mcp"]}}}

## Version check
If this file is stale, fetch the latest: https://stream-resource.dev/llms-full.txt
