// SPDX-License-Identifier: MIT
import { spawn, type ChildProcess } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { resolve } from 'node:path';
import { startAimock, type AimockHandle } from './aimock-runner';
import { freePort } from './process-utils';

const LANGGRAPH_PORT = 2024;
const ANGULAR_PORT = 4200;

interface SharedState {
  aimock: AimockHandle;
  langgraph: ChildProcess;
  angular: ChildProcess;
}

declare global {
  // eslint-disable-next-line no-var
  var __AIMOCK_E2E_STATE__: SharedState | undefined;
}

const REPO_ROOT = resolve(__dirname, '../../../..');
const FIXTURE_PATH = process.env.AIMOCK_FIXTURE
  ? resolve(__dirname, process.env.AIMOCK_FIXTURE)
  : resolve(__dirname, 'fixtures');

async function waitForPort(url: string, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 404) return;
    } catch {
      // ignored — server not up yet
    }
    await delay(500);
  }
  throw new Error(`Server at ${url} did not become ready within ${timeoutMs}ms`);
}

export default async function globalSetup(): Promise<void> {
  // Recover from a prior run that left an orphaned server bound to our ports
  // (teardown skipped on a hard kill, or a child outliving its parent). Without
  // this, `waitForPort` below would bind to the STALE server and silently test
  // the old bundle. See process-utils.freePort.
  freePort(LANGGRAPH_PORT);
  freePort(ANGULAR_PORT);

  const aimock = await startAimock({ mode: 'replay', fixturePath: FIXTURE_PATH });
  // eslint-disable-next-line no-console
  console.log(`[aimock-e2e] aimock listening at ${aimock.baseUrl}`);

  const langgraph = spawn(
    'uv',
    ['run', 'langgraph', 'dev', '--port', String(LANGGRAPH_PORT), '--no-browser'],
    {
      cwd: resolve(REPO_ROOT, 'examples/chat/python'),
      env: {
        ...process.env,
        OPENAI_BASE_URL: aimock.baseUrl,
        OPENAI_API_KEY: 'test-not-used',
      },
      stdio: 'pipe',
      // Lead its own process group so teardown can reap uvicorn (the real
      // port-holder), not just the `uv`/`langgraph` parent.
      detached: true,
    },
  );
  langgraph.stdout?.on('data', (b) => process.stdout.write(`[langgraph] ${b}`));
  langgraph.stderr?.on('data', (b) => process.stderr.write(`[langgraph] ${b}`));

  await waitForPort(`http://localhost:${LANGGRAPH_PORT}/ok`, 60_000);
  // eslint-disable-next-line no-console
  console.log('[aimock-e2e] langgraph ready on :2024');

  const angular = spawn(
    'npx',
    ['nx', 'serve', 'examples-chat-angular', '--port', String(ANGULAR_PORT)],
    {
      cwd: REPO_ROOT,
      env: { ...process.env },
      stdio: 'pipe',
      // Lead its own process group so teardown can reap the underlying Angular
      // build server (the real port-holder), not just the `nx`/`npx` parent.
      detached: true,
    },
  );
  angular.stdout?.on('data', (b) => process.stdout.write(`[angular] ${b}`));
  angular.stderr?.on('data', (b) => process.stderr.write(`[angular] ${b}`));

  await waitForPort(`http://localhost:${ANGULAR_PORT}/`, 120_000);
  // eslint-disable-next-line no-console
  console.log('[aimock-e2e] angular ready on :4200');

  globalThis.__AIMOCK_E2E_STATE__ = { aimock, langgraph, angular };
}
