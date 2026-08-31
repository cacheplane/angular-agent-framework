// SPDX-License-Identifier: MIT
import { resolve } from 'node:path';
import { portsFor } from '../../../../../cockpit/ports.mjs';
import { createAgUiGlobalSetup } from '@threadplane-internal/e2e-harness';

const ports = portsFor('cockpit-runtimes-microsoft-agent-framework-angular');

export default createAgUiGlobalSetup({
  pythonCwd: 'cockpit/runtimes/microsoft-agent-framework/python',
  backendPort: ports.langgraph,
  angularProject: 'cockpit-runtimes-microsoft-agent-framework-angular',
  angularPort: ports.angular,
  fixturesDir: resolve(__dirname, 'fixtures'),
});
