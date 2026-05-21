// SPDX-License-Identifier: MIT
import { resolve } from 'node:path';
import { createGlobalSetup } from '@ngaf-internal/e2e-harness';

export default createGlobalSetup({
  langgraphCwd: 'cockpit/chat/messages/python',
  langgraphPort: 5501,
  angularProject: 'cockpit-chat-messages-angular',
  angularPort: 4501,
  fixturesDir: resolve(__dirname, 'fixtures'),
});
