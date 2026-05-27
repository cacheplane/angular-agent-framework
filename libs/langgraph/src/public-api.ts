// SPDX-License-Identifier: MIT
// Primary function (DEPRECATED — see injectAgent. Removed in Task A2.)
export { agent } from './lib/agent.fn';

// Symmetric inject helper (new — matches @threadplane/ag-ui)
export { injectAgent } from './lib/inject-agent';

// Provider
export { provideAgent, AGENT_CONFIG } from './lib/agent.provider';
export type { AgentConfig } from './lib/agent.provider';

// Lifecycle monitoring
export { AGENT_LIFECYCLE } from './lib/lifecycle';
export type { AgentLifecycle } from './lib/lifecycle';
export { AgentLifecycleRegistry } from './lib/agent-lifecycle-registry';

// Public types
export type {
  AgentOptions,
  AgentBranchTree,
  AgentBranchTreeFork,
  AgentBranchTreeNode,
  AgentQueue,
  AgentQueueEntry,
  LangGraphAgent,
  LangGraphMultitaskStrategy,
  LangGraphSubmitOptions,
  AgentTransport,
  CustomStreamEvent,
  StreamEvent,
  SubagentStreamRef,
} from './lib/agent.types';

// Re-export from SDK (consumers import from angular, not langgraph-sdk)
export type { BagTemplate, InferBag, Interrupt, ThreadState, SubmitOptions }
  from './lib/agent.types';

// Re-export ResourceStatus shim for convenience
export { ResourceStatus } from './lib/agent.types';

// Test utilities (always exported — tree-shaken in prod builds)
export { MockAgentTransport } from './lib/transport/mock-stream.transport';
export { FetchStreamTransport } from './lib/transport/fetch-stream.transport';

// Mock test utility for LangGraph agent
export { mockLangGraphAgent } from './lib/testing/mock-langgraph-agent';
export type { MockLangGraphAgent } from './lib/testing/mock-langgraph-agent';

// Citation normalizer — useful for advanced consumers building custom adapters
// or bridging non-LangGraph message shapes into ngaf Citation[].
export { extractCitations } from './lib/internals/extract-citations';

// SDK Client helper — handles the SDK's absolute-URL requirement so
// `/api`-style relative paths work in browser contexts.
export { createLangGraphClient, toAbsoluteApiUrl } from './lib/client/create-langgraph-client';

// SDK-backed thread store — drop-in replacement for the
// hand-rolled ThreadsService that consumers used to duplicate.
export {
  LangGraphThreadsAdapter,
  LANGGRAPH_THREADS_CONFIG,
  LANGGRAPH_CLIENT,
} from './lib/threads/threads-adapter';
export type { LangGraphThreadsConfig } from './lib/threads/threads-adapter';

// Lifecycle helper for hooking refreshes onto agent state transitions.
export { refreshOnRunEnd, refreshOnTransition } from './lib/threads/refresh-on';
