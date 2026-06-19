// SPDX-License-Identifier: MIT
import { createAgentRef } from '@threadplane/chat';

/** State shape for the messages cockpit (LangGraph MessagesState). */
export interface MessagesState {
  messages: unknown[];
}

/**
 * Typed DI handle for the messages agent.
 * Wire with `provideAgent(MESSAGES_AGENT, { ... })` and inject with
 * `injectAgent(MESSAGES_AGENT)` to get `LangGraphAgent<MessagesState>`.
 */
export const MESSAGES_AGENT = createAgentRef<MessagesState>('messages');
