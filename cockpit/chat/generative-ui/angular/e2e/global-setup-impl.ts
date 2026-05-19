// SPDX-License-Identifier: MIT
import { resolve } from 'node:path';
import { createGlobalSetup } from '../../../../../libs/e2e-harness/src';

export default createGlobalSetup({
  langgraphCwd: 'cockpit/chat/generative-ui/python',
  langgraphPort: 5508,
  angularProject: 'cockpit-chat-generative-ui-angular',
  angularPort: 4508,
  fixturesDir: resolve(__dirname, 'fixtures'),
});
