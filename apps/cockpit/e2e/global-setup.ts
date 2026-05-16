// SPDX-License-Identifier: MIT
import { spawn, type ChildProcess } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { resolve } from 'node:path';
import { startAimock, type AimockHandle } from './aimock-runner';

interface SharedState {
  aimock: AimockHandle;
  langgraph: ChildProcess;
  angular: ChildProcess;
}

declare global {
  // eslint-disable-next-line no-var
  var __COCKPIT_AIMOCK_E2E_STATE__: SharedState | undefined;
}

const REPO_ROOT = resolve(__dirname, '../../..');
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
      // server not up yet
    }
    await delay(500);
  }
  throw new Error(`Server at ${url} did not become ready within ${timeoutMs}ms`);
}

export default async function globalSetup(): Promise<void> {
  const aimock = await startAimock({ mode: 'replay', fixturePath: FIXTURE_PATH });
  // eslint-disable-next-line no-console
  console.log(`[cockpit] aimock listening at ${aimock.baseUrl}`);

  const langgraph = spawn(
    'uv',
    ['run', 'langgraph', 'dev', '--port', '8123', '--no-browser'],
    {
      cwd: resolve(REPO_ROOT, 'cockpit/langgraph/streaming/python'),
      env: {
        ...process.env,
        OPENAI_BASE_URL: aimock.baseUrl,
        OPENAI_API_KEY: 'test-not-used',
      },
      stdio: 'pipe',
    },
  );
  langgraph.stdout?.on('data', (b) => process.stdout.write(`[langgraph] ${b}`));
  langgraph.stderr?.on('data', (b) => process.stderr.write(`[langgraph] ${b}`));

  await waitForPort('http://localhost:8123/ok', 90_000);
  // eslint-disable-next-line no-console
  console.log('[cockpit] langgraph ready on :8123');

  const angular = spawn(
    'npx',
    ['nx', 'serve', 'cockpit-langgraph-streaming-angular', '--port', '4300'],
    {
      cwd: REPO_ROOT,
      env: { ...process.env },
      stdio: 'pipe',
    },
  );
  angular.stdout?.on('data', (b) => process.stdout.write(`[angular] ${b}`));
  angular.stderr?.on('data', (b) => process.stderr.write(`[angular] ${b}`));

  await waitForPort('http://localhost:4300/', 120_000);
  // eslint-disable-next-line no-console
  console.log('[cockpit] angular ready on :4300');

  globalThis.__COCKPIT_AIMOCK_E2E_STATE__ = { aimock, langgraph, angular };
}
