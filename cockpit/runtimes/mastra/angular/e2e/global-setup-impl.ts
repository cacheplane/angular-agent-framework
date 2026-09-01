// SPDX-License-Identifier: MIT
// Hand-rolled global setup for the ONLY cockpit cap whose backend is not
// Python: the rt-mastra topic is served by the deployments/ag-ui-mastra
// Node service. This mirrors createAgUiGlobalSetup (libs/e2e-harness) —
// aimock + backend + Angular dev server, state registered in
// __AIMOCK_HARNESS_STATE__ so the shared global-teardown cleans up — but
// spawns `node server.mjs` instead of `uv run uvicorn`, with the model
// redirected to aimock via OPENAI_BASE_URL (Mastra's model router honors it,
// and calls the OpenAI responses API, which aimock speaks).
import { execSync, spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { portsFor } from '../../../../../cockpit/ports.mjs';
import { startAimock, type AimockHandle } from '@threadplane-internal/e2e-harness';

const ports = portsFor('cockpit-runtimes-mastra-angular');
const angularProject = 'cockpit-runtimes-mastra-angular';
// Parsed by apps/cockpit/cockpit-e2e-wiring.spec.ts (accepts backendCwd for
// Node-hosted backends alongside langgraphCwd/pythonCwd — keep the
// `backendCwd: '<path>'` literal shape).
const wiring = { backendCwd: 'deployments/ag-ui-mastra' };
const backendCwd = wiring.backendCwd;
const backendPort = ports.langgraph; // "backend port" by the AG-UI convention
const angularPort = ports.angular;
const INTERNAL_TOKEN = 'dev-local-token'; // proxy.conf.mjs injects the same default

interface SharedState {
  aimock: AimockHandle;
  backend?: ChildProcess;
  backendPort?: number;
  angular: ChildProcess;
  angularPort: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __AIMOCK_HARNESS_STATE__: Map<string, SharedState> | undefined;
}

async function waitForPort(url: string, timeoutMs: number, label: string): Promise<void> {
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
  throw new Error(`[${label}] not ready at ${url} within ${timeoutMs}ms`);
}

export default async function globalSetup(): Promise<void> {
  const root = resolve(__dirname, '../../../../..');
  const fixturesDir = resolve(__dirname, 'fixtures');
  const serviceDir = resolve(root, backendCwd);

  const aimock = await startAimock({ mode: 'replay', fixturePath: fixturesDir });
  console.log(`[mastra-harness] aimock listening at ${aimock.baseUrl}`);

  // The service is self-contained (own package.json + lockfile, deps NOT in
  // the root workspace). Install once per checkout; CI runners start clean.
  if (!existsSync(join(serviceDir, 'node_modules'))) {
    console.log('[mastra-harness] npm ci in deployments/ag-ui-mastra');
    execSync('npm ci --no-audit --no-fund', { cwd: serviceDir, stdio: 'inherit' });
  }

  // Fresh LibSQL file per run: suspended-run snapshots and memory from a
  // previous e2e run must not leak into this one.
  const dbDir = mkdtempSync(join(tmpdir(), 'ag-ui-mastra-e2e-'));

  const backend = spawn('node', ['server.mjs'], {
    cwd: serviceDir,
    env: {
      ...process.env,
      PORT: String(backendPort),
      AG_UI_INTERNAL_TOKEN: INTERNAL_TOKEN,
      OPENAI_API_KEY: 'test-not-used',
      OPENAI_BASE_URL: aimock.baseUrl,
      AG_UI_MASTRA_DB_PATH: join(dbDir, 'mastra.db'),
    },
    stdio: 'pipe',
    // Own process group so the shared teardown can kill the whole tree.
    detached: true,
  });
  backend.stdout?.on('data', (b) => process.stdout.write(`[ag-ui-mastra] ${b}`));
  backend.stderr?.on('data', (b) => process.stderr.write(`[ag-ui-mastra] ${b}`));

  await waitForPort(`http://localhost:${backendPort}/ok`, 90_000, 'ag-ui-mastra');
  console.log(`[mastra-harness] backend ready on :${backendPort}`);

  const angular = spawn(
    'npx',
    ['nx', 'serve', angularProject, '--port', String(angularPort)],
    {
      cwd: root,
      env: { ...process.env, AG_UI_INTERNAL_TOKEN: INTERNAL_TOKEN },
      stdio: 'pipe',
      detached: true,
    },
  );
  angular.stdout?.on('data', (b) => process.stdout.write(`[angular] ${b}`));
  angular.stderr?.on('data', (b) => process.stderr.write(`[angular] ${b}`));

  await waitForPort(`http://localhost:${angularPort}/`, 120_000, 'angular');
  console.log(`[mastra-harness] angular ready on :${angularPort}`);

  if (!globalThis.__AIMOCK_HARNESS_STATE__) {
    globalThis.__AIMOCK_HARNESS_STATE__ = new Map();
  }
  globalThis.__AIMOCK_HARNESS_STATE__.set(angularProject, {
    aimock,
    backend,
    backendPort,
    angular,
    angularPort,
  });
}
