// SPDX-License-Identifier: MIT
import { resolve } from 'node:path';
import { createGlobalSetup } from '../../../../../libs/e2e-harness/src';

export default createGlobalSetup({
  langgraphCwd: 'cockpit/deep-agents/skills/python',
  langgraphPort: 5314,
  angularProject: 'cockpit-deep-agents-skills-angular',
  angularPort: 4314,
  fixturesDir: resolve(__dirname, 'fixtures'),
});
