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

// Raw JSON entry shape passes through to aimock's FixtureFileEntry — the
// `match` block can carry richer discriminators (toolName, hasToolResult,
// turnIndex, etc.) that are needed to distinguish a parent LLM's first call
// from its continuation after a tool round. We don't narrow the shape here;
// aimock's `addFixturesFromJSON` validates structure at load time.
type FixtureFileEntry = Record<string, unknown>;

function loadFixtureEntries(fixturePath: string): FixtureFileEntry[] {
  const stats = statSync(fixturePath);
  const out: FixtureFileEntry[] = [];
  const readFile = (full: string): void => {
    const raw = readFileSync(full, 'utf-8');
    const parsed = JSON.parse(raw) as { fixtures: FixtureFileEntry[] };
    for (const fx of parsed.fixtures) out.push(fx);
  };
  if (stats.isDirectory()) {
    const files = readdirSync(fixturePath)
      .filter((f) => f.endsWith('.json'))
      .sort();
    for (const file of files) readFile(join(fixturePath, file));
    return out;
  }
  readFile(fixturePath);
  return out;
}

export async function startAimock(
  opts: AimockStartOptions
): Promise<AimockHandle> {
  const entries = loadFixtureEntries(opts.fixturePath);

  // Keep ordinary fixtures fast with a large default chunk. Progressive
  // rendering regressions opt into deterministic chunk sizes and latency on
  // the individual fixture so they exercise the complete AG-UI transport.
  const mock = new LLMock({ port: 0, chunkSize: 4096 });
  if (entries.length > 0) {
    mock.addFixturesFromJSON(entries as never);
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
