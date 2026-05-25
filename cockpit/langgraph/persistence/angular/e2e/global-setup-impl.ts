// SPDX-License-Identifier: MIT
import { resolve } from 'node:path';
import { createGlobalSetup } from '@threadplane-internal/e2e-harness';

export default createGlobalSetup({
  langgraphCwd: 'cockpit/langgraph/persistence/python',
  langgraphPort: 5301,
  angularProject: 'cockpit-langgraph-persistence-angular',
  angularPort: 4301,
  fixturesDir: resolve(__dirname, 'fixtures'),
});
