// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { InjectionToken, Provider } from '@angular/core';
import { AgentTransport } from './agent.types';

/**
 * Global configuration for agent instances.
 * Properties set here serve as defaults that can be overridden per-call.
 */
export interface AgentConfig {
  /** Base URL of the LangGraph Platform API (e.g., `'http://localhost:2024'`). */
  apiUrl?:    string;
  /** Custom transport implementation. Defaults to {@link FetchStreamTransport}. */
  transport?: AgentTransport;
}

export const AGENT_CONFIG =
  new InjectionToken<AgentConfig>('AGENT_CONFIG');

/**
 * Angular provider factory that registers global defaults for all
 * agent instances in the application.
 *
 * Add to your `app.config.ts` or module providers array.
 *
 * @param config - Global configuration merged with per-call options
 * @returns An Angular Provider for dependency injection
 *
 * @example
 * ```typescript
 * // app.config.ts
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     provideAgent({ apiUrl: 'http://localhost:2024' }),
 *   ],
 * };
 * ```
 */
export function provideAgent(config: AgentConfig): Provider {
  return {
    provide: AGENT_CONFIG,
    useValue: config,
  };
}
