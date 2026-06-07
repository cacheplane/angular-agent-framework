// SPDX-License-Identifier: MIT
import { resolve } from 'node:path';
import { portsFor } from '../../../../../cockpit/ports.mjs';
import { createAgUiGlobalSetup } from '@threadplane-internal/e2e-harness';

const ports = portsFor('cockpit-ag-ui-json-render-angular');

export default createAgUiGlobalSetup({
  pythonCwd: 'cockpit/ag-ui/json-render/python',
  backendPort: ports.langgraph,
  angularProject: 'cockpit-ag-ui-json-render-angular',
  angularPort: ports.angular,
  fixturesDir: resolve(__dirname, 'fixtures'),
});
