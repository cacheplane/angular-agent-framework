# Chat Component Library & Angular Renderer Design

**Date:** 2026-04-04
**Status:** Draft
**Scope:** Three deliverables — `@cacheplane/render`, `@cacheplane/chat`, cockpit integration

---

## Overview

Build a rich, extensible Angular chat component library for LangGraph, LangChain, and Deep Agent UIs. The library provides headless primitives for full rendering control and prebuilt Tailwind compositions (shadcn model) for rapid development. Generative UI is powered by a new Angular renderer for `@json-render/core`.

### Deliverables

1. **`@cacheplane/render`** (`libs/render`) — Angular rendering layer for `@json-render/core`
2. **`@cacheplane/chat`** (`libs/chat`) — Chat UI component library built on `@cacheplane/langgraph`
3. **Cockpit integration** — Update capability examples to consume `@cacheplane/chat`

### Architecture: Layered Stack

```
@json-render/core          (peer dep — owned externally)
       ↓
@cacheplane/render         (Angular renderer)
       ↓
@cacheplane/chat           (chat components)
       ↓
cockpit examples           (standalone Angular apps, independently deployed)
       ↑
@cacheplane/langgraph (peer dep — existing library)
```

---

## Deliverable 1: `@cacheplane/render`

### Purpose

Provide the Angular rendering layer for `@json-render/core` specs — the same role `@json-render/react` plays for React. Takes `@json-render/core` as a peer dependency and implements only the Angular-specific rendering pipeline.

### Peer Dependencies

- `@json-render/core`
- `@angular/core`
- `@angular/common`

### Public API

| Export | Type | Description |
|--------|------|-------------|
| `defineAngularRegistry(catalog, componentMap)` | Function | Maps catalog component names to Angular standalone components |
| `RenderSpecComponent` | Component | `<render-spec [spec] [registry] [stateStore]>` — top-level renderer |
| `RenderElementComponent` | Component | Single element renderer + child recursion (exported for advanced use) |
| `provideRender(config)` | Provider | DI defaults for global registry + state store |
| `signalStateStore(initialState?)` | Function | Angular Signal-based `StateStore` implementation |

### Rendering Pipeline

Modeled after hashbrown's proven `ngTemplateOutlet` recursion pattern:

1. `RenderSpecComponent` receives a `Spec` (flat element map with `root` + `elements`)
2. Looks up `root` element, passes to `RenderElementComponent`
3. `RenderElementComponent` resolves element `type` against the Angular registry → gets a standalone component class
4. Uses `NgComponentOutlet` to instantiate the component, passing resolved props as inputs
5. For `children: string[]`, recursively renders each child key via `ngTemplateOutlet` pointing back to the same template
6. Prop expressions (`$state`, `$item`, `$cond`, `$computed`, `$template`) resolved using `@json-render/core`'s `resolveProps()` — wrapped in Angular signals for reactivity
7. Visibility conditions evaluated via `@json-render/core`'s `evaluateVisibility()` — drives `@if` in template
8. Repeat elements handled by iterating the state array and creating `RepeatScope` context per item

### State Management

`signalStateStore()` implements `@json-render/core`'s `StateStore` interface backed by Angular signals:

- `get(path)` → reads from a deep signal tree
- `set(path, value)` → writes to signal, triggers re-render
- `subscribe(listener)` → uses `effect()` internally
- Two-way bindings (`$bindState`, `$bindItem`) map to writable signals

### Streaming Support

- Accepts `@json-render/core`'s `SpecStreamCompiler` output (RFC 6902 patches)
- `RenderSpecComponent` accepts either a static `Spec` or a `Signal<Spec>` that updates as patches arrive
- Partial specs render progressively — elements appear as they stream in
- Fallback rendering for incomplete props during streaming (pattern from hashbrown)

### Performance

- WeakMap caching for component resolution (pattern from hashbrown)
- `OnPush` change detection on all components
- Signal-based reactivity avoids unnecessary re-renders

---

## Deliverable 2: `@cacheplane/chat`

### Purpose

Angular chat component library providing headless primitives and prebuilt Tailwind compositions for LangGraph/LangChain/Deep Agent UIs. Consumer passes a `AgentRef` — the chat library renders from its signals.

### Peer Dependencies

- `@cacheplane/render`
- `@cacheplane/langgraph`
- `@angular/core`
- `@angular/common`
- `@langchain/core` (for `BaseMessage` types)

### Design Principles

- **Consumer owns the `AgentRef`** — chat components accept it as an input, never create it internally
- **Headless primitives** — unstyled, logic-only components with content projection via `ng-template` + structural directives
- **Prebuilt compositions** — styled with Tailwind, following the shadcn model (copy source to customize)
- **Tree-shakeable** — every component is standalone and independently importable
- **Zero framework lock-in** — no state management library required, signals only

### Headless Primitives

| Primitive | Selector | Key Inputs | Description |
|-----------|----------|------------|-------------|
| `ChatMessages` | `<chat-messages>` | `[ref]` | Message list. Content-projects message templates via `messageTemplate` directive. |
| `ChatInput` | `<chat-input>` | `[ref]`, `[submitOnEnter]` | Text input + submit. Emits structured payloads. Supports multiline, file attachments. |
| `ChatThreadList` | `<chat-thread-list>` | `[threads]`, `[activeThreadId]` | Thread sidebar. Content-projects thread item template. |
| `ChatInterrupt` | `<chat-interrupt>` | `[ref]` | Renders when `ref.interrupt()` is defined. Content-projects interrupt action templates. |
| `ChatToolCalls` | `<chat-tool-calls>` | `[ref]`, `[message]` | Tool call name/inputs/results for a message. Content-projects tool call template. |
| `ChatSubagents` | `<chat-subagents>` | `[ref]` | Active subagent lifecycle (pending/running/complete/error). Content-projects subagent template. |
| `ChatTimeline` | `<chat-timeline>` | `[ref]` | Time travel controls. Checkpoint history, fork/replay actions. |
| `ChatGenerativeUi` | `<chat-generative-ui>` | `[spec]`, `[registry]` | Inline json-render spec renderer (wraps `@cacheplane/render`). |
| `ChatTypingIndicator` | `<chat-typing-indicator>` | `[ref]` | Shows when `ref.isLoading()` is true. |
| `ChatError` | `<chat-error>` | `[ref]` | Shows when `ref.error()` is defined. |

### Template Customization Pattern

```typescript
<chat-messages [ref]="chat">
  <ng-template messageTemplate="human" let-message>
    <div class="my-human-msg">{{ message.content }}</div>
  </ng-template>
  <ng-template messageTemplate="ai" let-message let-toolCalls="toolCalls">
    <div class="my-ai-msg">
      {{ message.content }}
      <chat-tool-calls [ref]="chat" [message]="message" />
      <chat-generative-ui [spec]="message.ui" [registry]="myRegistry" />
    </div>
  </ng-template>
</chat-messages>
```

### Prebuilt Compositions (Tailwind / shadcn model)

| Composition | Selector | Composes |
|-------------|----------|----------|
| `Chat` | `<chat>` | Thread sidebar + message list + input + typing indicator + error. Full-featured chat layout. |
| `ChatDebug` | `<chat-debug>` | Messages + debug panel (timeline, state inspector, tool calls, subagents). See dedicated section below. |
| `ChatInterruptPanel` | `<chat-interrupt-panel>` | Styled interrupt UI with accept/edit/respond/ignore actions. |
| `ChatToolCallCard` | `<chat-tool-call-card>` | Collapsible card: tool name, inputs JSON, result, duration. |
| `ChatSubagentCard` | `<chat-subagent-card>` | Lifecycle status badge + nested message stream for a single subagent. |
| `ChatTimelineSlider` | `<chat-timeline-slider>` | Visual checkpoint navigator with fork/replay buttons. |

### Styling Approach

- All compositions use Tailwind utility classes
- CSS custom properties for brand theming (`--chat-primary`, `--chat-surface`, `--chat-border`, etc.)
- Dark mode via Tailwind's `dark:` variant
- Consumers override by editing copied component source or setting CSS vars

### File Structure

```
libs/chat/src/lib/
  primitives/
    chat-messages/
    chat-input/
    chat-interrupt/
    chat-tool-calls/
    chat-subagents/
    chat-timeline/
    chat-generative-ui/
    chat-typing-indicator/
    chat-error/
  compositions/
    chat/
    chat-debug/
    chat-interrupt-panel/
    chat-tool-call-card/
    chat-subagent-card/
    chat-timeline-slider/
  directives/
    message-template.directive.ts
  providers/
    provide-chat.ts
  types/
    chat.types.ts
```

### `<chat-debug>` — Agent Execution Debugger

A collapsible right panel (like browser DevTools) providing deep visibility into LangGraph agent execution. Hidden by default, toggled via input or programmatic control.

#### Component Tree

| Component | Selector | Responsibility |
|-----------|----------|---------------|
| `ChatDebug` | `<chat-debug>` | Top-level shell. Accepts `AgentRef`. Orchestrates sub-components. |
| `DebugTimeline` | `<debug-timeline>` | Vertical checkpoint list with connecting rail. Supports branching for forks. Click to select. |
| `DebugCheckpointCard` | `<debug-checkpoint-card>` | Per-checkpoint: node name, duration badge, token count, type indicator. |
| `DebugDetail` | `<debug-detail>` | Detail panel for selected checkpoint. |
| `DebugStateInspector` | `<debug-state-inspector>` | Expandable JSON tree of full state at checkpoint. |
| `DebugStateDiff` | `<debug-state-diff>` | Inline diff (added/removed/changed) between selected checkpoint and predecessor. |
| `DebugToolCallDetail` | `<debug-tool-call-detail>` | Tool name, input args, output, duration, error state. |
| `DebugLatencyBar` | `<debug-latency-bar>` | Horizontal waterfall bar showing per-node duration. |
| `DebugControls` | `<debug-controls>` | Step forward/back, jump to start/end, fork, replay, export. |
| `DebugSummary` | `<debug-summary>` | Aggregate stats: total tokens, cost estimate, total duration, step count. |

#### Feature Tiers

**Tier 1 — MVP:**
- Checkpoint timeline with node names, timestamps, duration badges
- State inspector (expandable JSON tree at selected checkpoint)
- State diff between adjacent or selected checkpoints
- Tool call detail cards (name, inputs, output, duration, error)
- Message flow with type badges (human/AI/tool/interrupt)
- Collapsible debug panel toggle

**Tier 2 — High Value:**
- Token and cost tracking per checkpoint and aggregate
- Latency waterfall bars per node with TTFT marker for LLM calls
- Time-travel navigation (click checkpoint to jump, step forward/back)
- Interrupt visualization (distinct marker, resume state display)
- Subagent nesting (collapsible tree with depth-based indentation)
- Live/history toggle (auto-follow streaming vs. pinned to checkpoint)

**Tier 3 — Advanced:**
- Fork/replay from any checkpoint with state editor
- Graph overlay visualization (mini DAG of visited nodes)
- Export/import execution traces for bug reports
- Search and filter checkpoints by node type
- Cost attribution tree (own + descendant cost per node)
- Step-through execution mode

#### Key Behaviors

- **Streaming-aware:** New checkpoints append in real-time. "Lock to latest" toggle auto-follows or lets developer pin to historical checkpoint.
- **State diff is the primary debug view** — what changed between checkpoints is the highest-signal information.
- **Branch-aware timeline** — LangGraph forks render as branching paths (like a git graph), not a flat list.
- **Data source:** Reads from `AgentRef.history()` and the existing `@langchain/langgraph-sdk` APIs via angular's transport layer. No direct SDK dependency.

---

## Deliverable 3: Cockpit Integration

### Strategy

Each cockpit capability example remains a **standalone Angular app** with its own backend and LangSmith deployment. The cockpit (React/Next.js) embeds examples via the existing embed strategy. Examples are independently deployable and consumable by developers.

The change is that examples now import `@cacheplane/chat` instead of building chat UI from scratch.

### Capability → Component Mapping

| Capability | Primary Chat Components |
|------------|------------------------|
| `langgraph/streaming` | `<chat>`, `<chat-messages>`, `<chat-input>`, `<chat-typing-indicator>` |
| `langgraph/persistence` | `<chat>`, `<chat-thread-list>` |
| `langgraph/interrupts` | `<chat>`, `<chat-interrupt>`, `<chat-interrupt-panel>` |
| `langgraph/memory` | `<chat>`, `<chat-thread-list>` (cross-thread state) |
| `langgraph/time-travel` | `<chat>`, `<chat-timeline>`, `<chat-timeline-slider>` |
| `langgraph/subgraphs` | `<chat>`, `<chat-subagents>`, `<chat-subagent-card>` |
| `langgraph/durable-execution` | `<chat>`, `<chat-error>` (reconnect/rejoin patterns) |
| `langgraph/deployment-runtime` | `<chat>` (production configuration) |
| `deep-agents/*` | `<chat-debug>` (full debug composition) |

### Validation Purpose

The cockpit examples serve as integration tests and validation for the component library. If every cockpit capability can be expressed with chat primitives, the API surface is sufficient. Gaps discovered here feed back into the chat library spec.

---

## Cross-Cutting Concerns

### Dependency Injection

| Provider | Library | Purpose |
|----------|---------|---------|
| `provideRender(config)` | `@cacheplane/render` | Global registry + default state store |
| `provideChat(config)` | `@cacheplane/chat` | Default render registry for generative UI, theme config |

Providers set DI defaults. All components also accept direct inputs, so providers are optional.

`@cacheplane/chat` does NOT call `provideAgent()` — that is the consumer's responsibility.

### Public API Exports

```
@cacheplane/render
  ├── defineAngularRegistry()
  ├── signalStateStore()
  ├── provideRender()
  ├── RenderSpecComponent
  ├── RenderElementComponent
  └── types (AngularRegistry, SignalStateStore, RenderSpecInputs)

@cacheplane/chat
  ├── Primitives: ChatMessages, ChatInput, ChatThreadList,
  │   ChatInterrupt, ChatToolCalls, ChatSubagents,
  │   ChatTimeline, ChatGenerativeUi, ChatTypingIndicator, ChatError
  ├── Compositions: Chat, ChatDebug, ChatInterruptPanel,
  │   ChatToolCallCard, ChatSubagentCard, ChatTimelineSlider
  ├── Debug: DebugTimeline, DebugCheckpointCard, DebugDetail,
  │   DebugStateInspector, DebugStateDiff, DebugToolCallDetail,
  │   DebugLatencyBar, DebugControls, DebugSummary
  ├── Directives: messageTemplate
  ├── provideChat()
  └── types (ChatConfig, MessageContext, DebugCheckpoint, etc.)
```

### Testing Strategy

| Layer | Approach |
|-------|----------|
| `@cacheplane/render` unit tests | Render json-render specs against a test catalog, assert DOM output. Use json-render/core's existing test specs where applicable. |
| `@cacheplane/chat` unit tests | Use `MockAgentTransport` (exists in angular). Create `AgentRef` with mock data, verify component rendering. |
| `@cacheplane/chat` integration tests | Cockpit examples serve as integration tests — real backend, real LangSmith, real streaming. |
| Debug component tests | Mock `history()` signal with checkpoint fixtures. Verify timeline, state diff, tool call rendering. |

### Angular Version & Patterns

- Angular 20+ (consistent with existing monorepo)
- Standalone components only (no NgModules)
- Signals for all reactive state
- `OnPush` change detection everywhere
- Modern control flow (`@if`, `@for`, `@defer`)
- `input()` / `output()` function-based APIs

---

## Key Decisions Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Architecture | Layered stack | Clean separation, each lib testable in isolation, render usable outside chat |
| @json-render/core | Peer dependency | Keep single source of truth, avoid maintenance drift |
| Rendering pattern | ngTemplateOutlet recursion | Proven pattern from hashbrown, mature and well-understood |
| Component granularity | Headless primitives + prebuilt compositions | Radix + shadcn model — consumers pick their level |
| Generative UI integration | Built-in render host component | `<chat-generative-ui>` wraps @cacheplane/render, peer dep |
| Styling | Tailwind CSS (shadcn model) | Consumers copy/customize source, CSS vars for theming |
| State ownership | Consumer passes AgentRef | Most flexible, consistent with headless philosophy |
| Cockpit examples | Standalone Angular apps, existing embed strategy | Independent deployment, own backend/LangSmith, developer-consumable |
