// SPDX-License-Identifier: MIT
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

export const AGENT_CONFIG = new InjectionToken<AgentConfig>('AGENT_CONFIG');

/**
 * Angular provider factory that registers global defaults for all
 * agent instances in the application.
 */
export function provideAgent(config: AgentConfig): Provider {
  return { provide: AGENT_CONFIG, useValue: config };
}
