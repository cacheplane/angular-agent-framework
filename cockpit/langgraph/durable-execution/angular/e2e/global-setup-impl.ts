// SPDX-License-Identifier: MIT
import { resolve } from 'node:path';
import { createGlobalSetup } from '@ngaf-internal/e2e-harness';

export default createGlobalSetup({
  langgraphCwd: 'cockpit/langgraph/durable-execution/python',
  langgraphPort: 5304,
  angularProject: 'cockpit-langgraph-durable-execution-angular',
  angularPort: 4304,
  fixturesDir: resolve(__dirname, 'fixtures'),
});
