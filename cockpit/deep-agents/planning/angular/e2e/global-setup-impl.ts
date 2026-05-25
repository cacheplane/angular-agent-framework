// SPDX-License-Identifier: MIT
import { resolve } from 'node:path';
import { createGlobalSetup } from '@threadplane-internal/e2e-harness';

export default createGlobalSetup({
  langgraphCwd: 'cockpit/deep-agents/planning/python',
  langgraphPort: 5310,
  angularProject: 'cockpit-deep-agents-planning-angular',
  angularPort: 4310,
  fixturesDir: resolve(__dirname, 'fixtures'),
});
