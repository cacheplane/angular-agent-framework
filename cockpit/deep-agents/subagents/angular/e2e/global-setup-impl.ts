// SPDX-License-Identifier: MIT
import { resolve } from 'node:path';
import { createGlobalSetup } from '../../../../../libs/e2e-harness/src';

export default createGlobalSetup({
  langgraphCwd: 'cockpit/deep-agents/subagents/python',
  langgraphPort: 5312,
  angularProject: 'cockpit-deep-agents-subagents-angular',
  angularPort: 4312,
  fixturesDir: resolve(__dirname, 'fixtures'),
});
