// SPDX-License-Identifier: MIT
import { inject } from '@angular/core';
import type { BagTemplate } from '@langchain/langgraph-sdk';
import { AGENT } from './agent.provider';
import type { LangGraphAgent } from './agent.types';

/**
 * Retrieve the LangGraph-backed Agent from the current Angular injection context.
 *
 * Mirrors `@threadplane/ag-ui`'s `injectAgUiAgent()` so consumer code is similar
 * regardless of which adapter is wired in `app.config.ts`. The agent is a
 * singleton scoped to the injector that called `provideAgent()` — re-provide
 * in a child component's `providers: []` to scope a different agent to that
 * subtree (Angular's hierarchical DI handles the rest).
 */
export function injectAgent<
  T = Record<string, unknown>,
  ResolvedBag extends BagTemplate = BagTemplate,
>(): LangGraphAgent<T, ResolvedBag> {
  return inject(AGENT) as LangGraphAgent<T, ResolvedBag>;
}
