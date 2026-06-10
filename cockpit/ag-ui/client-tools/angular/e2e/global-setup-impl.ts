// SPDX-License-Identifier: MIT
import { resolve } from 'node:path';
import { portsFor } from '../../../../../cockpit/ports.mjs';
import { createAgUiGlobalSetup } from '@threadplane-internal/e2e-harness';

const ports = portsFor('cockpit-ag-ui-client-tools-angular');

export default createAgUiGlobalSetup({
  pythonCwd: 'cockpit/ag-ui/client-tools/python',
  backendPort: ports.langgraph,
  angularProject: 'cockpit-ag-ui-client-tools-angular',
  angularPort: ports.angular,
  fixturesDir: resolve(__dirname, 'fixtures'),
});
