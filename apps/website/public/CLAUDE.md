# Threadplane v0.0.65

Production-ready chat, thread/history/branch UI, interrupts, subagents, planning, memory, and generative UI for Angular agent apps.

Supported Angular majors: 20, 21, and 22.

## License and deployment boundary
- Every Threadplane package is MIT-licensed and free for commercial and noncommercial use.
- Threadplane runs inside the customer's Angular application. Agent runtime, models, storage, checkpointing, retention, authorization, and hosting remain customer-operated.
- Package use requires no registration, activation, or runtime check.

## Install
npm install @threadplane/chat @threadplane/langgraph @langchain/core @langchain/langgraph-sdk marked

The chat, LangGraph, AG-UI, and render packages include automatic install collection
for local and CI execution: package/environment details, a random installation ID,
configured Git name/full email, and repository provider/owner hints when available.
Set `DO_NOT_TRACK=1` or `TPLANE_TELEMETRY_DISABLED=1` before installation to disable
it. Package-manager script controls are respected. A usable install email can qualify
for a short founder welcome sequence after linked development-browser use, capped
at three emails with unsubscribe and reply stops. CI alone does not trigger it.
The package-local correlation token contains no email; copied/cached packages can
retain it, so it does not verify a person. No registration is required.
See https://threadplane.ai/privacy.


Supported runtime/browser collection is automatic only in Angular development mode.
Production builds, SSR, imports, and unused construction are inert. It sends closed
progress milestones with package/version and random browser-origin/session IDs, never
conversation content or private URLs. Adapter `telemetry: false` disables it; a custom
sink replaces the automatic destination, including nested chat JSON rendering. Use
`setDevelopmentCollectionEnabled(false)` from `@threadplane/telemetry/browser`, or set
browser localStorage `THREADPLANE_TELEMETRY_DISABLED=1` and reload. Development console
announcements need no click to acknowledge progress. Linked non-CI install and runtime
evidence can qualify the install email for the founder sequence described above.
Standalone render also accepts `provideRender({ telemetry: false })`.

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
- Thread selection: configure `provideAgent({ assistantId, threadId: signal(localStorage.getItem('t')), onThreadId })`; actual durability and cross-device persistence depend on the connected runtime and persistence layer
- Global config: `provideAgent({ apiUrl, assistantId })` in app.config.ts
- Scoped config: re-provide `provideAgent({ apiUrl, assistantId })` in a component `providers` array for a subtree
- Testing: use `MockAgentTransport` — never mock `injectAgent()` itself

## Version check
If this file is stale, fetch the latest: https://threadplane.ai/llms-full.txt
