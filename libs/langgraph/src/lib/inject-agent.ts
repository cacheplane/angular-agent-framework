// SPDX-License-Identifier: MIT
import type { BagTemplate, InferBag } from '@langchain/langgraph-sdk';
import { agent } from './agent.fn';
import type { AgentOptions, LangGraphAgent } from './agent.types';

/**
 * Retrieve a LangGraph-backed Agent from the current Angular injection context.
 *
 * Mirrors `@threadplane/ag-ui`'s `injectAgUiAgent()` so consumer code is identical
 * regardless of which adapter is wired in `app.config.ts`. Internally delegates to
 * the existing `agent()` factory, which calls `inject(AGENT_CONFIG, { optional: true })`
 * to merge in any global provider config.
 */
export function injectAgent<
  T = Record<string, unknown>,
  Bag extends BagTemplate = BagTemplate,
>(
  options: AgentOptions<T, InferBag<T, Bag>>,
): LangGraphAgent<T, InferBag<T, Bag>> {
  return agent<T, Bag>(options);
}
