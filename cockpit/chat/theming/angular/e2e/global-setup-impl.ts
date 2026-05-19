// SPDX-License-Identifier: MIT
import { resolve } from 'node:path';
import { createGlobalSetup } from '../../../../../libs/e2e-harness/src';

export default createGlobalSetup({
  langgraphCwd: 'cockpit/chat/theming/python',
  langgraphPort: 5510,
  angularProject: 'cockpit-chat-theming-angular',
  angularPort: 4510,
  fixturesDir: resolve(__dirname, 'fixtures'),
});
