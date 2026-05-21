// SPDX-License-Identifier: MIT
import { resolve } from 'node:path';
import { createGlobalSetup } from '@ngaf-internal/e2e-harness';

export default createGlobalSetup({
  // Per-cap cleanup PR: each chat cap runs its OWN standalone backend
  // (cockpit/chat/<name>/python) on `<angular_port> + 1000`. The
  // proxy.conf.json target matches.
  langgraphCwd: 'cockpit/chat/interrupts/python',
  langgraphPort: 5503,
  angularProject: 'cockpit-chat-interrupts-angular',
  angularPort: 4503,
  fixturesDir: resolve(__dirname, 'fixtures'),
});
