// SPDX-License-Identifier: MIT
import { resolve } from 'node:path';
import { portsFor } from '../../../../../cockpit/ports.mjs';
import { createGlobalSetup } from '@threadplane-internal/e2e-harness';

const ports = portsFor('cockpit-render-spec-rendering-angular');

export default createGlobalSetup({
  langgraphCwd: 'cockpit/render/spec-rendering/python',
  langgraphPort: ports.langgraph,
  angularProject: 'cockpit-render-spec-rendering-angular',
  angularPort: ports.angular,
  fixturesDir: resolve(__dirname, 'fixtures'),
});
