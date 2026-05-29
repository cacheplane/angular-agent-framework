// SPDX-License-Identifier: MIT
export { toAgent } from './lib/to-agent';
export type { ToAgentOptions } from './lib/to-agent';
export { provideAgent, injectAgent } from './lib/provide-agent';
export type { AgentConfig } from './lib/provide-agent';
export { FakeAgent } from './lib/testing/fake-agent';
export { provideFakeAgent } from './lib/testing/provide-fake-agent';
export type { FakeAgentConfig } from './lib/testing/provide-fake-agent';

// Citation state bridge
export { bridgeCitationsState } from './lib/bridge-citations-state';
