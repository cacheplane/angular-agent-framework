// libs/ag-ui/src/lib/testing/provide-fake-agent.ts
// SPDX-License-Identifier: MIT
import { type Provider } from '@angular/core';
import { AGENT } from '../provide-agent';
import { toAgent } from '../to-agent';
import { FakeAgent } from './fake-agent';

export interface FakeAgentConfig {
  /** Tokens streamed back as the assistant reply. */
  tokens?: string[];
  /** Optional reasoning chunks emitted before the text reply. */
  reasoningTokens?: string[];
  /** Milliseconds between successive token emissions. */
  delayMs?: number;
}

/**
 * Registers an in-process FakeAgent under AGENT.
 *
 * Use for offline demos and development. Drop-in replacement for
 * provideAgent({ url }) when no real backend is available.
 */
export function provideFakeAgent(config: FakeAgentConfig = {}): Provider[] {
  return [
    {
      provide: AGENT,
      useFactory: () => toAgent(new FakeAgent(config)),
    },
  ];
}
