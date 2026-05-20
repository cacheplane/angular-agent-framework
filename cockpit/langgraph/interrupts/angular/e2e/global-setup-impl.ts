// SPDX-License-Identifier: MIT
import { resolve } from 'node:path';
import { createGlobalSetup } from '../../../../../libs/e2e-harness/src';

export default createGlobalSetup({
  langgraphCwd: 'cockpit/langgraph/interrupts/python',
  langgraphPort: 5302,
  angularProject: 'cockpit-langgraph-interrupts-angular',
  angularPort: 4302,
  fixturesDir: resolve(__dirname, 'fixtures'),
});
