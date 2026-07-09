// SPDX-License-Identifier: MIT
import { resolve } from 'node:path';
import { portsFor } from '../../../../../cockpit/ports.mjs';
import { createGlobalSetup } from '@threadplane-internal/e2e-harness';

const ports = portsFor('cockpit-render-repeat-loops-angular');

export default createGlobalSetup({
  langgraphCwd: 'cockpit/render/repeat-loops/python',
  langgraphPort: ports.langgraph,
  angularProject: 'cockpit-render-repeat-loops-angular',
  angularPort: ports.angular,
  fixturesDir: resolve(__dirname, 'fixtures'),
});
