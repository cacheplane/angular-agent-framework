// SPDX-License-Identifier: MIT
import { resolve } from 'node:path';
import { portsFor } from '../../../../../cockpit/ports.mjs';
import { createGlobalSetup } from '@threadplane-internal/e2e-harness';

const ports = portsFor('cockpit-chat-generative-ui-angular');

export default createGlobalSetup({
  langgraphCwd: 'cockpit/chat/generative-ui/python',
  langgraphPort: ports.langgraph,
  angularProject: 'cockpit-chat-generative-ui-angular',
  angularPort: ports.angular,
  fixturesDir: resolve(__dirname, 'fixtures'),
});
