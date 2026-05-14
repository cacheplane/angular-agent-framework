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

  const mock = new LLMock({ port: 0 });
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
