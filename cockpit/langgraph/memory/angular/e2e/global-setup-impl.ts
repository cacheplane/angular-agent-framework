// SPDX-License-Identifier: MIT
import { resolve } from 'node:path';
import { createGlobalSetup } from '@ngaf-internal/e2e-harness';

export default createGlobalSetup({
  langgraphCwd: 'cockpit/langgraph/memory/python',
  langgraphPort: 5303,
  angularProject: 'cockpit-langgraph-memory-angular',
  angularPort: 4303,
  fixturesDir: resolve(__dirname, 'fixtures'),
});
