// SPDX-License-Identifier: MIT
import { createAgentRef } from '@threadplane/chat';

/**
 * State shape for the canonical chat demo agent.
 * Mirrors the Python graph's `State` TypedDict in
 * `examples/chat/python/src/graph.py`.
 */
export interface DemoState {
  messages: unknown[];
  model: string | null;
  reasoning_effort: string | null;
  gen_ui_mode: string | null;
}

/**
 * Typed DI handle for the canonical demo agent.
 * Wire with `provideAgent(DEMO_AGENT_REF, () => ({ ... }))` and inject with
 * `injectAgent(DEMO_AGENT_REF)` to get `LangGraphAgent<DemoState>`.
 */
export const DEMO_AGENT_REF = createAgentRef<DemoState>('demo');
