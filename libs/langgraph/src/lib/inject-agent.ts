// SPDX-License-Identifier: MIT
import { inject } from '@angular/core';
import type { BagTemplate } from '@langchain/langgraph-sdk';
import type { AgentRef } from '@threadplane/chat';
import { AGENT } from './agent.provider';
import type { LangGraphAgent } from './agent.types';

/**
 * Retrieve the LangGraph-backed Agent from the current Angular injection context.
 *
 * Mirrors `@threadplane/ag-ui`'s `injectAgent()` so consumer code is identical
 * regardless of which adapter is wired in `app.config.ts`. The agent is a
 * singleton scoped to the injector that called `provideAgent()` — re-provide
 * in a child component's `providers: []` to scope a different agent to that
 * subtree (Angular's hierarchical DI handles the rest).
 *
 * **Typed state via AgentRef.** Pass the same ref that was supplied to
 * `provideAgent(ref, …)` to carry the state type through DI without repeating
 * the generic at every call site:
 *
 * ```ts
 * const agent = injectAgent(TRIP); // LangGraphAgent<TripState>
 * ```
 *
 * The no-arg form defaults to `LangGraphAgent<Record<string, unknown>>`.
 */
export function injectAgent(): LangGraphAgent<Record<string, unknown>>;
export function injectAgent<T, ResolvedBag extends BagTemplate = BagTemplate>(
  ref: AgentRef<T>,
): LangGraphAgent<T, ResolvedBag>;
export function injectAgent<T = Record<string, unknown>, ResolvedBag extends BagTemplate = BagTemplate>(
  ref?: AgentRef<T>,
): LangGraphAgent<T, ResolvedBag> {
  return inject(ref ? ref.token : AGENT) as LangGraphAgent<T, ResolvedBag>;
}
