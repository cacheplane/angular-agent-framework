// SPDX-License-Identifier: MIT
import { resolve } from 'node:path';
import { createGlobalSetup } from '@ngaf-internal/e2e-harness';

export default createGlobalSetup({
  langgraphCwd: 'cockpit/langgraph/time-travel/python',
  langgraphPort: 5306,
  angularProject: 'cockpit-langgraph-time-travel-angular',
  angularPort: 4306,
  fixturesDir: resolve(__dirname, 'fixtures'),
});
