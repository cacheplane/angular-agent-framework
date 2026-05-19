// SPDX-License-Identifier: MIT
import { resolve } from 'node:path';
import { createGlobalSetup } from '../../../../../libs/e2e-harness/src';

export default createGlobalSetup({
  langgraphCwd: 'cockpit/langgraph/deployment-runtime/python',
  langgraphPort: 5307,
  angularProject: 'cockpit-langgraph-deployment-runtime-angular',
  angularPort: 4307,
  fixturesDir: resolve(__dirname, 'fixtures'),
});
