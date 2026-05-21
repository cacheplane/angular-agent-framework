// SPDX-License-Identifier: MIT
import { resolve } from 'node:path';
import { createGlobalSetup } from '@ngaf-internal/e2e-harness';

export default createGlobalSetup({
  langgraphCwd: 'cockpit/langgraph/subgraphs/python',
  langgraphPort: 5305,
  angularProject: 'cockpit-langgraph-subgraphs-angular',
  angularPort: 4305,
  fixturesDir: resolve(__dirname, 'fixtures'),
});
