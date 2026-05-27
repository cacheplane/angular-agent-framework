// SPDX-License-Identifier: MIT
import { resolve } from 'node:path';
import { portsFor } from '../../../../../cockpit/ports.mjs';
import { createGlobalSetup } from '@threadplane-internal/e2e-harness';

const ports = portsFor('cockpit-chat-input-angular');

export default createGlobalSetup({
  langgraphCwd: 'cockpit/chat/input/python',
  langgraphPort: ports.langgraph,
  angularProject: 'cockpit-chat-input-angular',
  angularPort: ports.angular,
  fixturesDir: resolve(__dirname, 'fixtures'),
});
