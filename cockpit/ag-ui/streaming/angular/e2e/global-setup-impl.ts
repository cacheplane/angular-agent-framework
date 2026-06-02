// SPDX-License-Identifier: MIT
import { resolve } from 'node:path';
import { portsFor } from '../../../../../cockpit/ports.mjs';
import { createAgUiGlobalSetup } from '@threadplane-internal/e2e-harness';

const ports = portsFor('cockpit-ag-ui-streaming-angular');

export default createAgUiGlobalSetup({
  pythonCwd: 'cockpit/ag-ui/streaming/python',
  backendPort: ports.langgraph,
  angularProject: 'cockpit-ag-ui-streaming-angular',
  angularPort: ports.angular,
  fixturesDir: resolve(__dirname, 'fixtures'),
});
