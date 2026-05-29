// SPDX-License-Identifier: MIT
import { resolve } from 'node:path';
import { portsFor } from '../../../../../cockpit/ports.mjs';
import { createAgUiGlobalSetup } from '@threadplane-internal/e2e-harness';

const ports = portsFor('cockpit-ag-ui-interrupts-angular');

export default createAgUiGlobalSetup({
  pythonCwd: 'cockpit/ag-ui/interrupts/python',
  backendPort: ports.langgraph,
  angularProject: 'cockpit-ag-ui-interrupts-angular',
  angularPort: ports.angular,
  fixturesDir: resolve(__dirname, 'fixtures'),
});
