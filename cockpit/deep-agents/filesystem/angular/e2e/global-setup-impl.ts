// SPDX-License-Identifier: MIT
import { resolve } from 'node:path';
import { createGlobalSetup } from '@ngaf-internal/e2e-harness';

export default createGlobalSetup({
  langgraphCwd: 'cockpit/deep-agents/filesystem/python',
  langgraphPort: 5311,
  angularProject: 'cockpit-deep-agents-filesystem-angular',
  angularPort: 4311,
  fixturesDir: resolve(__dirname, 'fixtures'),
});
