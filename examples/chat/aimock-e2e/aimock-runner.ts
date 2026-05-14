// SPDX-License-Identifier: MIT
import { LLMock } from '@copilotkit/aimock';
import { readFileSync } from 'node:fs';

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
  fixturePath: string;
}

interface FixtureFile {
  fixtures: ReadonlyArray<{
    match: { userMessage: string };
    response: { content: string };
  }>;
}

export async function startAimock(opts: AimockStartOptions): Promise<AimockHandle> {
  const raw = readFileSync(opts.fixturePath, 'utf-8');
  const parsed = JSON.parse(raw) as FixtureFile;

  const mock = new LLMock({ port: 0 });
  for (const fx of parsed.fixtures) {
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
