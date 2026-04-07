# Angular Agent Framework — Design Specification

**Date:** 2026-03-17
**Status:** Approved
**Tagline:** The Enterprise Streaming Resource for LangChain and Angular

---

## Overview

Angular Agent Framework is an Angular 20+ library that provides `agent()` — a full-parity implementation of LangGraph's React `useStream()` hook built on the Angular Resource API. It is designed for enterprise teams building production Angular applications on top of LangChain, LangGraph, and LangSmith.

The project is delivered as an Nx monorepo containing:
1. The publishable Angular library (`angular`)
2. A Next.js marketing and documentation website
3. A developer-first GitHub README

---

## 1. Monorepo Structure

**Type:** Nx integrated monorepo

```
angular/
├── libs/
│   └── angular/              # Publishable Angular library
│       ├── src/
│       │   ├── lib/
│       │   │   ├── angular.fn.ts        # agent() entry point
│       │   │   ├── angular.types.ts     # Full public type surface
│       │   │   ├── angular.provider.ts  # provideAgent()
│       │   │   ├── transport/
│       │   │   │   ├── fetch-stream.transport.ts
│       │   │   │   ├── mock-stream.transport.ts
│       │   │   │   └── transport.interface.ts
│       │   │   └── internals/
│       │   │       ├── stream-manager.bridge.ts # StreamManager → RxJS bridge
│       │   │       └── signal-adapters.ts       # toSignal() wrappers
│       │   └── public-api.ts
│       ├── ng-package.json
│       ├── project.json
│       └── vite.config.mts
│
├── apps/
│   ├── website/                      # Next.js App Router site
│   │   ├── app/
│   │   │   ├── page.tsx              # Landing page
│   │   │   ├── pricing/page.tsx      # Pricing page
│   │   │   ├── docs/[[...slug]]/page.tsx
│   │   │   ├── api-reference/page.tsx
│   │   │   └── api/leads/route.ts    # Lead gen form POST handler
│   │   ├── components/
│   │   │   ├── landing/              # Hero, ArchDiagram, FeatureStrip, CodeBlock
│   │   │   ├── pricing/              # PricingGrid, AddOn, CompareTable, LeadForm
│   │   │   ├── docs/                 # DocsSidebar, MdxRenderer, ApiRefTable
│   │   │   └── shared/               # Nav, Footer, InstallStrip
│   │   ├── content/docs/             # Claude-generated narrative MDX
│   │   ├── scripts/
│   │   │   ├── generate-api-docs.ts  # TypeDoc → JSON → MDX
│   │   │   └── generate-narrative-docs.ts  # Claude API → MDX
│   │   ├── public/assets/            # SVG exports (hero, arch diagram)
│   │   └── e2e/                      # Playwright tests
│   │
│   └── demo/                         # Angular demo app (Angular Elements)
│       └── src/
│
├── e2e/
│   ├── angular-e2e/          # Integration tests (real LangGraph server)
│   └── website-e2e/                  # Playwright e2e for website
│
├── docs/
│   ├── superpowers/specs/            # Design specifications
│   └── limitations.md                # Features impossible in Angular
│
├── .github/
│   └── workflows/
│       ├── ci.yml                    # Vitest unit tests on every PR
│       ├── e2e.yml                   # Playwright e2e on main branch merges
│       └── publish.yml               # npm publish on git tag
├── nx.json
├── package.json
└── README.md
```

---

## 2. Angular Library Architecture

### Package

- **npm name:** `angular`
- **Peer dependencies:** `@angular/core ^20.0.0 || ^21.0.0`, `@angular/common ^20.0.0 || ^21.0.0`, `@langchain/langgraph-sdk`
- **Build:** `ng-packagr` via `@nx/angular:package`
- **Tests:** Vitest + jsdom

### Generic Type Parameters

`agent()` mirrors the LangGraph SDK's type system exactly:

```typescript
// BagTemplate — mirrors @langchain/langgraph-sdk BagTemplate
// Allows callers to provide custom types for configurable, interrupt,
// custom events, and update payloads.
type BagTemplate = {
  ConfigurableType?: Record<string, unknown>;
  InterruptType?: unknown;
  CustomEventType?: unknown;
  UpdateType?: unknown;
};

// InferBag<T, Bag> — resolves the Bag against the state type T.
// If T is a typed agent (ReactAgent, CompiledStateGraph), Bag fields
// are inferred from the agent's type parameters. Otherwise Bag is used as-is.
// Mirrors InferBag from @langchain/langgraph-sdk/ui types.
type InferBag<T, Bag extends BagTemplate> = /* mirrors SDK implementation */;
```

Implementers should import `BagTemplate` and `InferBag` directly from `@langchain/langgraph-sdk/ui` and re-export them from `public-api.ts` rather than re-implementing them.

### Public API

#### `agent(options)`

Primary exported function. Must be called within an Angular injection context (component constructor, field initializer, `inject()` call, or `runInInjectionContext()`).

```typescript
export function agent<
  T = Record<string, unknown>,
  Bag extends BagTemplate = BagTemplate
>(
  options: AgentOptions<T, InferBag<T, Bag>>
): AgentRef<T, InferBag<T, Bag>>
```

#### `AgentOptions`

Full parity with `useStream()` options:

| Option | Type | Description |
|---|---|---|
| `apiUrl` | `string` | LangGraph Platform base URL |
| `assistantId` | `string` | Agent/graph identifier |
| `threadId` | `Signal<string \| null>` or `string \| null` | Thread to connect to. Accepts Angular Signal for reactive updates. |
| `onThreadId` | `(id: string) => void` | Callback when a new thread is created |
| `initialValues` | `Partial<T>` | Pre-populate state before first stream |
| `messagesKey` | `string` | State key holding messages (default: `"messages"`) |
| `throttle` | `number \| false` | Throttle rapid updates. Uses `throttleTime(n, asyncScheduler, { leading: true, trailing: true })`. `false` disables throttling. |
| `toMessage` | `(msg) => BaseMessage` | Custom message class converter |
| `transport` | `AgentTransport` | Custom transport, replaces default `FetchStreamTransport` |
| `filterSubagentMessages` | `boolean` | Exclude subagent messages from main `messages` signal |
| `subagentToolNames` | `string[]` | Tool names that identify subagent invocations |

#### `AgentRef<T, Bag>`

Returned object that satisfies Angular's `ResourceRef<T>` interface structurally (duck-typed compatibility — `AgentRef` is not a subclass of `ResourceRef`, it simply implements the same shape). This means it is compatible with any Angular API that accepts `ResourceRef<T>`.

**`ResourceRef<T>` members implemented:**

| Member | Behavior |
|---|---|
| `value()` | Signal returning current state values `T` |
| `status()` | Signal returning `ResourceStatus`: `idle` → not yet submitted, `loading` → stream active, `resolved` → stream complete, `error` → error state |
| `isLoading()` | Derived from `status() === ResourceStatus.Loading` |
| `error()` | Signal returning last error or `undefined` |
| `hasValue()` | `true` once values have been received at least once |
| `reload()` | Re-submits the last `submit()` call with the same values. No-op if no prior submission. |

**Additional `AgentRef` members (streaming-specific):**

```typescript
interface AgentRef<T, Bag> {
  // ── Streaming state ──
  messages:        Signal<BaseMessage[]>
  interrupt:       Signal<Interrupt<Bag['InterruptType']> | undefined>
  interrupts:      Signal<Interrupt<Bag['InterruptType']>[]>
  toolProgress:    Signal<ToolProgress[]>
  toolCalls:       Signal<ToolCallWithResult[]>

  // ── Thread & history ──
  branch:          Signal<string>
  history:         Signal<ThreadState<T>[]>
  isThreadLoading: Signal<boolean>

  // ── Subagents ──
  subagents:       Signal<Map<string, SubagentStreamRef>>
  activeSubagents: Signal<SubagentStreamRef[]>

  // ── Actions ──
  submit:              (values: Bag['UpdateType'] | null, opts?: SubmitOptions) => Promise<void>
  stop:                () => Promise<void>
  switchThread:        (threadId: string | null) => void
  joinStream:          (runId: string, lastEventId?: string) => Promise<void>
  setBranch:           (branch: string) => void
  getMessagesMetadata: (msg: BaseMessage, idx?: number) => MessageMetadata | undefined
  getToolCalls:        (msg: CoreAIMessage) => ToolCallWithResult[]
}
```

#### `StreamSubjects<T>` (internal type, defined in `angular.types.ts`)

All `BehaviorSubject` instances created at construction time are collected into this type and passed to `createStreamManagerBridge`. It is an internal type — not exported from `public-api.ts`.

```typescript
// Defined in: libs/angular/src/lib/angular.types.ts
interface StreamSubjects<T> {
  status$:          BehaviorSubject<ResourceStatus>;
  values$:          BehaviorSubject<T>;
  messages$:        BehaviorSubject<BaseMessage[]>;
  error$:           BehaviorSubject<unknown>;
  interrupt$:       BehaviorSubject<Interrupt | undefined>;
  interrupts$:      BehaviorSubject<Interrupt[]>;
  branch$:          BehaviorSubject<string>;
  history$:         BehaviorSubject<ThreadState<T>[]>;
  isThreadLoading$: BehaviorSubject<boolean>;
  toolProgress$:    BehaviorSubject<ToolProgress[]>;
  toolCalls$:       BehaviorSubject<ToolCallWithResult[]>;
  subagents$:       BehaviorSubject<Map<string, SubagentStreamRef>>;
}
```

`ResourceStatus` is imported from `@angular/core` and **re-exported** from `angular`'s `public-api.ts`. Consumers may import it from either `@angular/core` or `angular` — both are equivalent.

#### `provideAgent(config)`

Optional root-level provider. Configured via `InjectionToken<AgentConfig>`.

```typescript
interface AgentConfig {
  apiUrl?:    string;           // Default apiUrl for all agent() calls
  transport?: AgentTransport; // Default transport (overridable per-call)
}
```

**Note: middleware is not included in v1.** Custom transport is the extension point for request interception (e.g. auth headers, logging). Middleware as a separate concept is deferred to a future version.

### Internal Architecture

#### RxJS Core (key design decision)

All `BehaviorSubject` instances are created once at construction time when `agent()` is called. Dynamic actions (`submit`, `stop`, `switchThread`, `joinStream`) push new values into these existing subjects — they never create new subjects. This is essential because `toSignal()` must be called in the injection context at construction time and cannot be called again later.

`StreamManager` from `@langchain/langgraph-sdk/ui` is wrapped in an RxJS pipeline. This was chosen over `effect()` because:

- `effect()` runs asynchronously and may batch or drop rapid stream events
- Angular explicitly discourages `effect()` for state propagation between signals
- RxJS `BehaviorSubject` gives precise control over event ordering and backpressure
- Operators (`switchMap`, `throttleTime`, `takeUntil`) map cleanly onto streaming lifecycle

**Full construction pattern:**

```typescript
export function agent<T, Bag>(options): AgentRef<T, Bag> {
  // Must be called in injection context
  const destroyRef = inject(DestroyRef);
  const destroy$   = new Subject<void>();
  destroyRef.onDestroy(() => { destroy$.next(); destroy$.complete(); });

  // All subjects created at construction time, before the bridge is created.
  // status$ is a dedicated four-state subject — never derived from loading$ alone.
  //   idle     → initial state, no submit yet
  //   loading  → stream active (bridge sets this when submit() is called)
  //   resolved → stream completed successfully (bridge sets this on stream end)
  //   error    → error received (bridge sets this, paired with error$.next(err))
  // ResourceStatus is imported from '@angular/core' and re-exported from
  // angular's public-api.ts so consumers can import it from either.
  const status$          = new BehaviorSubject<ResourceStatus>(ResourceStatus.Idle);
  const values$          = new BehaviorSubject<T>(options.initialValues ?? {} as T);
  const messages$        = new BehaviorSubject<BaseMessage[]>([]);
  const error$           = new BehaviorSubject<unknown>(undefined);
  const interrupt$       = new BehaviorSubject<Interrupt | undefined>(undefined);
  const interrupts$      = new BehaviorSubject<Interrupt[]>([]);
  const branch$          = new BehaviorSubject<string>('');
  const history$         = new BehaviorSubject<ThreadState<T>[]>([]);
  const isThreadLoading$ = new BehaviorSubject<boolean>(false);
  const toolProgress$    = new BehaviorSubject<ToolProgress[]>([]);
  const toolCalls$       = new BehaviorSubject<ToolCallWithResult[]>([]);
  const subagents$       = new BehaviorSubject<Map<string, SubagentStreamRef>>(new Map());

  // StreamSubjects<T> — all subjects passed to the bridge as a single object.
  // Defined in angular.types.ts (see type definition below).
  const subjects: StreamSubjects<T> = {
    status$, values$, messages$, error$,
    interrupt$, interrupts$, branch$, history$,
    isThreadLoading$, toolProgress$, toolCalls$, subagents$,
  };

  // threadId$ — resolved before the bridge is created (injection context required).
  // isSignal from '@angular/core'; toObservable from '@angular/core/rxjs-interop'.
  // The bridge receives threadId$ and pipes it through switchMap to call
  // switchThread whenever the value changes.
  const threadId$: Observable<string | null> = isSignal(options.threadId)
    ? toObservable(options.threadId)
    : of(options.threadId ?? null);

  // StreamManager bridge — stream-manager.bridge.ts
  // The bridge adapts @langchain/langgraph-sdk/ui's StreamManager callback API
  // to push values into the subjects above. The bridge must inspect the actual
  // SDK source at implementation time — the SDK uses a callback-options pattern
  // but this may vary. The bridge is the only file that directly imports from
  // @langchain/langgraph-sdk/ui internals.
  const manager = createStreamManagerBridge({ options, subjects, threadId$, destroy$ });

  // Apply throttle if configured
  const throttleMs = options.throttle;
  const applyThrottle = <V>(obs$: Observable<V>) =>
    throttleMs
      ? obs$.pipe(throttleTime(throttleMs, asyncScheduler, { leading: true, trailing: true }))
      : obs$;

  // Convert to Angular Signals via rxjs-interop (must happen in injection context)
  const value    = toSignal(applyThrottle(values$),   { initialValue: options.initialValues ?? {} as T });
  const messages = toSignal(applyThrottle(messages$), { initialValue: [] });
  const status   = toSignal(status$, { initialValue: ResourceStatus.Idle });
  const isLoading = computed(() => status() === ResourceStatus.Loading);
  // ... (one toSignal call per subject)

  return {
    value, messages, status, /* ... all signals */,
    submit:       (vals, opts) => manager.submit(vals, opts),
    stop:         ()           => manager.stop(),
    switchThread: (id)         => { isThreadLoading$.next(true); manager.switchThread(id); },
    joinStream:   (id, lastId) => manager.joinStream(id, lastId),
    reload:       ()           => manager.resubmitLast(),
    setBranch:    (b)          => branch$.next(b),
    // ...
  };
}
```

#### `stream-manager.bridge.ts` Contract

This file is the only place that directly calls `@langchain/langgraph-sdk/ui` internals. Its public contract is:

```typescript
interface StreamManagerBridgeOptions<T> {
  options:   AgentOptions<T, any>;
  subjects:  StreamSubjects<T>;       // All BehaviorSubjects (see StreamSubjects<T>)
  threadId$: Observable<string|null>; // Resolved from options.threadId at construction time
  destroy$:  Observable<void>;
}

interface StreamManagerBridge {
  submit:        (values: unknown, opts?: SubmitOptions) => Promise<void>;
  stop:          () => Promise<void>;
  switchThread:  (id: string | null) => void;
  joinStream:    (runId: string, lastEventId?: string) => Promise<void>;
  resubmitLast:  () => Promise<void>;
}

export function createStreamManagerBridge<T>(
  opts: StreamManagerBridgeOptions<T>
): StreamManagerBridge
```

The bridge implementation must inspect the actual `StreamManager` API from `@langchain/langgraph-sdk/ui` at implementation time and adapt its subscription/callback mechanism. The SDK uses a callback-options pattern internally but this may vary — the bridge is the isolation point.

### Testing

#### `MockAgentTransport`

Exported public testing API. Implements `AgentTransport`. Lets consumers write deterministic unit tests.

```typescript
class MockAgentTransport implements AgentTransport {
  // Pass a script of event batches to replay in order
  constructor(script?: StreamEvent[][]) {}

  // Consume and return the next scripted batch (advances the internal queue)
  nextBatch(): StreamEvent[] {}

  // Manually push an arbitrary batch of events
  emit(events: StreamEvent[]): void {}

  // Enqueue an error to be thrown on next stream
  emitError(err: Error): void {}

  // Whether the transport is currently "streaming"
  isStreaming(): boolean {}
}
```

Usage pattern:
```typescript
const transport = new MockAgentTransport([
  [{ type: 'values', values: { messages: [] } }],
  [{ type: 'messages', messages: [humanMsg, aiMsg] }],
]);
const stream = agent({ transport, assistantId: 'test', apiUrl: '' });
// Step through the scripted event sequence one batch at a time:
transport.emit(transport.nextBatch());
transport.emit(transport.nextBatch());
```

**Unit test coverage targets:**
- Initial signal states
- Signal values after `submit()` → stream events → `stop()`
- Error state propagation
- `interrupt` signal set and cleared
- `branch` and `history` updates
- `switchThread` resets state correctly
- `throttle` option reduces update frequency
- `reload()` re-submits last values

**E2E tests (real LangGraph server):**
- Separate `e2e/angular-e2e` project
- Requires a running LangGraph server (Docker Compose config provided at `e2e/docker-compose.yml`)
- Tests the full streaming lifecycle against a real agent

---

## 3. Next.js Website Architecture

### Stack

- **Framework:** Next.js 15, App Router
- **Styling:** Tailwind CSS + custom CSS variables (gold/dark luxury design system)
- **Typography:** EB Garamond (serif headings) + JetBrains Mono (code) + Inter (body)
- **Animations:** Framer Motion for scroll-triggered reveals, SVG `animateMotion` for architecture diagram
- **MDX:** `next-mdx-remote` with syntax highlighting via `shiki`
- **Deployment:** Vercel (monorepo root, `apps/website` as build target via `vercel.json`)

### Pages

| Route | Type | Description |
|---|---|---|
| `/` | Static | Landing page — hero, architecture SVG animation, feature strip, code block |
| `/pricing` | Static | Pricing page — 3 plans, deployment add-on, comparison table, lead gen form |
| `/docs/[slug]` | Static (ISR) | MDX narrative documentation |
| `/api-reference` | Static | TypeDoc-generated API reference |
| `/api/leads` | Dynamic | Lead gen form POST handler |

### Design System

**Colors:**
- Background: `#080705` (near-black)
- Gold accent: `#d4aa6a`
- Text primary: `#f4efe6`
- Text secondary: `#c8b898`
- Text muted: `#7a6e5e`
- Border: `rgba(212,170,106,0.12)`

**Typography scale:**
- Hero headline: 156px EB Garamond 800
- Section titles: 60px EB Garamond 800 + italic pair
- Taglines: 22–30px EB Garamond italic
- Body text: 15px Inter
- Feature descriptions: 14px Inter
- Code: 12px JetBrains Mono
- Labels/eyebrows: 10px JetBrains Mono uppercase

### Live Demo

Angular demo app compiled to Angular Elements (web components), embedded directly in the Next.js landing page (no iframe). The Angular Elements bundle is built separately and loaded as a script tag.

**Agent deployment:** The demo connects to an agent deployed on **LangGraph Platform** (LangGraph Cloud or self-hosted LangGraph Server). Traces are reported to LangSmith for observability. LangSmith itself is not a hosting platform. The `apiUrl` in the demo points to the LangGraph Platform endpoint. CORS must be configured on the LangGraph Platform deployment to allow requests from the Vercel domain.

**Demo hosting:** The Angular Elements JS bundle is served from Vercel alongside the Next.js site (placed in `public/demo/`).

### Documentation Generation

Two-stage pipeline run via `npm run generate-docs`:

1. **`generate-api-docs.ts`** — runs TypeDoc against `libs/angular/src`, outputs structured JSON
2. **`generate-narrative-docs.ts`** — sends TypeDoc JSON + library source to Claude API. Model ID is read from `ANTHROPIC_MODEL` env var, defaulting to `claude-sonnet-4-6`. Generates polished MDX guides committed to `content/docs/`

### Playwright E2E

Coverage:
- Landing page renders hero, architecture diagram, feature strip
- Pricing page shows all three plans and deployment add-on
- Lead gen form validates required fields and submits successfully
- Docs navigation — sidebar links, page transitions, code highlighting renders
- Live demo connects to LangGraph Platform and shows streaming output
- Mobile responsive breakpoints (375px, 768px, 1280px)

### Pricing Model

| Tier | Price | Terms |
|---|---|---|
| Open Source | Free | Non-commercial use only, MIT license |
| Developer Seat | $500/seat/year | Commercial use, 12 months of major/minor/patch releases locked at purchase date |
| Application Deployment | $2,000/app | One-time per application, covers all environments (dev/staging/prod) |
| Enterprise | Custom | Volume seats, unlimited deployments, SLA, dedicated support, custom contract |

---

## 4. README

**Audience:** Senior Angular engineers who know LangChain. 60-second evaluation window.

**Structure:** Hero SVG banner → tagline → badges → 3-sentence pitch → install → 30-second example → feature table → architecture diagram → pricing summary → docs link → license.

**Visual assets:** SVG hero wordmark and architecture diagram generated during website build, exported to `public/assets/`, referenced in README via absolute Vercel URLs.

**License block:** Dual license — MIT for non-commercial, Commercial License for production use. Links to `/pricing`.

---

## 5. Licensing

### License Files

The repository ships two license files:

- **`LICENSE`** — MIT License, with a header clarifying it applies to non-commercial use only
- **`LICENSE-COMMERCIAL`** — Commercial License terms, covering developer seat and deployment license rights

### Definition of Non-Commercial

Non-commercial use is defined in both LICENSE and on the pricing page as:
- Personal projects with no revenue
- Open source projects (any OSI-approved license)
- Academic and research use
- Internal tooling at non-profit organizations

Commercial use (requiring a paid license) is any use where the software:
- Is embedded in a product sold or licensed to third parties
- Is used in a service that generates revenue
- Is used within a for-profit organization's internal tooling

### Enforcement

v1 relies on honor-system compliance. A license key mechanism for CI/CD verification is planned for a future version.

---

## 6. Features Technically Impossible / Degraded in Angular

Documented in `docs/limitations.md`. Each entry follows this format:
- **Feature name**
- **React behavior**
- **Angular behavior / limitation**
- **Workaround (if any)**

Key items:

- **`useSyncExternalStore` concurrent-mode batching** — React's concurrent renderer batches state updates atomically. Angular has no equivalent; rapid stream events handled via RxJS pipeline may produce more intermediate signal updates. Workaround: use the `throttle` option.
- **Server Components** — `agent()` is client-side only. No Angular equivalent of React Server Components exists. No workaround.
- **StrictMode double-invocation** — React's StrictMode invokes hooks twice for side-effect detection. Angular has no equivalent. No impact on behavior; noted for developers porting React test patterns.

---

## 7. CI/CD Pipeline

| Workflow | Trigger | Steps |
|---|---|---|
| `ci.yml` | Every PR and push to `main` | Lint → Vitest unit tests → build library |
| `e2e.yml` | Merge to `main` | Spin up Docker Compose (LangGraph server) → run e2e suite → Playwright website tests |
| `publish.yml` | Git tag `v*` | Build library → `nx-release-publish` → publish `angular` to npm |

Vercel deploys the website automatically on every push to `main` via the Vercel GitHub integration.

---

## 8. Key Dependencies

| Package | Purpose |
|---|---|
| `@langchain/langgraph-sdk` | `StreamManager`, `FetchStreamTransport`, all streaming types |
| `@langchain/core` | `BaseMessage` and message type system |
| `@angular/core` | Signals, `ResourceRef`, DI |
| `@angular/core/rxjs-interop` | `toSignal()` — RxJS → Signal bridge |
| `rxjs` | Internal pub/sub pipeline (`BehaviorSubject`, `throttleTime`, `takeUntil`) |
| `ng-packagr` | Angular library build |
| `@nx/angular` | Monorepo orchestration |
| `vitest` | Unit testing |
| `@playwright/test` | E2E testing |
| `next` | Website framework |
| `framer-motion` | Landing page animations |
| `next-mdx-remote` | MDX rendering for docs |
| `shiki` | Syntax highlighting |
