// SPDX-License-Identifier: MIT
import { resolve } from 'node:path';
import { portsFor } from '../../../../../cockpit/ports.mjs';
import { createGlobalSetup } from '@threadplane-internal/e2e-harness';

const ports = portsFor('cockpit-langgraph-time-travel-angular');

export default createGlobalSetup({
  langgraphCwd: 'cockpit/langgraph/time-travel/python',
  langgraphPort: ports.langgraph,
  angularProject: 'cockpit-langgraph-time-travel-angular',
  angularPort: ports.angular,
  fixturesDir: resolve(__dirname, 'fixtures'),
});
