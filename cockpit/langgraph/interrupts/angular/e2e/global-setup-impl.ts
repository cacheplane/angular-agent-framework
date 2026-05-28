// SPDX-License-Identifier: MIT
import { resolve } from 'node:path';
import { portsFor } from '../../../../../cockpit/ports.mjs';
import { createGlobalSetup } from '@threadplane-internal/e2e-harness';

const ports = portsFor('cockpit-langgraph-interrupts-angular');

export default createGlobalSetup({
  langgraphCwd: 'cockpit/langgraph/interrupts/python',
  langgraphPort: ports.langgraph,
  angularProject: 'cockpit-langgraph-interrupts-angular',
  angularPort: ports.angular,
  fixturesDir: resolve(__dirname, 'fixtures'),
});
