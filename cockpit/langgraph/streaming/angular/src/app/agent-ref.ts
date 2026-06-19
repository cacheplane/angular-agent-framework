// SPDX-License-Identifier: MIT
import { createAgentRef } from '@threadplane/chat';

/** State shape for the streaming cockpit (LangGraph MessagesState). */
export interface StreamingState {
  messages: unknown[];
}

/**
 * Typed DI handle for the streaming agent.
 * Wire with `provideAgent(STREAMING_AGENT, { ... })` and inject with
 * `injectAgent(STREAMING_AGENT)` to get `LangGraphAgent<StreamingState>`.
 */
export const STREAMING_AGENT = createAgentRef<StreamingState>('streaming');
