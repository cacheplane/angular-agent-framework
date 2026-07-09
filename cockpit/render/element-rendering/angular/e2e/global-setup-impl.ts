// SPDX-License-Identifier: MIT
import { resolve } from 'node:path';
import { portsFor } from '../../../../../cockpit/ports.mjs';
import { createGlobalSetup } from '@threadplane-internal/e2e-harness';

const ports = portsFor('cockpit-render-element-rendering-angular');

export default createGlobalSetup({
  langgraphCwd: 'cockpit/render/element-rendering/python',
  langgraphPort: ports.langgraph,
  angularProject: 'cockpit-render-element-rendering-angular',
  angularPort: ports.angular,
  fixturesDir: resolve(__dirname, 'fixtures'),
});
