// libs/ag-ui/src/lib/testing/provide-fake-agent.ts
// SPDX-License-Identifier: MIT
import { type Provider } from '@angular/core';
import type { FakeAgentConfig } from '@threadplane/chat/testing';
import { AGENT } from '../provide-agent';
import { toAgent } from '../to-agent';
import { FakeAgent } from './fake-agent';

/**
 * Registers an in-process FakeAgent under AGENT.
 *
 * Use for offline demos and development. Drop-in replacement for
 * provideAgent({ url }) when no real backend is available.
 *
 * @example
 * ```ts
 * TestBed.configureTestingModule({
 *   providers: [provideFakeAgent({ responses: ['Hello from the fake agent'] })],
 * });
 * ```
 */
export function provideFakeAgent(config: FakeAgentConfig = {}): Provider[] {
  return [
    {
      provide: AGENT,
      useFactory: () => toAgent(new FakeAgent(config)),
    },
  ];
}
