// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Primary function
export { agent } from './lib/agent.fn';

// Provider
export { provideAgent, AGENT_CONFIG } from './lib/agent.provider';
export type { AgentConfig } from './lib/agent.provider';

// Public types
export type {
  AgentOptions,
  AgentRef,
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

// Chat adapter
export { toChatAgent } from './lib/to-chat-agent';

// Test utilities (always exported — tree-shaken in prod builds)
export { MockAgentTransport } from './lib/transport/mock-stream.transport';
export { FetchStreamTransport } from './lib/transport/fetch-stream.transport';

// LangGraph-specific chat primitives (checkpoint_id / ThreadState / fork-replay UI)
export { ChatTimelineComponent } from './lib/primitives/chat-timeline/chat-timeline.component';

export { ChatTimelineSliderComponent } from './lib/compositions/chat-timeline-slider/chat-timeline-slider.component';

export { ChatDebugComponent } from './lib/compositions/chat-debug/chat-debug.component';
export { toDebugCheckpoint, extractStateValues } from './lib/compositions/chat-debug/debug-utils';
export { DebugCheckpointCardComponent } from './lib/compositions/chat-debug/debug-checkpoint-card.component';
export type { DebugCheckpoint } from './lib/compositions/chat-debug/debug-checkpoint-card.component';
export { DebugStateInspectorComponent } from './lib/compositions/chat-debug/debug-state-inspector.component';
export { DebugStateDiffComponent } from './lib/compositions/chat-debug/debug-state-diff.component';
export { DebugTimelineComponent } from './lib/compositions/chat-debug/debug-timeline.component';
export { DebugDetailComponent } from './lib/compositions/chat-debug/debug-detail.component';
export { DebugControlsComponent } from './lib/compositions/chat-debug/debug-controls.component';
export { DebugSummaryComponent } from './lib/compositions/chat-debug/debug-summary.component';
export { computeStateDiff } from './lib/compositions/chat-debug/state-diff';
export type { DiffEntry } from './lib/compositions/chat-debug/state-diff';

// Mock test utility for LangGraph AgentRef
export { createMockAgentRef } from './lib/testing/mock-agent-ref';
export type { MockAgentRef } from './lib/testing/mock-agent-ref';
