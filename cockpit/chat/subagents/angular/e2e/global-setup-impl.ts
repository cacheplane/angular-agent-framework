// SPDX-License-Identifier: MIT
import { resolve } from 'node:path';
import { portsFor } from '../../../../../cockpit/ports.mjs';
import { createGlobalSetup } from '@threadplane-internal/e2e-harness';

const ports = portsFor('cockpit-chat-subagents-angular');

export default createGlobalSetup({
  // Per-cap cleanup PR: each chat cap runs its OWN standalone backend
  // (cockpit/chat/<name>/python) on `<angular_port> + 1000`. The
  // proxy.conf.json target matches.
  langgraphCwd: 'cockpit/chat/subagents/python',
  langgraphPort: ports.langgraph,
  angularProject: 'cockpit-chat-subagents-angular',
  angularPort: ports.angular,
  fixturesDir: resolve(__dirname, 'fixtures'),
});
