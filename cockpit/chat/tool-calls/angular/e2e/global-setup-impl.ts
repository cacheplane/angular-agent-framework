// SPDX-License-Identifier: MIT
import { resolve } from 'node:path';
import { createGlobalSetup } from '../../../../../libs/e2e-harness/src';

export default createGlobalSetup({
  // Per-cap cleanup PR: each chat cap runs its OWN standalone backend
  // (cockpit/chat/<name>/python) on `<angular_port> + 1000`. The
  // proxy.conf.json target matches.
  langgraphCwd: 'cockpit/chat/tool-calls/python',
  langgraphPort: 5504,
  angularProject: 'cockpit-chat-tool-calls-angular',
  angularPort: 4504,
  fixturesDir: resolve(__dirname, 'fixtures'),
});
