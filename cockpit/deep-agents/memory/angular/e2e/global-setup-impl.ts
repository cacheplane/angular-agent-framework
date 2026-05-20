// SPDX-License-Identifier: MIT
import { resolve } from 'node:path';
import { createGlobalSetup } from '../../../../../libs/e2e-harness/src';

export default createGlobalSetup({
  langgraphCwd: 'cockpit/deep-agents/memory/python',
  langgraphPort: 5313,
  angularProject: 'cockpit-deep-agents-memory-angular',
  angularPort: 4313,
  fixturesDir: resolve(__dirname, 'fixtures'),
});
