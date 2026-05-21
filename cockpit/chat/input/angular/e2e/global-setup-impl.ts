// SPDX-License-Identifier: MIT
import { resolve } from 'node:path';
import { createGlobalSetup } from '@ngaf-internal/e2e-harness';

export default createGlobalSetup({
  langgraphCwd: 'cockpit/chat/input/python',
  langgraphPort: 5502,
  angularProject: 'cockpit-chat-input-angular',
  angularPort: 4502,
  fixturesDir: resolve(__dirname, 'fixtures'),
});
