// SPDX-License-Identifier: MIT
import { resolve } from 'node:path';
import { createGlobalSetup } from '../../../../../libs/e2e-harness/src';

export default createGlobalSetup({
  langgraphCwd: 'cockpit/chat/a2ui/python',
  langgraphPort: 5511,
  angularProject: 'cockpit-chat-a2ui-angular',
  angularPort: 4511,
  fixturesDir: resolve(__dirname, 'fixtures'),
});
