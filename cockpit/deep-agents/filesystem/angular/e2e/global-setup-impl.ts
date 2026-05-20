// SPDX-License-Identifier: MIT
import { resolve } from 'node:path';
import { createGlobalSetup } from '../../../../../libs/e2e-harness/src';

export default createGlobalSetup({
  langgraphCwd: 'cockpit/deep-agents/filesystem/python',
  langgraphPort: 5311,
  angularProject: 'cockpit-deep-agents-filesystem-angular',
  angularPort: 4311,
  fixturesDir: resolve(__dirname, 'fixtures'),
});
