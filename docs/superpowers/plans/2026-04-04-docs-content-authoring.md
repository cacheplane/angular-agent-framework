# Docs Content Authoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Write all 15 remaining docs pages with real code examples from cockpit implementations, using the MDX component system (Callout, Steps, Tabs, CardGroup).

**Architecture:** Each task writes one MDX file to `apps/website/content/docs-v2/[section]/[slug].mdx`. Content uses cockpit capability patterns adapted for agent() Angular usage. All tasks are independent and can be parallelized. The 3 existing placeholder pages (introduction, streaming, angular API) are already written.

**Tech Stack:** MDX with custom components (Callout, Steps, Tabs, Tab, CardGroup, Card)

**Note:** Tasks are grouped by section for readability. All tasks within a group are independent of each other. The MDX components available are: `<Callout type="info|warning|tip|danger" title="...">`, `<Steps><Step title="...">`, `<Tabs items={[...]}><Tab>`, `<CardGroup cols={N}><Card title="..." href="...">`.

---

### Task 1: Quick Start Guide

**Files:**
- Create: `apps/website/content/docs-v2/getting-started/quickstart.mdx`

- [ ] **Step 1: Write the quickstart page**

This is the most important onboarding page. Walk through building a chat component in 5 minutes.

```mdx
# Quick Start

Build a streaming chat component with agent() in 5 minutes.

<Callout type="info" title="Prerequisites">
Angular 20+ project with Node.js 18+. If you need setup help, see the [Installation](/docs/getting-started/installation) guide.
</Callout>

## 1. Install

```bash
npm install @cacheplane/langgraph
```

## 2. Configure the provider

Add `provideAgent()` to your application config with your LangGraph Platform URL.

```typescript
// app.config.ts
import { provideAgent } from '@cacheplane/langgraph';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAgent({
      apiUrl: 'http://localhost:2024',
    }),
  ],
};
```

## 3. Create a chat component

Use `agent()` in a component field initializer. Every property on the returned ref is an Angular Signal.

<Tabs items={['TypeScript', 'Template']}>
<Tab>

```typescript
// chat.component.ts
import { Component, signal, computed } from '@angular/core';
import { agent } from '@cacheplane/langgraph';
import type { BaseMessage } from '@langchain/core/messages';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
})
export class ChatComponent {
  input = signal('');

  chat = agent<{ messages: BaseMessage[] }>({
    assistantId: 'chat_agent',
    threadId: signal(localStorage.getItem('threadId')),
    onThreadId: (id) => localStorage.setItem('threadId', id),
  });

  isStreaming = computed(() => this.chat.status() === 'loading');

  send() {
    const msg = this.input();
    if (!msg.trim()) return;
    this.chat.submit({ messages: [{ role: 'user', content: msg }] });
    this.input.set('');
  }
}
```

</Tab>
<Tab>

```html
<!-- chat.component.html -->
<div class="chat">
  @for (msg of chat.messages(); track $index) {
    <div [class]="msg.role">
      <p>{{ msg.content }}</p>
    </div>
  }

  @if (isStreaming()) {
    <div class="typing-indicator">Agent is thinking...</div>
  }

  <form (submit)="send(); $event.preventDefault()">
    <input
      [ngModel]="input()"
      (ngModelChange)="input.set($event)"
      placeholder="Type a message..."
    />
    <button type="submit" [disabled]="isStreaming()">Send</button>
  </form>
</div>
```

</Tab>
</Tabs>

## 4. Start your LangGraph server

Make sure your LangGraph agent is running at the URL you configured.

```bash
langgraph dev
```

## 5. Run your app

```bash
ng serve
```

Open `http://localhost:4200` and start chatting with your agent.

## Next steps

<CardGroup cols={2}>
  <Card title="Streaming" href="/docs/guides/streaming">
    Learn about token-by-token updates and stream modes
  </Card>
  <Card title="Persistence" href="/docs/guides/persistence">
    Keep conversations alive across page refreshes
  </Card>
  <Card title="Interrupts" href="/docs/guides/interrupts">
    Add human-in-the-loop approval flows
  </Card>
  <Card title="Testing" href="/docs/guides/testing">
    Test your agent integration deterministically
  </Card>
</CardGroup>
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/content/docs-v2/getting-started/quickstart.mdx
git commit -m "docs(website): write Quick Start guide"
```

---

### Task 2: Installation Guide

**Files:**
- Create: `apps/website/content/docs-v2/getting-started/installation.mdx`

- [ ] **Step 1: Write the installation page**

```mdx
# Installation

Detailed setup guide for agent() in your Angular application.

## Requirements

<Steps>
<Step title="Angular 20+">
agent() uses Angular Signals and the modern injection context API. Angular 20 or later is required.
</Step>
<Step title="Node.js 18+">
Required for the build toolchain and package installation.
</Step>
<Step title="LangGraph Platform">
A running LangGraph agent accessible via HTTP. Can be local (langgraph dev) or deployed (LangGraph Cloud).
</Step>
</Steps>

## Install the package

```bash
npm install @cacheplane/langgraph
```

This installs the library and its peer dependencies including `@langchain/langgraph-sdk`.

## Configure the provider

Add `provideAgent()` to your application configuration. This sets global defaults for all agent instances.

```typescript
// app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideAgent } from '@cacheplane/langgraph';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAgent({
      apiUrl: process.env['LANGGRAPH_URL'] ?? 'http://localhost:2024',
    }),
  ],
};
```

<Callout type="tip" title="Per-call overrides">
Any option passed to `agent()` directly overrides the global provider config. You can set a default `apiUrl` globally and override it for specific agents.
</Callout>

## Environment setup

<Tabs items={['Development', 'Production']}>
<Tab>

For local development, run a LangGraph server:

```bash
# Start LangGraph dev server
langgraph dev

# Your agent will be available at http://localhost:2024
```

</Tab>
<Tab>

For production, point to your LangGraph Cloud deployment:

```typescript
provideAgent({
  apiUrl: 'https://your-project.langgraph.app',
})
```

</Tab>
</Tabs>

## Verify installation

Create a minimal test to verify the setup works:

```typescript
import { agent } from '@cacheplane/langgraph';

// In a component
const test = agent({
  assistantId: 'chat_agent',
});

// If status() returns 'idle', the setup is correct
console.log(test.status()); // 'idle'
```

## Next steps

<CardGroup cols={2}>
  <Card title="Quick Start" href="/docs/getting-started/quickstart">
    Build your first chat component in 5 minutes
  </Card>
  <Card title="Angular Signals" href="/docs/concepts/angular-signals">
    Understand how Signals power agent
  </Card>
</CardGroup>
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/content/docs-v2/getting-started/installation.mdx
git commit -m "docs(website): write Installation guide"
```

---

### Task 3: Persistence Guide

**Files:**
- Create: `apps/website/content/docs-v2/guides/persistence.mdx`

- [ ] **Step 1: Write the persistence guide**

Source: `cockpit/langgraph/persistence/` — state checkpointing and thread recovery.

```mdx
# Persistence

Thread persistence keeps conversations alive across page refreshes, browser restarts, and session changes. agent() manages thread state through the `threadId` signal and `onThreadId` callback.

<Callout type="info" title="How it works">
LangGraph checkpoints state at every super-step. agent() connects to these checkpoints via thread IDs, letting you resume exactly where you left off.
</Callout>

## Basic thread persistence

Save the thread ID to localStorage so conversations survive page refreshes.

<Tabs items={['TypeScript', 'Template']}>
<Tab>

```typescript
// chat.component.ts
const chat = agent<{ messages: BaseMessage[] }>({
  assistantId: 'chat_agent',
  threadId: signal(localStorage.getItem('threadId')),
  onThreadId: (id) => localStorage.setItem('threadId', id),
});
```

</Tab>
<Tab>

```html
<!-- Thread ID is managed automatically -->
<!-- Messages restore when the component remounts -->
@for (msg of chat.messages(); track $index) {
  <p>{{ msg.content }}</p>
}
```

</Tab>
</Tabs>

## Reactive thread switching

Pass a Signal as `threadId` to reactively switch between conversations.

```typescript
// conversation-list.component.ts
activeThreadId = signal<string | null>(null);

chat = agent<{ messages: BaseMessage[] }>({
  assistantId: 'chat_agent',
  threadId: this.activeThreadId,  // Signal — switches reactively
  onThreadId: (id) => this.activeThreadId.set(id),
});

// Switch to a different conversation
selectThread(id: string) {
  this.activeThreadId.set(id);
  // agent automatically loads the new thread's state
}
```

<Callout type="tip" title="Thread loading state">
Use the `isThreadLoading()` signal to show a loading indicator while thread state is being fetched from the server.
</Callout>

## Manual thread switching

Use `switchThread()` for imperative thread changes that also reset derived state.

```typescript
// Reset and start a new conversation
newConversation() {
  this.chat.switchThread(null);
  // Creates a new thread on next submit
}

// Switch to a specific thread
loadConversation(threadId: string) {
  this.chat.switchThread(threadId);
}
```

## Checkpoint recovery

When a connection drops, agent() can rejoin an in-progress run.

```typescript
// Rejoin a running stream
await chat.joinStream(runId, lastEventId);
// Picks up from where the connection was lost
```
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/content/docs-v2/guides/persistence.mdx
git commit -m "docs(website): write Persistence guide"
```

---

### Task 4: Interrupts Guide

**Files:**
- Create: `apps/website/content/docs-v2/guides/interrupts.mdx`

- [ ] **Step 1: Write the interrupts guide**

Source: `cockpit/langgraph/interrupts/` — human-in-the-loop pausing with typed payloads.

```mdx
# Interrupts

Interrupts let your LangGraph agent pause execution and wait for human input. agent() surfaces interrupts as Angular Signals, making it easy to build approval flows, confirmation dialogs, and human-in-the-loop experiences.

<Callout type="info" title="When to use interrupts">
Use interrupts for human approval, late-binding decisions, or any step where the agent needs external input before continuing.
</Callout>

## Basic interrupt handling

When an agent interrupts, the `interrupt()` signal contains the interrupt data.

<Tabs items={['TypeScript', 'Template']}>
<Tab>

```typescript
// approval.component.ts
interface ApprovalPayload {
  action: string;
  description: string;
  risk: 'low' | 'medium' | 'high';
}

const agent = agent<AgentState>({
  assistantId: 'approval_agent',
});

// Check for pending interrupts
pendingApproval = computed(() => agent.interrupt());
```

</Tab>
<Tab>

```html
<!-- Show approval dialog when agent interrupts -->
@if (pendingApproval(); as approval) {
  <div class="approval-dialog">
    <h3>Agent needs approval</h3>
    <p>{{ approval.value.description }}</p>
    <p>Risk level: {{ approval.value.risk }}</p>
    <button (click)="approve()">Approve</button>
    <button (click)="reject()">Reject</button>
  </div>
}
```

</Tab>
</Tabs>

## Resuming from an interrupt

Call `submit()` with the resume payload to continue execution.

```typescript
approve() {
  this.agent.submit(null, { resume: { approved: true } });
}

reject() {
  this.agent.submit(null, { resume: { approved: false, reason: 'User rejected' } });
}
```

## Multiple interrupts

The `interrupts()` signal tracks all interrupts received during a run, not just the current one.

```typescript
// Track interrupt history
allInterrupts = computed(() => agent.interrupts());
latestInterrupt = computed(() => agent.interrupt());
interruptCount = computed(() => agent.interrupts().length);
```

<Callout type="warning" title="Typed interrupts">
Use the BagTemplate generic parameter to type your interrupt payloads for full TypeScript safety.
</Callout>
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/content/docs-v2/guides/interrupts.mdx
git commit -m "docs(website): write Interrupts guide"
```

---

### Task 5: Memory Guide

**Files:**
- Create: `apps/website/content/docs-v2/guides/memory.mdx`

- [ ] **Step 1: Write the memory guide**

Source: `cockpit/langgraph/memory/` + `cockpit/deep-agents/memory/` — durable context retention.

```mdx
# Memory

Memory in LangGraph preserves useful context that later steps can read back. agent() exposes memory through the messages and state signals, with thread persistence providing cross-session continuity.

<Callout type="info" title="Short-term vs long-term">
Short-term memory lives within a thread (conversation history). Long-term memory persists across threads via LangGraph's memory store.
</Callout>

## Short-term memory (thread-scoped)

Every message in a thread is automatically preserved. When you reconnect with the same `threadId`, the full conversation history is restored.

```typescript
const chat = agent<{ messages: BaseMessage[] }>({
  assistantId: 'memory_agent',
  threadId: signal(userId()),  // User-specific thread
});

// Messages accumulate across the conversation
const messageCount = computed(() => chat.messages().length);

// Resume where you left off on next visit
// threadId persists, so history is restored
```

## Accessing agent state as memory

The `value()` signal contains the full agent state, which can include custom memory fields.

```typescript
interface AgentState {
  messages: BaseMessage[];
  userPreferences: { theme: string; language: string };
  projectContext: { name: string; files: string[] };
}

const agent = agent<AgentState>({
  assistantId: 'context_agent',
  threadId: signal(projectId()),
});

// Read memory fields from agent state
const prefs = computed(() => agent.value().userPreferences);
const context = computed(() => agent.value().projectContext);
```

## Cross-session memory

Thread persistence enables memory that spans sessions. The agent decides what to store in its state.

```typescript
// User returns days later — same threadId resumes context
const agent = agent<AgentState>({
  assistantId: 'memory_agent',
  threadId: signal(localStorage.getItem('agent-thread')),
  onThreadId: (id) => localStorage.setItem('agent-thread', id),
});

// Agent recalls past decisions, preferences, and context
// No explicit memory management needed on the Angular side
```

<Callout type="tip" title="Memory is server-side">
The agent controls what gets stored in memory. agent() just surfaces the current state. Design your agent's state schema to include the fields you want to persist.
</Callout>
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/content/docs-v2/guides/memory.mdx
git commit -m "docs(website): write Memory guide"
```

---

### Task 6: Time Travel Guide

**Files:**
- Create: `apps/website/content/docs-v2/guides/time-travel.mdx`

- [ ] **Step 1: Write the time travel guide**

Source: `cockpit/langgraph/time-travel/` — checkpoint inspection and execution branching.

```mdx
# Time Travel

Time travel lets you inspect earlier states and replay alternate execution paths. agent() exposes the full checkpoint history and branch navigation through Angular Signals.

<Callout type="info" title="Use cases">
Debug agent decisions, explore alternate paths, and build undo/redo experiences for your users.
</Callout>

## Browsing execution history

The `history()` signal contains an array of `ThreadState` checkpoints.

```typescript
const agent = agent<AgentState>({
  assistantId: 'agent',
  threadId: signal(threadId),
});

// Full execution timeline
const checkpoints = computed(() => agent.history());
const checkpointCount = computed(() => agent.history().length);
```

## Forking from a checkpoint

Submit with a specific checkpoint to branch execution from an earlier state.

```typescript
// Fork from the 3rd checkpoint with new input
forkFromCheckpoint(index: number) {
  const checkpoint = this.agent.history()[index];
  this.agent.submit(
    { messages: [{ role: 'user', content: 'Try a different approach' }] },
    { checkpoint: checkpoint.checkpoint }
  );
}
```

## Branch navigation

Use `branch()` and `setBranch()` to navigate between execution branches.

```typescript
// Current branch
const activeBranch = computed(() => agent.branch());

// Switch to a different branch
selectBranch(branchId: string) {
  agent.setBranch(branchId);
}
```

<Callout type="tip" title="Debugging workflow">
Time travel is most useful during development. Inspect why an agent chose a particular path, then fork to test alternatives without restarting the conversation.
</Callout>
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/content/docs-v2/guides/time-travel.mdx
git commit -m "docs(website): write Time Travel guide"
```

---

### Task 7: Subgraphs Guide

**Files:**
- Create: `apps/website/content/docs-v2/guides/subgraphs.mdx`

- [ ] **Step 1: Write the subgraphs guide**

Source: `cockpit/langgraph/subgraphs/` + `cockpit/deep-agents/subagents/` — modular agent composition.

```mdx
# Subgraphs

Subgraphs let you compose complex agents from smaller, focused units. agent() tracks subagent execution through dedicated signals, giving you visibility into delegated work.

<Callout type="info" title="Subgraphs vs subagents">
LangGraph calls them subgraphs (modular graph composition). Deep Agents calls them subagents (task delegation). agent() supports both patterns through the same API.
</Callout>

## Tracking subagent execution

The `subagents()` signal contains a Map of active subagent streams.

```typescript
const orchestrator = agent<OrchestratorState>({
  assistantId: 'orchestrator',
  subagentToolNames: ['research', 'analyze', 'summarize'],
});

// All subagent streams
const subagents = computed(() => orchestrator.subagents());

// Only active ones
const running = computed(() => orchestrator.activeSubagents());
const runningCount = computed(() => running().length);
```

## Subagent stream details

Each `SubagentStreamRef` provides its own signals.

```typescript
// Access a specific subagent
const researchAgent = computed(() =>
  orchestrator.subagents().get('research-tool-call-id')
);

// Track its progress
const researchStatus = computed(() => researchAgent()?.status());
const researchMessages = computed(() => researchAgent()?.messages() ?? []);
```

## Filtering subagent messages

By default, subagent messages appear in the parent's `messages()` signal. Filter them out for a cleaner parent view.

```typescript
const orchestrator = agent<OrchestratorState>({
  assistantId: 'orchestrator',
  filterSubagentMessages: true,  // Hide subagent messages from parent
  subagentToolNames: ['research', 'analyze'],
});

// Parent messages only (no subagent chatter)
const parentMessages = computed(() => orchestrator.messages());
```

<Callout type="tip" title="Subagent tool names">
Set `subagentToolNames` to the tool names that spawn subagents. agent() uses this to identify which tool calls create subagent streams.
</Callout>
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/content/docs-v2/guides/subgraphs.mdx
git commit -m "docs(website): write Subgraphs guide"
```

---

### Task 8: Testing Guide

**Files:**
- Create: `apps/website/content/docs-v2/guides/testing.mdx`

- [ ] **Step 1: Write the testing guide**

Source: `MockAgentTransport` from the library — deterministic agent testing.

```mdx
# Testing

MockAgentTransport lets you test agent interactions deterministically without a running LangGraph server. Script exact event sequences and step through them in your Angular test specs.

<Callout type="tip" title="No flaky tests">
MockAgentTransport eliminates network dependencies, timing issues, and server state. Every test run produces identical results.
</Callout>

## Basic test setup

Create a MockAgentTransport with scripted events and pass it to agent.

```typescript
import { TestBed } from '@angular/core/testing';
import { MockAgentTransport } from '@cacheplane/langgraph';
import type { StreamEvent } from '@cacheplane/langgraph';

describe('ChatComponent', () => {
  it('should display agent messages', () => {
    const transport = new MockAgentTransport();

    TestBed.runInInjectionContext(() => {
      const chat = agent<{ messages: BaseMessage[] }>({
        assistantId: 'test_agent',
        transport,
      });

      // Emit a values event
      transport.emit([
        { type: 'values', messages: [{ role: 'assistant', content: 'Hello!' }] },
      ]);

      expect(chat.messages().length).toBe(1);
      expect(chat.messages()[0].content).toBe('Hello!');
    });
  });
});
```

## Scripting event sequences

Pass event batches to the constructor for sequential playback.

```typescript
const transport = new MockAgentTransport([
  // Batch 1: Initial response
  [{ type: 'values', messages: [{ role: 'assistant', content: 'Analyzing...' }] }],
  // Batch 2: Final response
  [{ type: 'values', messages: [{ role: 'assistant', content: 'Done!' }] }],
]);

// Advance through batches
const batch1 = transport.nextBatch();  // First batch
const batch2 = transport.nextBatch();  // Second batch
```

## Testing interrupts

Script an interrupt event to test human-in-the-loop flows.

```typescript
it('should handle interrupts', () => {
  const transport = new MockAgentTransport();

  TestBed.runInInjectionContext(() => {
    const agent = agent<AgentState>({
      assistantId: 'approval_agent',
      transport,
    });

    // Emit an interrupt
    transport.emit([
      { type: 'interrupt', value: { action: 'delete', risk: 'high' } },
    ]);

    expect(agent.interrupt()).toBeDefined();
    expect(agent.interrupt()?.value.risk).toBe('high');
  });
});
```

## Testing errors

Inject errors to test error handling.

```typescript
it('should surface errors', () => {
  const transport = new MockAgentTransport();

  TestBed.runInInjectionContext(() => {
    const chat = agent<ChatState>({
      assistantId: 'test_agent',
      transport,
    });

    transport.emitError(new Error('Connection lost'));

    expect(chat.error()).toBeDefined();
    expect(chat.status()).toBe('error');
  });
});
```

<Callout type="warning" title="Injection context required">
agent() must be called within an Angular injection context. In tests, wrap calls in `TestBed.runInInjectionContext()`.
</Callout>
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/content/docs-v2/guides/testing.mdx
git commit -m "docs(website): write Testing guide"
```

---

### Task 9: Deployment Guide

**Files:**
- Create: `apps/website/content/docs-v2/guides/deployment.mdx`

- [ ] **Step 1: Write the deployment guide**

Source: `cockpit/langgraph/deployment-runtime/` — production configuration.

```mdx
# Deployment

Configure agent() for production with LangGraph Cloud, environment-based URLs, and error handling patterns.

## Production configuration

Point `apiUrl` to your LangGraph Cloud deployment.

<Tabs items={['Environment-based', 'Direct URL']}>
<Tab>

```typescript
// app.config.ts
provideAgent({
  apiUrl: environment.langgraphUrl,
})
```

```typescript
// environment.prod.ts
export const environment = {
  langgraphUrl: 'https://your-project.langgraph.app',
};
```

</Tab>
<Tab>

```typescript
// app.config.ts
provideAgent({
  apiUrl: 'https://your-project.langgraph.app',
})
```

</Tab>
</Tabs>

## Error boundaries

Handle errors gracefully in production.

```typescript
const chat = agent<ChatState>({
  assistantId: 'chat_agent',
});

// Reactive error display
hasError = computed(() => chat.status() === 'error');
errorMessage = computed(() => {
  const err = chat.error();
  return err instanceof Error ? err.message : 'Something went wrong';
});

// Retry after error
retry() {
  chat.reload();
}
```

## Recovering interrupted streams

Use `joinStream()` to reconnect to a running stream after a network interruption.

```typescript
// If you know the run ID (e.g., from a status endpoint)
await chat.joinStream(runId, lastEventId);
// Resumes streaming from where it left off
```

<Callout type="tip" title="Stateless client pattern">
agent() is a stateless client. All state lives on the LangGraph Platform. This means your Angular app can be deployed anywhere (CDN, edge, SSR) without state management concerns.
</Callout>

## Checklist

<Steps>
<Step title="Set production apiUrl">
Point to your LangGraph Cloud deployment URL.
</Step>
<Step title="Handle errors">
Show user-friendly error messages and retry buttons.
</Step>
<Step title="Persist thread IDs">
Store threadId in localStorage or a backend so users can resume conversations.
</Step>
<Step title="Configure throttle">
Set `throttle` option if token-by-token updates are too frequent for your UI.
</Step>
</Steps>
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/content/docs-v2/guides/deployment.mdx
git commit -m "docs(website): write Deployment guide"
```

---

### Task 10: Angular Signals Concept

**Files:**
- Create: `apps/website/content/docs-v2/concepts/angular-signals.mdx`

- [ ] **Step 1: Write the Angular Signals concept page**

```mdx
# Angular Signals

agent() is built on Angular Signals — the reactive primitive introduced in Angular 16+. Every property on a AgentRef is a Signal, making it work seamlessly with OnPush change detection, computed values, and effect callbacks.

## Signals primer

A Signal is a reactive value container. When a Signal's value changes, Angular automatically re-renders any template that reads it.

```typescript
// agent returns Signals, not Observables
const chat = agent<ChatState>({ assistantId: 'agent' });

chat.messages()    // Signal<BaseMessage[]> — call to read
chat.status()      // Signal<ResourceStatus>
chat.error()       // Signal<unknown>
chat.isLoading()   // Signal<boolean> (computed)
```

## Computed values

Use `computed()` to derive new Signals from agent signals.

```typescript
const lastMessage = computed(() =>
  chat.messages().at(-1)?.content ?? ''
);

const messageCount = computed(() =>
  chat.messages().length
);

const isIdle = computed(() =>
  chat.status() === 'idle'
);
```

## OnPush change detection

Because Signals trigger change detection automatically, agent works perfectly with `ChangeDetectionStrategy.OnPush`.

```typescript
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (msg of chat.messages(); track $index) {
      <p>{{ msg.content }}</p>
    }
  `,
})
export class ChatComponent {
  chat = agent<ChatState>({ assistantId: 'agent' });
}
```

## No RxJS required

Unlike traditional Angular HTTP patterns, agent doesn't use Observables. There are no subscriptions to manage, no async pipes needed, and no memory leak risks.

<Callout type="tip" title="Why Signals over RxJS?">
Signals are simpler for UI state. They synchronously read the latest value, compose with computed(), and integrate with Angular's template syntax. agent handles the async SSE connection internally and surfaces results as Signals.
</Callout>
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/content/docs-v2/concepts/angular-signals.mdx
git commit -m "docs(website): write Angular Signals concept page"
```

---

### Task 11: LangGraph Basics Concept

**Files:**
- Create: `apps/website/content/docs-v2/concepts/langgraph-basics.mdx`

- [ ] **Step 1: Write the LangGraph Basics page**

```mdx
# LangGraph Basics

LangGraph is a framework for building stateful AI agents as directed graphs. This page explains the core concepts for Angular developers who are new to agent development.

## Graphs, nodes, and edges

A LangGraph agent is a directed graph where:

<Steps>
<Step title="Nodes are functions">
Each node performs one action — calling an LLM, querying a database, or making an API request. Nodes receive state and return updated state.
</Step>
<Step title="Edges define flow">
Edges connect nodes. Conditional edges route execution based on state, enabling branching logic.
</Step>
<Step title="State is shared">
All nodes read from and write to a shared state object. This state is what agent() exposes through its signals.
</Step>
</Steps>

## How agent connects

Your Angular app doesn't run the graph — LangGraph Platform does. agent() is the bridge:

1. Your component calls `submit()` with user input
2. FetchStreamTransport sends an HTTP POST to LangGraph Platform
3. The platform runs the graph and streams state updates via SSE
4. agent() updates its Signals as events arrive
5. Angular re-renders your templates automatically

## State design

The generic type parameter in `agent<T>()` defines your agent's state shape.

```typescript
// Simple chat state
agent<{ messages: BaseMessage[] }>({ ... })

// Rich agent state with custom fields
interface AgentState {
  messages: BaseMessage[];
  plan: string[];
  currentStep: number;
  results: Record<string, unknown>;
}
agent<AgentState>({ ... })
```

<Callout type="info" title="Learn more">
For deeper LangGraph concepts (persistence, interrupts, memory), see the individual guide pages.
</Callout>
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/content/docs-v2/concepts/langgraph-basics.mdx
git commit -m "docs(website): write LangGraph Basics concept page"
```

---

### Task 12: Agent Architecture Concept

**Files:**
- Create: `apps/website/content/docs-v2/concepts/agent-architecture.mdx`

- [ ] **Step 1: Write the Agent Architecture page**

```mdx
# Agent Architecture

How AI agents work — the planning, execution, and tool-calling lifecycle that agent() connects your Angular app to.

## The agent loop

An AI agent follows a cycle:

<Steps>
<Step title="Receive input">
The user sends a message via `submit()`. agent() posts it to LangGraph Platform.
</Step>
<Step title="Plan">
The LLM decides what to do next — respond directly, call a tool, or delegate to a subagent.
</Step>
<Step title="Execute">
Tools run (database queries, API calls, code execution). Results feed back into state.
</Step>
<Step title="Respond">
The agent streams its response token-by-token. agent() updates the `messages()` signal in real-time.
</Step>
<Step title="Checkpoint">
State is checkpointed. The agent may loop back to Plan, or finish.
</Step>
</Steps>

## Tool calling

Agents extend their capabilities through tools. agent() tracks tool execution:

```typescript
const agent = agent<AgentState>({
  assistantId: 'research_agent',
});

// Currently executing tools
const tools = computed(() => agent.toolProgress());

// Completed tool calls with results
const completedTools = computed(() => agent.toolCalls());
```

## Multi-agent patterns

Complex tasks use multiple agents working together:

- **Orchestrator** — one agent delegates to specialized subagents
- **Pipeline** — agents process sequentially, each refining the output
- **Debate** — agents review each other's work

agent() supports these patterns through the `subagents()` and `activeSubagents()` signals.

<Callout type="tip" title="Start simple">
Most applications only need a single agent with tools. Add subagents when you need true task delegation with isolated state.
</Callout>
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/content/docs-v2/concepts/agent-architecture.mdx
git commit -m "docs(website): write Agent Architecture concept page"
```

---

### Task 13: State Management Concept

**Files:**
- Create: `apps/website/content/docs-v2/concepts/state-management.mdx`

- [ ] **Step 1: Write the State Management page**

```mdx
# State Management

How state flows through agent() — from LangGraph's server-side state machine to Angular Signals in your templates.

## State lives on the server

Unlike traditional Angular state management (NgRx, signals stores), agent state lives on the LangGraph Platform. Your Angular app is a stateless view layer.

```
LangGraph Platform (source of truth)
  ↓ SSE stream
FetchStreamTransport (transport layer)
  ↓ events
agent() (signal conversion)
  ↓ Signals
Angular templates (reactive rendering)
```

## The state shape

Your state type defines what the agent manages. The `value()` signal exposes the full state object.

```typescript
interface ProjectState {
  messages: BaseMessage[];
  files: string[];
  analysis: { score: number; issues: string[] };
}

const agent = agent<ProjectState>({
  assistantId: 'project_agent',
});

// Access any state field as a reactive value
const files = computed(() => agent.value().files);
const score = computed(() => agent.value().analysis.score);
```

## Thread state vs application state

<Callout type="info" title="Two kinds of state">
Thread state (managed by LangGraph) and application state (managed by Angular) are separate concerns. Don't try to sync them — read thread state from signals, manage UI state with Angular signals.
</Callout>

```typescript
// Thread state — from the agent
const messages = agent.messages();     // Read-only signal
const agentStatus = agent.status();    // Read-only signal

// Application state — your Angular code
const sidebarOpen = signal(true);      // Your UI state
const selectedTab = signal('chat');    // Your UI state
```

## State updates are immutable

Every state update from the agent creates a new signal value. Angular's change detection picks this up automatically.

```typescript
// This works with OnPush because the Signal reference changes
@for (msg of agent.messages(); track $index) {
  <p>{{ msg.content }}</p>
}

// Computed values re-evaluate when dependencies change
const hasErrors = computed(() =>
  agent.value().analysis.issues.length > 0
);
```
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/content/docs-v2/concepts/state-management.mdx
git commit -m "docs(website): write State Management concept page"
```

---

### Task 14: Update Existing Placeholder — Introduction

**Files:**
- Modify: `apps/website/content/docs-v2/getting-started/introduction.mdx`

The existing introduction is decent but needs expansion to match the quality of the other pages. Add more detail about the dual audience and link to all guide pages.

- [ ] **Step 1: Enhance the introduction page**

Replace the full content of `apps/website/content/docs-v2/getting-started/introduction.mdx`:

```mdx
# Introduction

Angular Agent Framework brings full parity with React's `useStream()` hook to Angular 20+. It's the enterprise streaming resource for LangChain and Angular — built natively with Angular Signals, not wrapped or adapted.

<Callout type="info" title="Who is this for?">
Angular Agent Framework serves two audiences: **Angular developers** building AI-powered applications, and **AI/agent developers** who need a production Angular frontend for their LangGraph agents.
</Callout>

## What is agent()?

`agent()` is an Angular function that creates a reactive connection to a LangGraph agent. It returns an object whose properties are Angular Signals — meaning your templates update automatically as the agent streams responses.

```typescript
const chat = agent<{ messages: BaseMessage[] }>({
  assistantId: 'chat_agent',
});

// Every property is a Signal
chat.messages()    // Signal<BaseMessage[]>
chat.status()      // Signal<'idle' | 'loading' | 'resolved' | 'error'>
chat.interrupt()   // Signal<Interrupt | undefined>
chat.history()     // Signal<ThreadState[]>
```

## What you can build

<Steps>
<Step title="Streaming chat interfaces">
Token-by-token streaming with real-time UI updates. Messages arrive as they're generated.
</Step>
<Step title="Human-in-the-loop workflows">
Agents pause for approval, confirmation, or correction. Your UI handles the interrupt and resumes execution.
</Step>
<Step title="Multi-agent dashboards">
Track multiple subagents working in parallel, each with their own message stream and status.
</Step>
<Step title="Time-travel debugging tools">
Inspect agent execution history, fork from checkpoints, and explore alternate paths.
</Step>
</Steps>

## Guides

<CardGroup cols={2}>
  <Card title="Quick Start" href="/docs/getting-started/quickstart">
    Build a chat component in 5 minutes
  </Card>
  <Card title="Installation" href="/docs/getting-started/installation">
    Detailed setup and configuration
  </Card>
  <Card title="Streaming" href="/docs/guides/streaming">
    Token-by-token updates via SSE
  </Card>
  <Card title="Persistence" href="/docs/guides/persistence">
    Thread persistence across sessions
  </Card>
  <Card title="Interrupts" href="/docs/guides/interrupts">
    Human-in-the-loop approval flows
  </Card>
  <Card title="Testing" href="/docs/guides/testing">
    Deterministic testing with MockAgentTransport
  </Card>
</CardGroup>
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/content/docs-v2/getting-started/introduction.mdx
git commit -m "docs(website): enhance Introduction page with expanded content"
```

---

### Task 15: Final Build Verification

- [ ] **Step 1: Build the website**

Run: `npx nx build website --skip-nx-cache 2>&1 | tail -10`
Expected: Build succeeds with all 19 doc pages generated

- [ ] **Step 2: Verify all pages render**

Open each page in the browser and verify content loads:
- http://localhost:3000/docs/getting-started/introduction
- http://localhost:3000/docs/getting-started/quickstart
- http://localhost:3000/docs/getting-started/installation
- http://localhost:3000/docs/guides/streaming (existing)
- http://localhost:3000/docs/guides/persistence
- http://localhost:3000/docs/guides/interrupts
- http://localhost:3000/docs/guides/memory
- http://localhost:3000/docs/guides/time-travel
- http://localhost:3000/docs/guides/subgraphs
- http://localhost:3000/docs/guides/testing
- http://localhost:3000/docs/guides/deployment
- http://localhost:3000/docs/concepts/angular-signals
- http://localhost:3000/docs/concepts/langgraph-basics
- http://localhost:3000/docs/concepts/agent-architecture
- http://localhost:3000/docs/concepts/state-management
- http://localhost:3000/docs/api/angular (existing)

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix(website): docs content polish"
```
