// libs/ag-ui/src/lib/testing/provide-fake-ag-ui-agent.ts
// SPDX-License-Identifier: MIT
import { type Provider } from '@angular/core';
import { AG_UI_AGENT } from '../provide-ag-ui-agent';
import { toAgent } from '../to-agent';
import { FakeAgent } from './fake-agent';

export interface FakeAgUiAgentConfig {
  /** Tokens streamed back as the assistant reply. */
  tokens?: string[];
  /** Milliseconds between successive token emissions. */
  delayMs?: number;
}

/**
 * Registers an in-process FakeAgent under AG_UI_AGENT.
 *
 * Use for offline demos and development. Drop-in replacement for
 * provideAgUiAgent({ url }) when no real backend is available.
 */
export function provideFakeAgUiAgent(config: FakeAgUiAgentConfig = {}): Provider[] {
  return [
    {
      provide: AG_UI_AGENT,
      useFactory: () => toAgent(new FakeAgent(config)),
    },
  ];
}
