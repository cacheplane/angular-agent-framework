// SPDX-License-Identifier: MIT
import { resolve } from 'node:path';
import { portsFor } from '../../../../../cockpit/ports.mjs';
import { createAgUiGlobalSetup } from '@threadplane-internal/e2e-harness';

const ports = portsFor('cockpit-runtimes-aws-strands-angular');

export default createAgUiGlobalSetup({
  pythonCwd: 'cockpit/runtimes/aws-strands/python',
  backendPort: ports.langgraph,
  angularProject: 'cockpit-runtimes-aws-strands-angular',
  angularPort: ports.angular,
  fixturesDir: resolve(__dirname, 'fixtures'),
});
