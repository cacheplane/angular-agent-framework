# Wave 1: LangGraph Capability Examples — Full Design

## Problem

The cockpit has 8 LangGraph capability modules but only Streaming has a working Angular example. The other 7 (Persistence, Durable Execution, Interrupts, Memory, Subgraphs, Time Travel, Deployment Runtime) show placeholder metadata. Developers visiting the cockpit can't see working examples of these critical `agent()` features.

## Goal

Build all 8 LangGraph capability examples end-to-end: Angular demo apps using `agent()`, Python LangGraph backends, tutorial docs, API reference pages, and Playwright e2e tests. All examples share a common chat UI component from `@cacheplane/chat` (built iteratively alongside the first examples).

## Architecture

### Per-Capability Deliverables

Each of the 8 capabilities produces:

```
cockpit/langgraph/{capability}/
├── python/
│   ├── src/
│   │   ├── index.ts          # Capability module (updated: real asset paths)
│   │   └── graph.py          # LangGraph graph definition
│   ├── prompts/
│   │   └── {capability}.md   # System prompt
│   ├── docs/
│   │   └── guide.md          # Tutorial with component tags
│   ├── pyproject.toml         # Python deps
│   ├── langgraph.json         # Deployment config
│   └── .env → ../../.env     # Symlink to root .env
│
└── angular/
    ├── src/
    │   ├── app/
    │   │   ├── {capability}.component.ts   # Demo using agent()
    │   │   └── app.config.ts               # provideAgent()
    │   ├── environments/
    │   │   ├── environment.ts
    │   │   └── environment.development.ts
    │   ├── index.html
    │   ├── main.ts
    │   └── styles.css
    ├── e2e/
    │   └── {capability}.spec.ts   # Playwright tests
    ├── project.json
    ├── package.json
    ├── tsconfig.json
    ├── tsconfig.app.json
    └── proxy.conf.json
```

### Shared Chat Component (`@cacheplane/chat`)

A headful Angular chat component library used by all examples. Built iteratively — starts minimal with the Persistence example, gains features as more capabilities are built.

```
libs/chat/
├── src/
│   ├── index.ts
│   ├── lib/
│   │   ├── chat.component.ts          # Main chat container
│   │   ├── chat-message.component.ts  # Individual message bubble
│   │   ├── chat-input.component.ts    # Input bar + send button
│   │   ├── chat-sidebar.component.ts  # Optional sidebar slot
│   │   └── chat.types.ts              # Types
├── package.json        # @cacheplane/chat
├── ng-package.json
├── project.json
└── tsconfig.lib.json
```

Usage in an example:
```typescript
import { ChatComponent } from '@cacheplane/chat';

@Component({
  imports: [ChatComponent],
  template: `
    <cp-chat
      [messages]="stream.messages()"
      [isLoading]="stream.isLoading()"
      [error]="stream.error()"
      (sendMessage)="stream.submit({ messages: [{ role: 'human', content: $event }] })"
    >
      <!-- Capability-specific sidebar content projected here -->
      <ng-template cpChatSidebar>
        <thread-picker [threads]="threads" (select)="stream.switchThread($event)" />
      </ng-template>
    </cp-chat>
  `,
})
export class PersistenceComponent { ... }
```

### What Each Capability Demonstrates

| Capability | `agent()` Feature | UI Extension | Python Graph Pattern |
|---|---|---|---|
| **Streaming** | `messages()`, `submit()`, `isLoading()` | (base chat) | Single generate node |
| **Persistence** | `switchThread()`, `onThreadId()`, `history()` | Thread picker sidebar | Checkpointer (in-memory) |
| **Interrupts** | `interrupt()`, `interrupts()`, `submit(values)` | Interrupt dialog overlay | `interrupt()` + approval node |
| **Memory** | `value()` (memory in state) | Memory sidebar panel | InMemoryStore |
| **Durable Execution** | `status()`, `error()`, `reload()` | Status timeline + retry button | RetryPolicy + checkpointer |
| **Subgraphs** | `subagents()`, `activeSubagents()` | Subagent activity panel | Parent graph + child subgraph |
| **Time Travel** | `branch()`, `setBranch()`, `history()` | History panel + branch selector | Checkpointer + checkpoint querying |
| **Deployment Runtime** | All signals | Deployment status panel | Standard graph + deployment config |

### Capability Module Updates

Each `index.ts` gets updated with real paths:
```typescript
export const langgraphPersistencePythonModule: CockpitCapabilityModule = {
  id: 'langgraph-persistence-python',
  // ... manifestIdentity ...
  codeAssetPaths: [
    'cockpit/langgraph/persistence/angular/src/app/persistence.component.ts',
    'cockpit/langgraph/persistence/angular/src/app/app.config.ts',
  ],
  backendAssetPaths: [
    'cockpit/langgraph/persistence/python/src/graph.py',
  ],
  docsAssetPaths: ['cockpit/langgraph/persistence/python/docs/guide.md'],
  promptAssetPaths: ['cockpit/langgraph/persistence/python/prompts/persistence.md'],
  runtimeUrl: 'langgraph/persistence',
  devPort: 4301,  // Each capability gets a unique port
};
```

Port assignments:
- Streaming: 4300 (existing)
- Persistence: 4301
- Interrupts: 4302
- Memory: 4303
- Durable Execution: 4304
- Subgraphs: 4305
- Time Travel: 4306
- Deployment Runtime: 4307

### Route Resolution Updates

`route-resolution.ts` needs to import and register all 8 capability modules in the `capabilityModules` array.

### Tutorial Docs Pattern

Each `guide.md` follows the streaming example's structure:
```markdown
# {Capability} with angular

<Summary>...</Summary>
<Prompt>Agentic coding prompt for this capability</Prompt>

<Steps>
<Step title="Configure the provider">...</Step>
<Step title="Create the resource">
  Show the specific agent() usage for this capability
</Step>
<Step title="Bind the template">
  Show capability-specific template bindings
</Step>
<Step title="The LangGraph backend">
  Show the Python graph
</Step>
</Steps>

<Tip>Key insight about this capability</Tip>
<Warning>Common pitfall</Warning>
```

### E2E Test Pattern

Each Playwright test verifies:
1. Angular app renders at `localhost:{port}`
2. Chat input and send button visible
3. Send a message → receive a streamed response
4. Capability-specific assertion (e.g., thread switch works, interrupt dialog appears)

### CI Integration

The existing `deploy-langgraph.yml` workflow's matrix expands to include all 8 capabilities.

## Implementation Order

1. **`libs/chat`** — Minimal chat component (just enough for Persistence example)
2. **Persistence** — First full example after Streaming. Validates the chat lib pattern.
3. **Interrupts** — Adds interrupt dialog to chat. Tests `interrupt()` signal.
4. **Memory** — Adds memory sidebar. Tests `value()` with memory state.
5. **Durable Execution** — Adds status timeline. Tests `error()` + `reload()`.
6. **Subgraphs** — Adds subagent panel. Tests `subagents()` signal.
7. **Time Travel** — Adds history/branch panel. Tests `setBranch()` + `history()`.
8. **Deployment Runtime** — Adds deployment dashboard. Tests all signals.
9. **Route resolution** — Wire all 8 modules into `capabilityModules[]`
10. **Refactor Streaming** — Migrate existing streaming example to use `@cacheplane/chat`

## Out of Scope

- Deep Agents capabilities (Wave 2, separate spec)
- Production deployment of example apps
- Publishing `@cacheplane/chat` to npm (internal for now)
- TypeScript language variants
- Shared Python base module (each graph is independent)
