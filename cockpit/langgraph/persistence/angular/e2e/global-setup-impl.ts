// SPDX-License-Identifier: MIT
import { resolve } from 'node:path';
import { portsFor } from '../../../../../cockpit/ports.mjs';
import { createGlobalSetup } from '@threadplane-internal/e2e-harness';

const ports = portsFor('cockpit-langgraph-persistence-angular');

export default createGlobalSetup({
  langgraphCwd: 'cockpit/langgraph/persistence/python',
  langgraphPort: ports.langgraph,
  angularProject: 'cockpit-langgraph-persistence-angular',
  angularPort: ports.angular,
  fixturesDir: resolve(__dirname, 'fixtures'),
});
