// SPDX-License-Identifier: MIT
import { InjectionToken } from '@angular/core';
import type { LangGraphClientOptions } from '../agent.types';

/**
 * App-wide LangGraph SDK client tuning (e.g. `maxRetries`). Provide once at the
 * app root; both the agent's default {@link FetchStreamTransport} and the
 * {@link LangGraphThreadsAdapter} read it so the retry budget is configured in
 * one place. A call-site `agent({ clientOptions })` or per-agent
 * `provideAgent({ clientOptions })` overrides it for that agent.
 * Absent → the SDK default.
 */
export const LANGGRAPH_CLIENT_OPTIONS = new InjectionToken<LangGraphClientOptions>(
  'LANGGRAPH_CLIENT_OPTIONS',
);

/**
 * First-defined-wins resolution across precedence layers (highest first).
 * Whole-object semantics — no per-field merge — so the winning layer is the
 * single source for every option. Returns undefined when all layers are absent.
 */
export function resolveClientOptions(
  ...layers: Array<LangGraphClientOptions | undefined | null>
): LangGraphClientOptions | undefined {
  for (const layer of layers) {
    if (layer) return layer;
  }
  return undefined;
}
