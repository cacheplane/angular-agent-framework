// SPDX-License-Identifier: MIT
import { InjectionToken, inject, type Provider } from '@angular/core';
import { HttpAgent } from '@ag-ui/client';
import type { AgentRuntimeTelemetrySink } from '@threadplane/chat';
import { toAgent, type AgUiAgent } from './to-agent';

/**
 * Configuration for the AG-UI agent provider.
 * HttpAgentConfig shape (from @ag-ui/client@0.0.52):
 *   - url: string (required) — endpoint for the HTTP agent
 *   - agentId: string (optional) — agent identifier
 *   - threadId: string (optional) — thread identifier
 *   - headers: Record<string, string> (optional) — custom HTTP headers
 */
export interface AgentConfig {
  url: string;
  agentId?: string;
  threadId?: string;
  headers?: Record<string, string>;
  /** Optional app-owned telemetry sink. No telemetry is emitted unless this is provided. */
  telemetry?: AgentRuntimeTelemetrySink | false;
}

/**
 * @internal — exported for spec access only. Consumers must use injectAgent().
 * Both `provideAgent` and `provideFakeAgent` register the result of `toAgent()`,
 * which is always an `AgUiAgent`, so the token is typed accordingly.
 */
export const AGENT = new InjectionToken<AgUiAgent>('AGENT');

/**
 * Provides an Agent instance wired through HttpAgent and toAgent.
 * Constructs an HttpAgent from config and wraps it in the runtime-neutral
 * Agent contract via toAgent(). Returns a provider array suitable for
 * bootstrapApplication or TestBed.configureTestingModule().
 *
 * **Static vs factory config.** Pass a plain `AgentConfig` object when the
 * config is known up front. Pass a `() => AgentConfig` factory when the config
 * depends on runtime/DI state — the factory runs inside an Angular injection
 * context, so it may call `inject()` to read services or route params.
 */
export function provideAgent(
  configOrFactory: AgentConfig | (() => AgentConfig),
): Provider[] {
  return [
    {
      provide: AGENT,
      useFactory: () => {
        // useFactory runs in an injection context, so a config factory may
        // call inject() to read runtime/DI state.
        const config =
          typeof configOrFactory === 'function' ? configOrFactory() : configOrFactory;
        const source = new HttpAgent({
          url: config.url,
          ...(config.agentId !== undefined ? { agentId: config.agentId } : {}),
          ...(config.threadId !== undefined ? { threadId: config.threadId } : {}),
          ...(config.headers !== undefined ? { headers: config.headers } : {}),
        });
        return toAgent(source, { telemetry: config.telemetry });
      },
    },
  ];
}

/**
 * Injects the AG-UI agent from Angular's dependency injection container.
 * Use this in components or services provided via `provideAgent()` (or
 * `provideFakeAgent()`).
 *
 * Returns an `AgUiAgent` — the runtime-neutral `Agent` contract plus the
 * AG-UI-specific `customEvents` signal — so `customEvents` is reachable
 * directly, without casting.
 */
export function injectAgent(): AgUiAgent {
  return inject(AGENT);
}
