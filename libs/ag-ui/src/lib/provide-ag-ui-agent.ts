// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { InjectionToken, type Provider } from '@angular/core';
import type { Agent } from '@cacheplane/chat';

export interface AgUiAgentConfig {
  url: string;
  agentId?: string;
  threadId?: string;
  headers?: Record<string, string>;
}

export const AG_UI_AGENT = new InjectionToken<Agent>('AG_UI_AGENT');

export function provideAgUiAgent(config: AgUiAgentConfig): Provider[] {
  void config;
  throw new Error('not implemented');
}

export function injectAgUiAgent(): Agent {
  throw new Error('not implemented');
}
