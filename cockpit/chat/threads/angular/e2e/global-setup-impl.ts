// SPDX-License-Identifier: MIT
import { resolve } from 'node:path';
import { createGlobalSetup } from '@threadplane-internal/e2e-harness';

export default createGlobalSetup({
  langgraphCwd: 'cockpit/chat/threads/python',
  langgraphPort: 5506,
  angularProject: 'cockpit-chat-threads-angular',
  angularPort: 4506,
  fixturesDir: resolve(__dirname, 'fixtures'),
});
