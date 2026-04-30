// SPDX-License-Identifier: MIT
import { InjectionToken, inject, type Provider } from '@angular/core';
import { HttpAgent } from '@ag-ui/client';
import type { Agent } from '@cacheplane/chat';
import { toAgent } from './to-agent';

/**
 * Configuration for the AG-UI agent provider.
 * HttpAgentConfig shape (from @ag-ui/client@0.0.52):
 *   - url: string (required) — endpoint for the HTTP agent
 *   - agentId: string (optional) — agent identifier
 *   - threadId: string (optional) — thread identifier
 *   - headers: Record<string, string> (optional) — custom HTTP headers
 */
export interface AgUiAgentConfig {
  url: string;
  agentId?: string;
  threadId?: string;
  headers?: Record<string, string>;
}

export const AG_UI_AGENT = new InjectionToken<Agent>('AG_UI_AGENT');

/**
 * Provides an Agent instance wired through HttpAgent and toAgent.
 * Constructs an HttpAgent from config and wraps it in the runtime-neutral
 * Agent contract via toAgent(). Returns a provider array suitable for
 * bootstrapApplication or TestBed.configureTestingModule().
 */
export function provideAgUiAgent(config: AgUiAgentConfig): Provider[] {
  return [
    {
      provide: AG_UI_AGENT,
      useFactory: () => {
        const source = new HttpAgent({
          url: config.url,
          ...(config.agentId !== undefined ? { agentId: config.agentId } : {}),
          ...(config.threadId !== undefined ? { threadId: config.threadId } : {}),
          ...(config.headers !== undefined ? { headers: config.headers } : {}),
        });
        return toAgent(source);
      },
    },
  ];
}

/**
 * Injects the AG_UI_AGENT from Angular's dependency injection container.
 * Use this in components or services that have been provided via provideAgUiAgent().
 */
export function injectAgUiAgent(): Agent {
  return inject(AG_UI_AGENT);
}
