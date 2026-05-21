// SPDX-License-Identifier: MIT
import { resolve } from 'node:path';
import { createGlobalSetup } from '@ngaf-internal/e2e-harness';

export default createGlobalSetup({
  langgraphCwd: 'cockpit/chat/timeline/python',
  langgraphPort: 5507,
  angularProject: 'cockpit-chat-timeline-angular',
  angularPort: 4507,
  fixturesDir: resolve(__dirname, 'fixtures'),
});
