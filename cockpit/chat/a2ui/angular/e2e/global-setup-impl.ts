// SPDX-License-Identifier: MIT
import { resolve } from 'node:path';
import { createGlobalSetup } from '@threadplane-internal/e2e-harness';

export default createGlobalSetup({
  langgraphCwd: 'cockpit/chat/a2ui/python',
  langgraphPort: 5511,
  angularProject: 'cockpit-chat-a2ui-angular',
  angularPort: 4511,
  fixturesDir: resolve(__dirname, 'fixtures'),
});
