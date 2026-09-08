import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';

const loadEnvFile = (process as typeof process & { loadEnvFile?: (path?: string) => void }).loadEnvFile;
if (!process.env['ANTHROPIC_API_KEY'] && loadEnvFile && fs.existsSync('.env')) {
  loadEnvFile('.env');
}

const client = new Anthropic();
const MODEL = process.env['ANTHROPIC_MODEL'] ?? 'claude-opus-4-5';

const CURRENT_API_CONTEXT = `You are writing public technical whitepapers for Threadplane Threadplane.

Use only the current API surface:
- Package names are @threadplane/langgraph, @threadplane/render, @threadplane/chat, and @threadplane/ag-ui.
- @threadplane/langgraph exposes provideAgent(), injectAgent(), AgentConfig, LangGraphAgent, MockAgentTransport, FetchStreamTransport, and mockLangGraphAgent().
- injectAgent() returns a runtime-neutral chat surface with messages(), status(), isLoading(), error(), toolCalls(), state(), submit(), stop(), regenerate(), interrupt(), subagents(), and LangGraph-specific langGraph* signals. status() returns only 'idle' | 'running' | 'error'. Use isLoading() for loading UI. interrupt() is AgentInterrupt | undefined on the runtime-neutral surface.
- Configure LangGraph with assistantId and apiUrl. Do not use graphId or url as @threadplane/langgraph option names.
- @threadplane/chat consumes the runtime-neutral Agent contract and exports ChatComponent, ChatMessageListComponent, ChatInputComponent, ChatToolCallsComponent, ChatToolCallCardComponent, and ChatInterruptPanelComponent. The debug-only secondary entry point @threadplane/chat/debug exports ChatDebugComponent. Selectors are <chat>, <chat-message-list>, <chat-input>, <chat-tool-calls>, <chat-tool-call-card>, <chat-interrupt-panel>, and <chat-debug>.
- Chat messages use Message[] from @threadplane/chat for the runtime-neutral surface. Raw LangGraph messages, when needed, are exposed through langGraphMessages().
- Angular examples should wire the adapter once with provideAgent({ assistantId: 'chat', apiUrl, threadId, onThreadId }) in app.config.ts, then retrieve it in a component field initializer with injectAgent(), for example: readonly chat = injectAgent(). Do not call a removed agent() factory. Do not invent a wrapper service around LangGraphAgent.
- @threadplane/render exposes render-spec, defineAngularRegistry(), provideRender(), signalStateStore(), JSON Patch streaming, and A2UI support. Registry examples may pass [registry] directly to <render-spec> or configure provideRender({ registry }).

Never mention legacy names: streamResource, provideStreamResource, AgentRef, MockStreamTransport, createMockStreamResourceRef, createMockAgentRef, injectAgentRef, isStreaming, @cacheplane/angular, @cacheplane/render, @cacheplane/chat, @cacheplane/langgraph, AgentService, or chat-prebuilt.`;

const BANNED_TERMS = [
  'streamResource',
  'provideStreamResource',
  'AgentRef',
  'MockStreamTransport',
  'createMockStreamResourceRef',
  'createMockAgentRef',
  'injectAgentRef',
  'isStreaming',
  '@cacheplane/angular',
  '@cacheplane/render',
  '@cacheplane/chat',
  '@cacheplane/langgraph',
  'AgentService',
  'chat-prebuilt',
  'AIMessage[]',
  'provideRenderRegistry',
  'evaluateComputed',
  'inject(LangGraphAgent)',
  'langGraph.agent',
  'import { ChatDebug }',
  'imports: [ChatDebug]',
  'InterruptState',
  'returns `null`',
];

// ── Config type ──────────────────────────────────────────────────────────
interface WhitepaperConfig {
  id: string;
  title: string;
  subtitle: string;
  eyebrow: string;
  coverGradient: string;
  outputPdf: string;
  outputHtml: string;
  chapters: Array<{ id: string; title: string; prompt: string }>;
}

// ── Whitepaper configs ───────────────────────────────────────────────────
const WHITEPAPERS: Record<string, WhitepaperConfig> = {
  overview: {
    id: 'overview',
    title: 'Threadplane',
    subtitle: 'Production-ready chat, threads, and generative UI for AI agents',
    eyebrow: 'Threadplane · Open source · Angular',
    coverGradient: 'linear-gradient(160deg, #FFFFFF 0%, #F2F2F0 100%)',
    outputPdf: 'apps/website/public/whitepaper.pdf',
    outputHtml: 'apps/website/public/whitepaper-preview.html',
    chapters: [
      {
        id: 'streaming-state',
        title: 'Streaming State Management',
        prompt: `Write a 400-600 word chapter for an engineering white paper titled "Threadplane: Production-ready chat, threads, and generative UI for AI agents".

Chapter topic: Streaming State Management

Context: Angular teams building AI agent applications must wire streaming transports into reactive chat, thread, approval, and generative UI surfaces. Without the right primitives, they end up with custom zone-patching, manual subscription management, and brittle token accumulation logic that breaks under load.

Cover:
- Why streaming state is hard in Angular (zone.js, change detection, timing)
- The Angular signals approach: how injectAgent() exposes messages() as Signal<Message[]>
- How isLoading() lets developers drive loading UI without polling
- Code example: minimal provideAgent() plus injectAgent() setup (TypeScript snippet, 8-12 lines)
- Production checklist item: "Are your message signals OnPush-compatible?"

Tone: Direct, technical, peer-to-peer. No fluff. Audience is senior Angular engineers.`,
      },
      {
        id: 'thread-persistence',
        title: 'Thread Persistence',
        prompt: `Write a 400-600 word chapter for an engineering white paper titled "Threadplane: Production-ready chat, threads, and generative UI for AI agents".

Chapter topic: Thread Persistence

Context: Demos work with ephemeral state. Production agents need conversation history that survives page refreshes, tab switches, and navigation — wired to LangGraph's MemorySaver backend.

Cover:
- Why stateless agent UIs fail in production
- The threadId signal and onThreadId callback pattern
- How to persist threadId to localStorage and restore on mount
- Thread list UI and switching between conversations
- Code example: provideAgent() with a threadId signal plus injectAgent() in the component (8-12 lines)
- Production checklist item: "Does your agent UI resume threads correctly after a browser refresh?"

Tone: Direct, technical, peer-to-peer. No fluff. Audience is senior Angular engineers.`,
      },
      {
        id: 'tool-call-rendering',
        title: 'Tool-Call Rendering',
        prompt: `Write a 400-600 word chapter for an engineering white paper titled "Threadplane: Production-ready chat, threads, and generative UI for AI agents".

Chapter topic: Tool-Call Rendering

Context: LangGraph agents invoke tools mid-stream. The UI needs to show tool execution state in real time — steps appearing as the tool runs, a final result, and collapsible history — without parsing raw SSE events by hand.

Cover:
- What tool call events look like in the raw stream
- Why hand-parsing is fragile and hard to test
- The <chat-tool-calls> headless primitive and <chat-tool-call-card> prebuilt option
- Progressive disclosure: showing steps live, collapsing on completion
- Code example: <chat-tool-call-card> binding (8-12 lines of Angular template)
- Production checklist item: "Do your tool call cards handle partial step state during streaming?"

Tone: Direct, technical, peer-to-peer. No fluff. Audience is senior Angular engineers.`,
      },
      {
        id: 'human-approval-flows',
        title: 'Human Approval Flows',
        prompt: `Write a 400-600 word chapter for an engineering white paper titled "Threadplane: Production-ready chat, threads, and generative UI for AI agents".

Chapter topic: Human Approval Flows (Interrupts)

Context: Production agents that take consequential actions — sending emails, deploying services, modifying data — must pause for human approval before proceeding. This requires a tight loop between LangGraph's interrupt() primitive and Angular UI.

Cover:
- The LangGraph interrupt() and Command.RESUME pattern
- Why polling and custom websocket approaches are brittle
- The interrupt() signal returned by injectAgent() and how it maps to approval state
- <chat-interrupt> headless and <chat-interrupt-panel> prebuilt
- The three approval actions: approve, edit, cancel — and how each maps to a resume command
- Code example: interrupt signal binding (8-12 lines)
- Production checklist item: "Can your agent UI recover gracefully if a user cancels an interrupt?"

Tone: Direct, technical, peer-to-peer. No fluff. Audience is senior Angular engineers.`,
      },
      {
        id: 'generative-ui',
        title: 'Generative UI',
        prompt: `Write a 400-600 word chapter for an engineering white paper titled "Threadplane: Production-ready chat, threads, and generative UI for AI agents".

Chapter topic: Generative UI

Context: The most advanced production agents emit structured UI specs — not just text. A data analysis agent might render a live table. A booking agent might render a reservation form. Without a framework for this, teams either hardcode component logic into the agent or skip the feature entirely.

Cover:
- The onCustomEvent pattern in LangGraph: how agents emit structured data
- The @threadplane/render approach: json-render specs, defineAngularRegistry(), <render-spec>
- How JSON patch streaming enables progressive UI updates (rows appearing as data arrives)
- The registry pattern: decoupling agent from component implementation
- Code example: defineAngularRegistry() registration (8-12 lines)
- Production checklist item: "Can your agent emit UI components without tight coupling to the frontend codebase?"

Tone: Direct, technical, peer-to-peer. No fluff. Audience is senior Angular engineers.`,
      },
      {
        id: 'deterministic-testing',
        title: 'Deterministic Testing',
        prompt: `Write a 400-600 word chapter for an engineering white paper titled "Threadplane: Production-ready chat, threads, and generative UI for AI agents".

Chapter topic: Deterministic Testing

Context: Agent UIs are notoriously hard to test because they depend on live LLM responses. Flaky tests, slow CI, and inability to reproduce edge cases are the main reasons agent UIs ship with low confidence.

Cover:
- Why testing agent components against real LLM APIs is impractical
- The MockAgentTransport approach: scripted event sequences, no server needed
- mockLangGraphAgent(): writable signals you control directly in tests
- How to test streaming, interrupts, tool calls, and generative UI in isolation
- Code example: mockLangGraphAgent() test pattern (10-14 lines)
- Production checklist item: "Do your agent component tests run offline and complete in under 100ms each?"

Tone: Direct, technical, peer-to-peer. No fluff. Audience is senior Angular engineers.`,
      },
    ],
  },

  angular: {
    id: 'angular',
    title: 'The Enterprise Guide to Agent UI in Angular',
    subtitle: 'Ship LangGraph and AG-UI-compatible agents without building the plumbing',
    eyebrow: 'Threadplane · Angular Agent UI Guide',
    coverGradient: 'linear-gradient(160deg, #FFFFFF 0%, #F2F2F0 100%)',
    outputPdf: 'apps/website/public/whitepapers/angular.pdf',
    outputHtml: 'apps/website/public/whitepapers/angular-preview.html',
    chapters: [
      {
        id: 'last-mile-problem',
        title: 'The Last-Mile Problem',
        prompt: `Write a 400-600 word chapter for an engineering white paper titled "The Enterprise Guide to Agent UI in Angular".

Chapter topic: The Last-Mile Problem

Context: Teams have built powerful agent backends with sophisticated graphs, tool calling, memory, and AG-UI-compatible interaction patterns. Then they hit Angular. SSE streams don't integrate cleanly with zone.js. Signals and change detection are at odds with streaming event sequences. The backend works — the frontend gap is real and expensive.

Cover:
- Why SSE + Angular zones is a zone pollution problem, not a configuration problem
- How token streaming conflicts with Angular's synchronous change detection model
- The signal reactivity mismatch: LLM streams are push-based, Angular templates expect pull
- Why existing RxJS patterns from REST don't translate to streaming agent responses
- The cost: teams building custom zone-patch wrappers, token accumulators, and error retry logic from scratch on every project
- The gap between "it works in the demo" and "it's production-safe in Angular"

Tone: Direct, technical, peer-to-peer. No fluff. Audience is senior Angular engineers.`,
      },
      {
        id: 'agent-api',
        title: 'The injectAgent() API',
        prompt: `Write a 400-600 word chapter for an engineering white paper titled "The Enterprise Guide to Agent UI in Angular".

Chapter topic: The injectAgent() API

Context: @threadplane/langgraph exposes an Angular signals-based API for connecting LangGraph agents to Angular components. The core primitive is injectAgent() — an Angular DI helper that returns reactive signals wired directly to the configured agent stream, with no manual subscription management, no zone-patching, and no token accumulation logic.

Cover:
- How injectAgent() returns a LangGraphAgent with typed signals: messages(), isLoading(), error(), interrupt(), and langGraph* raw signals
- The provideAgent() provider and how it configures the agent endpoint and stream transport
- Why the Angular signals design works with OnPush change detection out of the box
- How to bind agent state directly in Angular templates without async pipe or manual subscriptions
- Code example: minimal provideAgent() setup with injectAgent() template binding (10-14 lines)
- The contrast: what the equivalent hand-rolled code looks like vs. injectAgent() in 3 lines

Tone: Direct, technical, peer-to-peer. No fluff. Audience is senior Angular engineers.`,
      },
      {
        id: 'thread-persistence-memory',
        title: 'Thread Persistence & Memory',
        prompt: `Write a 400-600 word chapter for an engineering white paper titled "The Enterprise Guide to Agent UI in Angular".

Chapter topic: Thread Persistence & Memory

Context: Production agent applications are stateful across sessions. Users expect to return to a conversation where they left off. This requires coordinating LangGraph's MemorySaver backend with a frontend that can persist, restore, and switch between threads.

Cover:
- The threadId signal: how it flows from LangGraph's checkpoint system to the Angular frontend
- Persisting threadId to localStorage on creation via the onThreadId callback
- Restoring thread state on component mount: initialThreadId input and what it triggers
- Building a thread list UI: listing stored thread IDs, switching active thread, clearing history
- How LangGraph MemorySaver maps to the frontend thread lifecycle
- Code example: provideAgent() with thread persistence pattern (8-12 lines)
- Production checklist: "Does your thread list handle deleted or expired server-side threads gracefully?"

Tone: Direct, technical, peer-to-peer. No fluff. Audience is senior Angular engineers.`,
      },
      {
        id: 'interrupt-approval-flows',
        title: 'Interrupt & Approval Flows',
        prompt: `Write a 400-600 word chapter for an engineering white paper titled "The Enterprise Guide to Agent UI in Angular".

Chapter topic: Interrupt & Approval Flows

Context: Agents that take real-world actions — sending emails, executing queries, modifying records — must pause for human confirmation. LangGraph's interrupt() primitive enables this on the backend. @threadplane/langgraph surfaces it as a reactive signal, eliminating the need for polling, websockets, or custom resume endpoints.

Cover:
- How LangGraph interrupt() pauses graph execution and what the resume payload looks like
- The interrupt() signal in the agent ref: how it transitions from undefined to an AgentInterrupt object
- Command.RESUME and how the three actions (approve, edit, cancel) each map to different resume payloads
- The <chat-interrupt-panel> prebuilt: approval UI out of the box, no template work needed
- Handling the edge cases: user navigates away mid-interrupt, session expires, cancel with partial state
- Code example: interrupt signal binding with approve/cancel handlers (8-12 lines)

Tone: Direct, technical, peer-to-peer. No fluff. Audience is senior Angular engineers.`,
      },
      {
        id: 'full-langgraph-coverage',
        title: 'Full LangGraph Feature Coverage',
        prompt: `Write a 400-600 word chapter for an engineering white paper titled "The Enterprise Guide to Agent UI in Angular".

Chapter topic: Full LangGraph Feature Coverage

Context: Most Angular LLM integrations support basic chat. @threadplane/langgraph is designed for the full LangGraph feature surface: tool calls, subgraphs, time travel, and DeepAgent multi-agent coordination. Teams shouldn't have to drop down to raw SSE parsing to access advanced graph features.

Cover:
- Tool call streaming: how tool invocation events surface through the agent ref without manual parsing
- Subgraph support: how nested graph events bubble through the stream and into Angular signals
- Time travel: rewinding graph state to a prior checkpoint and re-streaming from that point
- DeepAgent: what multi-agent coordination looks like at the stream level and how it maps to Angular signals
- The onCustomEvent hook: consuming structured non-message agent output (for generative UI, analytics, etc.)
- Why full coverage matters: avoiding the pattern where teams bypass the library for advanced features

Tone: Direct, technical, peer-to-peer. No fluff. Audience is senior Angular engineers.`,
      },
      {
        id: 'deterministic-testing-angular',
        title: 'Deterministic Testing',
        prompt: `Write a 400-600 word chapter for an engineering white paper titled "The Enterprise Guide to Agent UI in Angular".

Chapter topic: Deterministic Testing

Context: Angular component tests for agent UIs are only useful if they run fast, offline, and deterministically. Real LLM calls in tests mean slow CI, flaky outcomes, and inability to reproduce specific edge cases like interrupted streams or tool call errors.

Cover:
- MockAgentTransport: scripting a deterministic sequence of SSE events without a server
- mockLangGraphAgent(): directly controlling signal values in Angular component tests
- How to test each agent state: streaming in progress, stream complete, interrupt pending, error state
- Testing tool call rendering, generative UI output, and thread switching in isolation
- TestBed setup with MockAgentTransport (8-12 lines)
- The benchmark: agent component tests should run offline and complete in under 100ms each

Tone: Direct, technical, peer-to-peer. No fluff. Audience is senior Angular engineers.`,
      },
    ],
  },

  render: {
    id: 'render',
    title: 'The Enterprise Guide to Generative UI in Angular',
    subtitle: 'Agents that render UI — without coupling to your frontend',
    eyebrow: '@threadplane/render · Enterprise Guide',
    coverGradient: 'linear-gradient(160deg, #FFFFFF 0%, #F2F2F0 100%)',
    outputPdf: 'apps/website/public/whitepapers/render.pdf',
    outputHtml: 'apps/website/public/whitepapers/render-preview.html',
    chapters: [
      {
        id: 'coupling-problem',
        title: 'The Coupling Problem',
        prompt: `Write a 400-600 word chapter for an engineering white paper titled "The Enterprise Guide to Generative UI in Angular".

Chapter topic: The Coupling Problem

Context: When agents emit structured output that needs to become UI, the naive approach is to hardcode the mapping in the frontend: inspect the agent output, switch on a type field, render a component. This works for demos. In production, it means every agent capability change requires a frontend deploy, component library changes leak into agent prompts, and iteration speed collapses.

Cover:
- The antipattern: ngSwitch on agent output type hardcoded in every consuming component
- Why this creates a bidirectional dependency between agent logic and frontend implementation
- The real cost: frontend engineers become blockers on every agent capability change
- How this pattern breaks at scale — multiple agents, multiple frontends, multiple teams
- What a decoupled architecture looks like: agents emit UI specs, frontends interpret them
- The open standard opportunity: why this needs a shared spec, not a proprietary format

Tone: Direct, technical, peer-to-peer. No fluff. Audience is senior Angular engineers.`,
      },
      {
        id: 'json-render-standard',
        title: 'Declarative UI Specs & the json-render Standard',
        prompt: `Write a 400-600 word chapter for an engineering white paper titled "The Enterprise Guide to Generative UI in Angular".

Chapter topic: Declarative UI Specs & the json-render Standard

Context: Vercel's json-render spec defines a framework-agnostic standard for describing UI as structured JSON. An agent emits a json-render document. A frontend interprets it. Neither side knows how the other is implemented. @threadplane/render implements this standard for Angular, with streaming JSON patch support on top.

Cover:
- What a json-render document looks like: component name, props, children (concrete example)
- Why an open standard matters: portability across frameworks, LLM prompt stability, community tooling
- How the spec handles conditional rendering, iteration, and computed properties
- Google's A2UI spec and how it extends json-render for agent-specific patterns
- The @threadplane/render implementation: <render-spec> directive consumes a json-render document
- How LLMs generate valid json-render output: prompt patterns that produce spec-compliant JSON

Tone: Direct, technical, peer-to-peer. No fluff. Audience is senior Angular engineers.`,
      },
      {
        id: 'component-registry',
        title: 'The Component Registry',
        prompt: `Write a 400-600 word chapter for an engineering white paper titled "The Enterprise Guide to Generative UI in Angular".

Chapter topic: The Component Registry

Context: A json-render document references components by name. The registry is what maps those names to actual Angular components. defineAngularRegistry() is the @threadplane/render API for declaring this mapping — it's the seam between the open standard and your specific component library.

Cover:
- How defineAngularRegistry() maps string component names to Angular component classes
- Providing the registry directly to <render-spec> or via provideRender({ registry }) for dependency injection
- The <render-spec> directive: how it resolves component names at render time
- Input mapping: how json-render props become Angular @Input() bindings
- Handling unknown component names: fallback rendering and error boundaries
- Code example: defineAngularRegistry() with 3-4 registered components (10-14 lines)
- Registry versioning: how to handle spec evolution without breaking existing renders

Tone: Direct, technical, peer-to-peer. No fluff. Audience is senior Angular engineers.`,
      },
      {
        id: 'streaming-json-patches',
        title: 'Streaming JSON Patches',
        prompt: `Write a 400-600 word chapter for an engineering white paper titled "The Enterprise Guide to Generative UI in Angular".

Chapter topic: Streaming JSON Patches

Context: Generative UI is most powerful when it streams. A data table with 50 rows should appear progressively — rows rendering as the agent produces them, not after a 3-second wait for the full JSON payload. @threadplane/render uses JSON Patch (RFC 6902) to apply incremental updates to the UI spec as it streams, enabling skeleton states and progressive rendering.

Cover:
- Why streaming full JSON documents on each update is impractical for large UI specs
- JSON Patch RFC 6902: add, replace, remove operations on a JSON document
- How the agent emits patch operations instead of full spec replacements
- Partial-JSON parsing: rendering valid portions of an incomplete JSON stream
- Skeleton states: how to show placeholder UI while the spec is still arriving
- Code example: consuming streaming patch events in a @threadplane/render component (8-12 lines)
- Performance: why patch-based updates are O(change) not O(spec size)

Tone: Direct, technical, peer-to-peer. No fluff. Audience is senior Angular engineers.`,
      },
      {
        id: 'state-management-computed',
        title: 'State Management & Computed Functions',
        prompt: `Write a 400-600 word chapter for an engineering white paper titled "The Enterprise Guide to Generative UI in Angular".

Chapter topic: State Management & Computed Functions

Context: Static UI specs only go so far. Production generative UI needs computed properties — values derived from other spec fields — and repeat loops for rendering collections. @threadplane/render's signalStateStore() and computed function support bring dynamic behavior into the spec without requiring custom component logic.

Cover:
- signalStateStore(): agent-managed state that components can read and update
- Computed properties in the json-render spec: expressions evaluated at render time
- Repeat loops: iterating over spec arrays to render collections of components
- How computed functions let agents define derived UI state declaratively
- The boundary between spec-level logic and component-level logic — where to draw the line
- Code example: signalStateStore() with computed properties in a spec (8-12 lines)
- Testing computed behavior by driving signalStateStore() state and asserting the rendered <render-spec> output. Do not cite a separate testing helper API.

Tone: Direct, technical, peer-to-peer. No fluff. Audience is senior Angular engineers.`,
      },
    ],
  },

  chat: {
    id: 'chat',
    title: 'The Enterprise Guide to Agent Chat Interfaces in Angular',
    subtitle: 'Production agent chat UI in days, not sprints',
    eyebrow: '@threadplane/chat · Enterprise Guide',
    coverGradient: 'linear-gradient(160deg, #FFFFFF 0%, #F2F2F0 100%)',
    outputPdf: 'apps/website/public/whitepapers/chat.pdf',
    outputHtml: 'apps/website/public/whitepapers/chat-preview.html',
    chapters: [
      {
        id: 'sprint-tax',
        title: 'The Sprint Tax',
        prompt: `Write a 400-600 word chapter for an engineering white paper titled "The Enterprise Guide to Agent Chat Interfaces in Angular".

Chapter topic: The Sprint Tax

Context: Every team building an Angular agent application eventually builds the same chat UI from scratch: message list, input box, streaming token display, auto-scroll, loading states, error handling. It takes 4-6 weeks. Then they iterate on it for another 4-6 weeks. Meanwhile, the agent backend is ready and waiting.

Cover:
- The inventory of things every chat UI needs: message rendering, streaming display, tool call cards, interrupt panels, auto-scroll, accessibility, mobile layout
- Why building this from scratch on every project is a structural inefficiency, not a skill gap
- The hidden costs: accessibility is harder than it looks, streaming token display has edge cases, tool call state machines are complex
- What "good enough for demo" looks like vs. what production chat UI actually requires
- The opportunity cost: senior Angular engineers spending sprints on chat chrome instead of agent integration
- The @threadplane/chat thesis: ship the chat UI on day one, spend the sprints on what differentiates your product

Tone: Direct, technical, peer-to-peer. No fluff. Audience is senior Angular engineers.`,
      },
      {
        id: 'batteries-included-components',
        title: 'Batteries-Included Components',
        prompt: `Write a 400-600 word chapter for an engineering white paper titled "The Enterprise Guide to Agent Chat Interfaces in Angular".

Chapter topic: Batteries-Included Components

Context: @threadplane/chat ships two tiers of components: headless primitives that own behavior and state with no styling opinions, and prebuilt components that are production-ready out of the box. Teams choose the tier that matches their customization needs.

Cover:
- The headless tier: chat-messages, chat-input, chat-tool-calls, chat-interrupt — behavior without styling
- The prebuilt composition tier: <chat> plus companion components for a full chat interface with minimal configuration
- How the two tiers compose: using prebuilt for 90% of UI, dropping to headless for custom sections
- The component model: how @threadplane/chat connects to the runtime-neutral Agent contract from @threadplane/langgraph
- Message rendering: how Message[] from the agent signal maps to chat message display
- Code example: <chat> with an agent instance (6-10 lines)
- When to use headless vs. prebuilt and how to migrate between them

Tone: Direct, technical, peer-to-peer. No fluff. Audience is senior Angular engineers.`,
      },
      {
        id: 'theming-design-system',
        title: 'Theming & Design System Integration',
        prompt: `Write a 400-600 word chapter for an engineering white paper titled "The Enterprise Guide to Agent Chat Interfaces in Angular".

Chapter topic: Theming & Design System Integration

Context: Chat UI that looks like a generic chatbot is a product liability. Enterprise teams need chat components that match their design system — typography, color palette, border radius, spacing. @threadplane/chat uses CSS custom properties and design tokens to make this integration straightforward without requiring component source access.

Cover:
- The CSS custom property API: how @threadplane/chat exposes design decisions as variables
- Design token mapping: aligning chat component tokens with your existing design system tokens
- Typography integration: font family, size scale, and line height control
- Color system integration: surface colors, text colors, accent colors, and semantic state colors
- Dark mode: how the token system supports light/dark switching without component changes
- Code example: CSS custom property overrides for a custom brand (10-15 lines of CSS)
- What cannot be themed via tokens — and when to drop to the headless tier instead

Tone: Direct, technical, peer-to-peer. No fluff. Audience is senior Angular engineers.`,
      },
      {
        id: 'generative-ui-chat',
        title: 'Generative UI in Chat',
        prompt: `Write a 400-600 word chapter for an engineering white paper titled "The Enterprise Guide to Agent Chat Interfaces in Angular".

Chapter topic: Generative UI in Chat

Context: The most capable agent chat interfaces don't just display text — they render agent-generated UI directly in the message stream. A financial agent renders a live data table. A scheduling agent renders a booking form. @threadplane/chat supports both the json-render spec and Google's A2UI spec out of the box, with streaming patch support.

Cover:
- How generative UI messages appear in the chat message stream alongside text messages
- The json-render spec: how agents emit structured UI specs that chat renders automatically
- Google's A2UI spec: what it adds for agent-specific UI patterns (actions, approvals, structured data)
- How @threadplane/chat integrates with @threadplane/render for component resolution
- The registry pattern in a chat context: registering custom components that agents can emit
- Code example: enabling generative UI in chat with a component registry (8-12 lines)
- Progressive rendering: how streaming JSON patches create the live UI update effect in chat

Tone: Direct, technical, peer-to-peer. No fluff. Audience is senior Angular engineers.`,
      },
      {
        id: 'debug-tooling',
        title: 'Debug Tooling',
        prompt: `Write a 400-600 word chapter for an engineering white paper titled "The Enterprise Guide to Agent Chat Interfaces in Angular".

Chapter topic: Debug Tooling

Context: Debugging agent chat is hard. The message stream is opaque, tool call state transitions are fast, and interrupt flows have timing edge cases. chat-debug is @threadplane/chat/debug's built-in debug panel — a developer overlay that surfaces agent state, raw message events, tool call history, and interrupt state in real time.

Cover:
- What chat-debug shows: Message[] state, streaming event log, tool call state machine, interrupt payload
- How to add chat-debug to any chat interface: one component, zero configuration in dev mode
- Inspecting individual messages: expanding message content, viewing message type and metadata
- Tool call debugging: seeing tool name, input payload, output, and execution timing
- Interrupt state inspection: viewing the full interrupt payload before and after user action
- Integration with Angular DevTools: how agent signals appear in the component tree
- Production safety: how chat-debug strips itself from production builds

Tone: Direct, technical, peer-to-peer. No fluff. Audience is senior Angular engineers.`,
      },
    ],
  },
};

// ── Brand ────────────────────────────────────────────────────────────────
/**
 * The ATC palette, as the website resolves it (libs/design-tokens light theme).
 *
 * The one hard rule: `SIGNAL` is aviation yellow at 1.84:1 on white, so it is
 * a FILL and never type — no labels, no thin rules anyone has to read a word
 * off. Emphasis ink is `ACCENT` (scope navy, 15.37:1 on white).
 *
 * `DISPLAY` is Archivo Black, which ships a SINGLE weight (400) and has no
 * italic. Never pair it with `font-weight` or `font-style`: the browser
 * synthesizes both and smears an already-black face. `BODY` (Archivo) is the
 * family that owns weight and a real italic.
 */
const BRAND = {
  DISPLAY: `'Archivo Black','Archivo',sans-serif`,
  BODY: `'Archivo',sans-serif`,
  MONO: `'JetBrains Mono',monospace`,
  INK: '#0A0A0A',
  INK_SECONDARY: '#464646',
  INK_MUTED: '#737373',
  ACCENT: '#15253E',
  SIGNAL: '#FFAF00',
  BORDER: '#E5E5E5',
} as const;

/**
 * The one yellow device in the document: a short fill sitting under a
 * page-opening heading. Repeated on the cover, the contents page, and every
 * chapter opener, so the brand signs each page break without ever becoming
 * type or a wall of colour.
 */
const signalRule = (width: number) =>
  `<div style="width:${width}px;height:6px;background:${BRAND.SIGNAL}"></div>`;

// ── Markdown to HTML converter ───────────────────────────────────────────
/**
 * Escape the characters that would otherwise be parsed as markup.
 *
 * Load-bearing for code spans: the prose is full of Angular element names like
 * `<chat-message-list>`. Unescaped, the browser parses those as unknown
 * elements — which render as NOTHING — so the shipped PDF read "` ` manages
 * scroll position" with the component name silently gone.
 */
function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function mdToHTML(md: string): string {
  // Fenced blocks are lifted out first so their contents are escaped exactly
  // once and never re-processed by the inline rules below.
  const fenced: string[] = [];
  const withoutFences = md.replace(
    /```[\w]*\n([\s\S]*?)```/g,
    (_match, code: string) => {
      fenced.push(`<pre><code>${escapeHtml(code)}</code></pre>`);
      return `\u0000FENCE${fenced.length - 1}\u0000`;
    },
  );

  return withoutFences
    // Inline code. Without this the backticks survived verbatim into the PDF
    // and anything angle-bracketed inside them vanished.
    .replace(/`([^`\n]+)`/g, (_match, code: string) => `<code>${escapeHtml(code)}</code>`)
    // The model restates the chapter title as a top-level heading. The chapter
    // opener already renders that title, so an `<h1>` here would duplicate it —
    // and leaving `# ` unhandled leaked a literal hash into the body text.
    .replace(/^# .+$/gm, '')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>[^\n]+<\/li>\n?)+/g, match => `<ul>${match}</ul>`)
    .split('\n\n')
    .map(block => {
      if (block.startsWith('<h') || block.startsWith('<ul') || block.startsWith('<pre')) return block;
      const trimmed = block.trim();
      return trimmed ? `<p>${trimmed}</p>` : '';
    })
    .join('\n')
    .replace(/\u0000FENCE(\d+)\u0000/g, (_match, index: string) => fenced[Number(index)]);
}

// ── HTML builder ─────────────────────────────────────────────────────────
/**
 * A chapter carries either the model's markdown (`content`) or body HTML that
 * has already been converted (`bodyHTML`, from `--rerender`).
 */
interface RenderedChapter {
  title: string;
  content?: string;
  bodyHTML?: string;
}

function buildHTML(chapters: RenderedChapter[], config: WhitepaperConfig): string {
  const tocHTML = chapters.map((ch, i) => `
    <div style="display:flex;align-items:baseline;gap:12px;padding:11px 0;border-bottom:1px solid ${BRAND.BORDER};font-size:15px;color:${BRAND.INK}">
      <span style="font-family:${BRAND.MONO};font-size:11px;color:${BRAND.ACCENT};font-weight:700;min-width:26px">${String(i + 1).padStart(2, '0')}</span>
      <span style="flex:1">${ch.title}</span>
    </div>`).join('');

  const chaptersHTML = chapters.map((ch, i) => `
    <section style="padding:80px;page-break-before:always">
      <div style="font-family:${BRAND.MONO};font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:${BRAND.ACCENT};font-weight:700;margin-bottom:16px">Chapter ${String(i + 1).padStart(2, '0')}</div>
      <h2 style="font-family:${BRAND.DISPLAY};font-size:32px;color:${BRAND.INK};margin-bottom:18px;line-height:1.15;letter-spacing:-0.01em">${ch.title}</h2>
      ${signalRule(72)}
      <div class="chapter-body" style="margin-top:30px">${ch.bodyHTML ?? mdToHTML(ch.content ?? '')}</div>
    </section>`).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Archivo:ital,wght@0,400;0,600;0,700;1,400&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:${BRAND.BODY};color:${BRAND.INK};background:#fff}
  .chapter-body p{font-size:15px;line-height:1.75;color:${BRAND.INK};margin-bottom:18px}
  /* Archivo Black is single-weight with no italic — no font-weight/font-style here. */
  .chapter-body h3{font-family:${BRAND.DISPLAY};font-size:19px;color:${BRAND.INK};margin:30px 0 12px;letter-spacing:-0.005em}
  .chapter-body ul{margin:0 0 18px 20px}
  .chapter-body li{font-size:15px;line-height:1.7;color:${BRAND.INK};margin-bottom:6px}
  .chapter-body pre{background:${BRAND.ACCENT};color:#EDEFF3;padding:20px 24px;border-radius:8px;font-size:13px;line-height:1.65;overflow-x:auto;margin:24px 0;white-space:pre-wrap}
  .chapter-body code{font-family:${BRAND.MONO};font-size:13px}
  /* Navy carries emphasis; yellow never becomes type. */
  .chapter-body strong{font-weight:700;color:${BRAND.ACCENT}}
</style>
</head>
<body>

<!-- Cover -->
<div style="height:100vh;display:flex;flex-direction:column;justify-content:flex-end;padding:80px 80px 100px;background:${config.coverGradient};page-break-after:always">
  <div style="font-family:${BRAND.MONO};font-size:11px;text-transform:uppercase;letter-spacing:0.12em;color:${BRAND.ACCENT};font-weight:700;margin-bottom:24px">${config.eyebrow}</div>
  <!-- Wrapped on a measure rather than one word per line: Archivo Black is
       heavy enough that a forced break per word leaves orphans ("to", "in")
       and turns the cover into a slab. -->
  <h1 style="font-family:${BRAND.DISPLAY};font-size:46px;line-height:1.08;letter-spacing:-0.015em;color:${BRAND.INK};max-width:560px;margin-bottom:26px">${config.title}</h1>
  ${signalRule(132)}
  <p style="font-family:${BRAND.BODY};font-style:italic;font-size:19px;line-height:1.5;color:${BRAND.INK_SECONDARY};margin:26px 0 40px">${config.subtitle}</p>
  <div style="font-size:13px;color:${BRAND.INK_MUTED};font-family:${BRAND.MONO}">threadplane.ai · ${new Date().getFullYear()}</div>
</div>

<!-- TOC -->
<div style="padding:80px;page-break-after:always">
  <h2 style="font-family:${BRAND.DISPLAY};font-size:32px;color:${BRAND.INK};margin-bottom:18px;letter-spacing:-0.01em">Contents</h2>
  ${signalRule(72)}
  <div style="margin-top:30px">${tocHTML}</div>
</div>

<!-- Chapters -->
${chaptersHTML}

</body>
</html>`;
}

// ── PDF renderer ─────────────────────────────────────────────────────────
async function renderPDF(html: string, outputPath: string): Promise<void> {
  console.log('  Launching browser for PDF render...');
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.pdf({
    path: outputPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
  });
  await browser.close();
}

// ── Chapter generator ────────────────────────────────────────────────────
async function generateChapter(
  chapter: WhitepaperConfig['chapters'][0],
): Promise<string> {
  console.log(`  Generating: ${chapter.title}...`);
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: CURRENT_API_CONTEXT,
    messages: [{ role: 'user', content: chapter.prompt }],
  });
  const content = message.content[0];
  if (content.type !== 'text') throw new Error(`Unexpected content type: ${content.type}`);
  const banned = BANNED_TERMS.filter(term => content.text.includes(term));
  if (banned.length) {
    throw new Error(`Generated chapter "${chapter.title}" included stale API terms: ${banned.join(', ')}`);
  }
  return content.text;
}

// ── Re-render (no model calls) ───────────────────────────────────────────
/**
 * Pull the chapter titles and body HTML back out of a committed preview.
 *
 * `--rerender` exists because the document's design and its prose change on
 * different clocks. When the brand moves, the artifact a lead downloads has to
 * move with it — but the chapters were already written and reviewed, so paying
 * the model to write new ones would swap a design change for a content change
 * nobody asked for. This reads the committed HTML and pours the same words
 * into the current template.
 */
function readCommittedChapters(htmlPath: string): RenderedChapter[] {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const sections = html.match(/<section [^>]*page-break-before:always[^>]*>[\s\S]*?<\/section>/g) ?? [];

  return sections.map(section => {
    const title = /<h2[^>]*>([\s\S]*?)<\/h2>/.exec(section)?.[1]?.trim();
    const body = /<div class="chapter-body"[^>]*>([\s\S]*)<\/div>\s*<\/section>/.exec(section)?.[1];
    if (!title || body == null) {
      throw new Error(`Could not parse a chapter out of ${htmlPath}`);
    }
    // Older runs leaked the model's restated `# Title` into the body as literal
    // text, directly beneath the heading that already says it. Drop it.
    const cleaned = body.replace(/^\s*<p>#\s[^<]*<\/p>\s*/, '');
    // Older runs had no inline-code rule, so markdown spans survived as literal
    // backticks AND their angle-bracketed contents were parsed as unknown
    // elements, which render as nothing. `<chat-message-list>` therefore
    // reached the reader as an empty pair of backticks. The source text is
    // still here, so repair it on the way through rather than leaving a
    // published document with words missing from it.
    const withCodeSpans = cleaned.replace(
      /`([^`\n]+)`/g,
      (_match, code: string) => `<code>${escapeHtml(code)}</code>`,
    );
    // Older runs split paragraphs AFTER building fenced blocks, so any code
    // sample containing a blank line was torn in two and its second half
    // wrapped in a <p> — which also left the sample's own markup unescaped, so
    // lines like `<chat [agent]="agent" />` were parsed as unknown elements and
    // vanished from the page. Stitch those blocks back together and escape
    // them. Unescaping first keeps this idempotent across re-runs.
    const withRepairedFences = withCodeSpans.replace(
      /<pre><code>([\s\S]*?)<\/code><\/pre>(?:\s*<\/p>)?/g,
      (_match, code: string) => {
        const stitched = code.replace(/<\/?p>/g, '');
        const raw = stitched
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&');
        return `<pre><code>${escapeHtml(raw)}</code></pre>`;
      },
    );
    return { title, bodyHTML: withRepairedFences.trim() };
  });
}

async function rerenderWhitepaper(config: WhitepaperConfig): Promise<void> {
  console.log(`\n── ${config.id} (re-render) ──────────────────────────`);
  if (!fs.existsSync(config.outputHtml)) {
    throw new Error(`No committed preview to re-render at ${config.outputHtml}`);
  }

  const chapters = readCommittedChapters(config.outputHtml);
  console.log(`  Recovered ${chapters.length} chapters from ${config.outputHtml}`);

  const html = buildHTML(chapters, config);
  fs.writeFileSync(config.outputHtml, html, 'utf8');
  console.log(`  HTML preview: ${config.outputHtml}`);

  await renderPDF(html, config.outputPdf);
  const stat = fs.statSync(config.outputPdf);
  console.log(`  PDF saved to ${config.outputPdf} (${Math.round(stat.size / 1024)}KB)`);
}

// ── Single whitepaper runner ─────────────────────────────────────────────
async function generateWhitepaper(config: WhitepaperConfig): Promise<void> {
  console.log(`\n── ${config.id} ─────────────────────────────────────`);
  console.log(`Title: ${config.title}`);
  console.log(`Output: ${config.outputPdf}\n`);

  const generatedChapters: Array<{ title: string; content: string }> = [];

  for (const chapter of config.chapters) {
    const content = await generateChapter(chapter);
    generatedChapters.push({ title: chapter.title, content });
  }

  console.log('\nBuilding HTML document...');
  const html = buildHTML(generatedChapters, config);
  fs.mkdirSync(path.dirname(config.outputHtml), { recursive: true });
  fs.writeFileSync(config.outputHtml, html, 'utf8');
  console.log(`  HTML preview: ${config.outputHtml}`);

  console.log('Rendering PDF...');
  fs.mkdirSync(path.dirname(config.outputPdf), { recursive: true });
  await renderPDF(html, config.outputPdf);

  const stat = fs.statSync(config.outputPdf);
  console.log(`  PDF saved to ${config.outputPdf} (${Math.round(stat.size / 1024)}KB)`);
}

// ── Main ─────────────────────────────────────────────────────────────────
async function main() {
  const rerender = process.argv.includes('--rerender');

  console.log('Threadplane White Paper Generator\n');
  console.log(rerender ? 'Mode: re-render committed prose (no model calls)' : `Model: ${MODEL}`);

  const run = rerender ? rerenderWhitepaper : generateWhitepaper;

  const paperArg = process.argv.find(a => a.startsWith('--paper='))?.split('=')[1]
    ?? (process.argv.includes('--paper') ? process.argv[process.argv.indexOf('--paper') + 1] : undefined);

  if (paperArg) {
    const config = WHITEPAPERS[paperArg];
    if (!config) {
      console.error(`Unknown whitepaper: "${paperArg}". Available: ${Object.keys(WHITEPAPERS).join(', ')}`);
      process.exit(1);
    }
    await run(config);
  } else {
    console.log(`Whitepapers: ${Object.keys(WHITEPAPERS).join(', ')}\n`);
    for (const config of Object.values(WHITEPAPERS)) {
      await run(config);
    }
  }

  console.log('\nDone.');
}

main().catch(err => {
  console.error('Generation failed:', err);
  process.exit(1);
});
