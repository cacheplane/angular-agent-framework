// SPDX-License-Identifier: MIT
export { toAgent } from './lib/to-agent';
export { provideAgUiAgent, AG_UI_AGENT, injectAgUiAgent } from './lib/provide-ag-ui-agent';
export type { AgUiAgentConfig } from './lib/provide-ag-ui-agent';
export { FakeAgent } from './lib/testing/fake-agent';
export { provideFakeAgUiAgent } from './lib/testing/provide-fake-ag-ui-agent';
export type { FakeAgUiAgentConfig } from './lib/testing/provide-fake-ag-ui-agent';

// Citation state bridge — useful for advanced consumers building custom
// reducers or merging citations from non-standard state paths.
export { bridgeCitationsState } from './lib/bridge-citations-state';
