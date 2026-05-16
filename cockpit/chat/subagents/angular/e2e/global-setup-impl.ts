// SPDX-License-Identifier: MIT
import { resolve } from 'node:path';
import { createGlobalSetup } from '../../../../../libs/e2e-harness/src';

export default createGlobalSetup({
  langgraphCwd: 'cockpit/langgraph/streaming/python',
  // Each cockpit example pins its OWN langgraph port to avoid TIME_WAIT
  // collisions when a sequential CI loop runs multiple per-example e2es
  // back-to-back. Streaming uses 8123; tool-calls 8124; subagents 8125.
  // The Angular proxy.conf.json target must match.
  langgraphPort: 8125,
  angularProject: 'cockpit-chat-subagents-angular',
  angularPort: 4505,
  fixturesDir: resolve(__dirname, 'fixtures'),
});
