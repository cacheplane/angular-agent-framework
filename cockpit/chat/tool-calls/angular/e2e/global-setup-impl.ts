// SPDX-License-Identifier: MIT
import { resolve } from 'node:path';
import { createGlobalSetup } from '../../../../../libs/e2e-harness/src';

export default createGlobalSetup({
  langgraphCwd: 'cockpit/langgraph/streaming/python',
  // Each cockpit example pins its OWN langgraph port to avoid TIME_WAIT
  // collisions when a sequential CI loop runs multiple per-example e2es
  // back-to-back. The streaming pilot keeps the historical 8123 default;
  // tool-calls offsets to 8124. Future examples pick the next unused port.
  // The Angular proxy.conf.json target must match.
  langgraphPort: 8124,
  angularProject: 'cockpit-chat-tool-calls-angular',
  angularPort: 4504,
  fixturesDir: resolve(__dirname, 'fixtures'),
});
