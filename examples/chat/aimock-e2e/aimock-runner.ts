// SPDX-License-Identifier: MIT
import { LLMock } from '@copilotkit/aimock';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

export interface AimockHandle {
  /** Port the mock server is listening on. */
  readonly port: number;
  /** Full base URL the OpenAI SDK should target (includes /v1 suffix). */
  readonly baseUrl: string;
  /** Tear down the server. Safe to call multiple times. */
  stop(): Promise<void>;
}

export interface AimockStartOptions {
  mode: 'replay';
  /** Path to a single fixture file OR a directory of fixture files. */
  fixturePath: string;
}

interface FixtureFile {
  fixtures: ReadonlyArray<{
    match: { userMessage: string };
    response: { content: string };
  }>;
}

function loadFixtureEntries(fixturePath: string): FixtureFile['fixtures'] {
  const stats = statSync(fixturePath);
  if (stats.isDirectory()) {
    const merged: FixtureFile['fixtures'][number][] = [];
    const files = readdirSync(fixturePath)
      .filter((f) => f.endsWith('.json'))
      .sort();
    for (const file of files) {
      const raw = readFileSync(join(fixturePath, file), 'utf-8');
      const parsed = JSON.parse(raw) as FixtureFile;
      for (const fx of parsed.fixtures) merged.push(fx);
    }
    return merged;
  }
  const raw = readFileSync(fixturePath, 'utf-8');
  const parsed = JSON.parse(raw) as FixtureFile;
  return parsed.fixtures;
}

export async function startAimock(opts: AimockStartOptions): Promise<AimockHandle> {
  const entries = loadFixtureEntries(opts.fixturePath);

  // Use a large chunkSize so each response arrives in 1-2 SSE deltas. This
  // intentionally turns off the partial-markdown streaming path for harness
  // tests: structural assertions (code fence, list) measure the FINAL rendered
  // DOM, not the progressive render. With aggressive default chunking, the
  // partial-markdown parser sometimes can't recover a triple-backtick fence
  // that gets split mid-token, and the final state ends up as inline <code>
  // instead of <pre><code>. Streaming-progressive behavior is covered by the
  // Phase 1 unit-variance tables; the e2e harness is for final-state
  // invariants and cross-stack integration.
  const mock = new LLMock({ port: 0, chunkSize: 4096 });
  for (const fx of entries) {
    mock.onMessage(fx.match.userMessage, fx.response);
  }
  await mock.start();

  const port = mock.port;
  const baseUrl = `${mock.url}/v1`;
  let stopped = false;

  return {
    port,
    baseUrl,
    async stop() {
      if (stopped) return;
      stopped = true;
      await mock.stop();
    },
  };
}
