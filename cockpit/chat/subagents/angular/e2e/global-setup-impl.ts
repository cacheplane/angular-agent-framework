// SPDX-License-Identifier: MIT
import { resolve } from 'node:path';
import { createGlobalSetup } from '@threadplane-internal/e2e-harness';

export default createGlobalSetup({
  // Per-cap cleanup PR: each chat cap runs its OWN standalone backend
  // (cockpit/chat/<name>/python) on `<angular_port> + 1000`. The
  // proxy.conf.json target matches.
  langgraphCwd: 'cockpit/chat/subagents/python',
  langgraphPort: 5505,
  angularProject: 'cockpit-chat-subagents-angular',
  angularPort: 4505,
  fixturesDir: resolve(__dirname, 'fixtures'),
});
