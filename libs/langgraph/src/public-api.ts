// SPDX-License-Identifier: MIT
// Primary function
export { agent } from './lib/agent.fn';

// Provider
export { provideAgent, AGENT_CONFIG } from './lib/agent.provider';
export type { AgentConfig } from './lib/agent.provider';

// Public types
export type {
  AgentOptions,
  LangGraphAgent,
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
