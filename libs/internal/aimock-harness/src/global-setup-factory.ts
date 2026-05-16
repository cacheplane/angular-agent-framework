// SPDX-License-Identifier: MIT
import { spawn, type ChildProcess } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { resolve } from 'node:path';
import { startAimock, type AimockHandle } from './aimock-runner';

export interface CreateGlobalSetupOpts {
  /** Repo-relative path to the python langgraph project. */
  langgraphCwd: string;
  /** Port the langgraph dev server binds. Default: 8123. */
  langgraphPort?: number;
  /** Nx project name of the Angular dev server. */
  angularProject: string;
  /** Port the Angular dev server should bind. */
  angularPort: number;
  /** Absolute path to the per-example fixtures dir. */
  fixturesDir: string;
  /** Default 90_000. */
  langgraphReadyTimeoutMs?: number;
  /** Default 120_000. */
  angularReadyTimeoutMs?: number;
}

interface SharedState {
  aimock: AimockHandle;
  langgraph: ChildProcess;
  angular: ChildProcess;
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
      // server not up yet
    }
    await delay(500);
  }
  throw new Error(`[${label}] not ready at ${url} within ${timeoutMs}ms`);
}

function repoRoot(opts: CreateGlobalSetupOpts): string {
  // The factory is called from per-example playwright configs that themselves
  // live many levels deep. We compute REPO_ROOT relative to the fixturesDir
  // (which the consumer passes as an absolute path) so the consumer doesn't
  // need to pass it explicitly. The repo root is the nearest ancestor that
  // contains a `cockpit/` directory; for our layout, walking up from any
  // per-example fixturesDir hits the repo root in 5 levels.
  let dir = opts.fixturesDir;
  for (let i = 0; i < 10; i++) {
    if (require('node:fs').existsSync(require('node:path').join(dir, 'cockpit'))) {
      return dir;
    }
    dir = require('node:path').dirname(dir);
  }
  throw new Error('repo root not found from fixturesDir; passed: ' + opts.fixturesDir);
}

export function createGlobalSetup(opts: CreateGlobalSetupOpts): () => Promise<void> {
  const langgraphPort = opts.langgraphPort ?? 8123;
  const langgraphTimeout = opts.langgraphReadyTimeoutMs ?? 90_000;
  const angularTimeout = opts.angularReadyTimeoutMs ?? 120_000;

  return async function globalSetup(): Promise<void> {
    const root = repoRoot(opts);
    const aimock = await startAimock({ mode: 'replay', fixturePath: opts.fixturesDir });
    // eslint-disable-next-line no-console
    console.log(`[aimock-harness] aimock listening at ${aimock.baseUrl}`);

    const langgraph = spawn(
      'uv',
      ['run', 'langgraph', 'dev', '--port', String(langgraphPort), '--no-browser'],
      {
        cwd: resolve(root, opts.langgraphCwd),
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

    await waitForPort(`http://localhost:${langgraphPort}/ok`, langgraphTimeout, 'langgraph');
    // eslint-disable-next-line no-console
    console.log(`[aimock-harness] langgraph ready on :${langgraphPort}`);

    const angular = spawn(
      'npx',
      ['nx', 'serve', opts.angularProject, '--port', String(opts.angularPort)],
      {
        cwd: root,
        env: { ...process.env },
        stdio: 'pipe',
      },
    );
    angular.stdout?.on('data', (b) => process.stdout.write(`[angular] ${b}`));
    angular.stderr?.on('data', (b) => process.stderr.write(`[angular] ${b}`));

    await waitForPort(`http://localhost:${opts.angularPort}/`, angularTimeout, 'angular');
    // eslint-disable-next-line no-console
    console.log(`[aimock-harness] angular ready on :${opts.angularPort} (${opts.angularProject})`);

    if (!globalThis.__AIMOCK_HARNESS_STATE__) {
      globalThis.__AIMOCK_HARNESS_STATE__ = new Map();
    }
    globalThis.__AIMOCK_HARNESS_STATE__.set(opts.angularProject, { aimock, langgraph, angular });
  };
}
