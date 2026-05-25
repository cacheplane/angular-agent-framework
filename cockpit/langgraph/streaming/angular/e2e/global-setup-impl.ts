// SPDX-License-Identifier: MIT
import { resolve } from 'node:path';
import { createGlobalSetup } from '@threadplane-internal/e2e-harness';

export default createGlobalSetup({
  langgraphCwd: 'cockpit/langgraph/streaming/python',
  langgraphPort: 5300,
  angularProject: 'cockpit-langgraph-streaming-angular',
  angularPort: 4300,
  fixturesDir: resolve(__dirname, 'fixtures'),
});
