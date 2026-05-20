// SPDX-License-Identifier: MIT
import { resolve } from 'node:path';
import { createGlobalSetup } from '../../../../../libs/e2e-harness/src';

export default createGlobalSetup({
  langgraphCwd: 'cockpit/langgraph/memory/python',
  langgraphPort: 5303,
  angularProject: 'cockpit-langgraph-memory-angular',
  angularPort: 4303,
  fixturesDir: resolve(__dirname, 'fixtures'),
});
