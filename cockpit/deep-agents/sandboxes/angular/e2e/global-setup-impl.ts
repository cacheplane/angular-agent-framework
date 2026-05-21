// SPDX-License-Identifier: MIT
import { resolve } from 'node:path';
import { createGlobalSetup } from '@ngaf-internal/e2e-harness';

export default createGlobalSetup({
  langgraphCwd: 'cockpit/deep-agents/sandboxes/python',
  langgraphPort: 5315,
  angularProject: 'cockpit-deep-agents-sandboxes-angular',
  angularPort: 4315,
  fixturesDir: resolve(__dirname, 'fixtures'),
});
