// SPDX-License-Identifier: MIT
import { InjectionToken, inject, type Provider } from '@angular/core';
import { HttpAgent } from '@ag-ui/client';
import type { Agent, AgentRuntimeTelemetrySink } from '@threadplane/chat';
import { toAgent } from './to-agent';

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

/** @internal — exported for spec access only. Consumers must use injectAgent(). */
export const AGENT = new InjectionToken<Agent>('AGENT');

/**
 * Provides an Agent instance wired through HttpAgent and toAgent.
 * Constructs an HttpAgent from config and wraps it in the runtime-neutral
 * Agent contract via toAgent(). Returns a provider array suitable for
 * bootstrapApplication or TestBed.configureTestingModule().
 */
export function provideAgent(config: AgentConfig): Provider[] {
  return [
    {
      provide: AGENT,
      useFactory: () => {
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
 * Injects the Agent from Angular's dependency injection container.
 * Use this in components or services that have been provided via provideAgent().
 */
export function injectAgent(): Agent {
  return inject(AGENT);
}
