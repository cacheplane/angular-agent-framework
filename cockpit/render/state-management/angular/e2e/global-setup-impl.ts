// SPDX-License-Identifier: MIT
import { resolve } from 'node:path';
import { portsFor } from '../../../../../cockpit/ports.mjs';
import { createGlobalSetup } from '@threadplane-internal/e2e-harness';

const ports = portsFor('cockpit-render-state-management-angular');

export default createGlobalSetup({
  langgraphCwd: 'cockpit/render/state-management/python',
  langgraphPort: ports.langgraph,
  angularProject: 'cockpit-render-state-management-angular',
  angularPort: ports.angular,
  fixturesDir: resolve(__dirname, 'fixtures'),
});
