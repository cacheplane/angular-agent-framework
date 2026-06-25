// SPDX-License-Identifier: MIT
import { spawn, type ChildProcess } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { resolve } from 'node:path';
import { startAimock, type AimockHandle } from './aimock-runner';

interface SharedState {
  aimock: AimockHandle;
  backend: ChildProcess;
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
      // not up yet
    }
    await delay(500);
  }
  throw new Error(`Server at ${url} did not become ready within ${timeoutMs}ms`);
}

export default async function globalSetup(): Promise<void> {
  const aimock = await startAimock({ mode: 'replay', fixturePath: FIXTURE_PATH });
  // eslint-disable-next-line no-console
  console.log(`[aimock-e2e] aimock listening at ${aimock.baseUrl}`);

  const backend = spawn(
    'uv',
    ['run', 'uvicorn', 'src.server:app', '--port', '8000'],
    {
      cwd: resolve(REPO_ROOT, 'examples/ag-ui/python'),
      env: {
        ...process.env,
        OPENAI_BASE_URL: aimock.baseUrl,
        OPENAI_API_KEY: 'test-not-used',
        // Run the backend in clone-and-run (unauthenticated) mode so the suite
        // is hermetic. The dev proxy forwards /agent without an x-internal-token
        // header, so if the developer's root .env defines AG_UI_INTERNAL_TOKEN
        // (used for the Railway deploys) nx leaks it into process.env and the
        // require_internal_token middleware 401s every run. Blanking it here
        // matches what the proxy + transport expect.
        AG_UI_INTERNAL_TOKEN: '',
      },
      stdio: 'pipe',
    },
  );
  backend.stdout?.on('data', (b) => process.stdout.write(`[uvicorn] ${b}`));
  backend.stderr?.on('data', (b) => process.stderr.write(`[uvicorn] ${b}`));

  await waitForPort('http://localhost:8000/ok', 60_000);
  // eslint-disable-next-line no-console
  console.log('[aimock-e2e] ag-ui backend ready on :8000');

  const angular = spawn(
    'npx',
    ['nx', 'serve', 'examples-ag-ui-angular', '--port', '4201'],
    {
      cwd: REPO_ROOT,
      env: { ...process.env },
      stdio: 'pipe',
    },
  );
  angular.stdout?.on('data', (b) => process.stdout.write(`[angular] ${b}`));
  angular.stderr?.on('data', (b) => process.stderr.write(`[angular] ${b}`));

  // 240s: a cold CI runner re-optimizes vite deps on first serve (especially
  // after a lockfile change), which can exceed the old 120s ready window.
  await waitForPort('http://localhost:4201/', 240_000);
  // eslint-disable-next-line no-console
  console.log('[aimock-e2e] angular ready on :4201');

  globalThis.__AIMOCK_E2E_STATE__ = { aimock, backend, angular };
}
