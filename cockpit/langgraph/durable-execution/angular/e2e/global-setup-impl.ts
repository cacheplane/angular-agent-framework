// SPDX-License-Identifier: MIT
import { resolve } from 'node:path';
import { createGlobalSetup } from '../../../../../libs/e2e-harness/src';

export default createGlobalSetup({
  langgraphCwd: 'cockpit/langgraph/durable-execution/python',
  langgraphPort: 5304,
  angularProject: 'cockpit-langgraph-durable-execution-angular',
  angularPort: 4304,
  fixturesDir: resolve(__dirname, 'fixtures'),
});
