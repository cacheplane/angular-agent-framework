// SPDX-License-Identifier: MIT
import { resolve } from 'node:path';
import { portsFor } from '../../../../../cockpit/ports.mjs';
import { createGlobalSetup } from '@threadplane-internal/e2e-harness';

const ports = portsFor('cockpit-deep-agents-sandboxes-angular');

export default createGlobalSetup({
  langgraphCwd: 'cockpit/deep-agents/sandboxes/python',
  langgraphPort: ports.langgraph,
  angularProject: 'cockpit-deep-agents-sandboxes-angular',
  angularPort: ports.angular,
  fixturesDir: resolve(__dirname, 'fixtures'),
});
