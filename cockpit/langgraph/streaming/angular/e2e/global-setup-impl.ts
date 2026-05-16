// SPDX-License-Identifier: MIT
import { resolve } from 'node:path';
import { createGlobalSetup } from '../../../../../libs/internal/aimock-harness/src';

export default createGlobalSetup({
  langgraphCwd: 'cockpit/langgraph/streaming/python',
  angularProject: 'cockpit-langgraph-streaming-angular',
  angularPort: 4300,
  fixturesDir: resolve(__dirname, 'fixtures'),
});
