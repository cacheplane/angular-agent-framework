// SPDX-License-Identifier: MIT
import { resolve } from 'node:path';
import { portsFor } from '../../../../../cockpit/ports.mjs';
import { createGlobalSetup } from '@threadplane-internal/e2e-harness';

const ports = portsFor('cockpit-deep-agents-subagents-angular');

export default createGlobalSetup({
  langgraphCwd: 'cockpit/deep-agents/subagents/python',
  langgraphPort: ports.langgraph,
  angularProject: 'cockpit-deep-agents-subagents-angular',
  angularPort: ports.angular,
  fixturesDir: resolve(__dirname, 'fixtures'),
});
