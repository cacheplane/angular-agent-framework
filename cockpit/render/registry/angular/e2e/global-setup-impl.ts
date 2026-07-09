// SPDX-License-Identifier: MIT
import { resolve } from 'node:path';
import { portsFor } from '../../../../../cockpit/ports.mjs';
import { createGlobalSetup } from '@threadplane-internal/e2e-harness';

const ports = portsFor('cockpit-render-registry-angular');

export default createGlobalSetup({
  langgraphCwd: 'cockpit/render/registry/python',
  langgraphPort: ports.langgraph,
  angularProject: 'cockpit-render-registry-angular',
  angularPort: ports.angular,
  fixturesDir: resolve(__dirname, 'fixtures'),
});
