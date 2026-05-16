// SPDX-License-Identifier: MIT
import { resolve } from 'node:path';
import { createGlobalSetup } from '../../../../../libs/internal/aimock-harness/src';

export default createGlobalSetup({
  langgraphCwd: 'cockpit/langgraph/streaming/python',
  angularProject: 'cockpit-chat-tool-calls-angular',
  angularPort: 4504,
  fixturesDir: resolve(__dirname, 'fixtures'),
});
