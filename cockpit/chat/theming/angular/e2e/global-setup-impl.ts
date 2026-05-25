// SPDX-License-Identifier: MIT
import { resolve } from 'node:path';
import { createGlobalSetup } from '@threadplane-internal/e2e-harness';

export default createGlobalSetup({
  langgraphCwd: 'cockpit/chat/theming/python',
  langgraphPort: 5510,
  angularProject: 'cockpit-chat-theming-angular',
  angularPort: 4510,
  fixturesDir: resolve(__dirname, 'fixtures'),
});
