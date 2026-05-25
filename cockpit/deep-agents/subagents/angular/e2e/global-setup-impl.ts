// SPDX-License-Identifier: MIT
import { resolve } from 'node:path';
import { createGlobalSetup } from '@threadplane-internal/e2e-harness';

export default createGlobalSetup({
  langgraphCwd: 'cockpit/deep-agents/subagents/python',
  langgraphPort: 5312,
  angularProject: 'cockpit-deep-agents-subagents-angular',
  angularPort: 4312,
  fixturesDir: resolve(__dirname, 'fixtures'),
});
