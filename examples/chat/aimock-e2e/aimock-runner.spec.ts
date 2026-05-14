// SPDX-License-Identifier: MIT
import { describe, it, expect, afterEach } from 'vitest';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { startAimock, type AimockHandle } from './aimock-runner';

describe('startAimock', () => {
  let handle: AimockHandle | null = null;
  let workDir = '';

  afterEach(async () => {
    if (handle) await handle.stop();
    handle = null;
    if (workDir) rmSync(workDir, { recursive: true, force: true });
    workDir = '';
  });

  it('boots a replay server backed by a fixture file', async () => {
    workDir = mkdtempSync(join(tmpdir(), 'aimock-test-'));
    const fixturePath = join(workDir, 'hi.json');
    writeFileSync(
      fixturePath,
      JSON.stringify({
        fixtures: [
          { match: { userMessage: 'say hi briefly' }, response: { content: 'Hi!' } },
        ],
      }),
    );

    handle = await startAimock({ mode: 'replay', fixturePath });
    expect(handle.port).toBeGreaterThan(0);
    expect(handle.baseUrl).toMatch(/^http:\/\/.+\/v1$/);

    // The OpenAI SDK call path is exercised in Task 0's de-risk; this
    // unit test stops at "the harness started cleanly and exposes the
    // documented shape."
  });

  it('stop() is idempotent', async () => {
    workDir = mkdtempSync(join(tmpdir(), 'aimock-test-'));
    const fixturePath = join(workDir, 'hi.json');
    writeFileSync(fixturePath, JSON.stringify({ fixtures: [] }));
    handle = await startAimock({ mode: 'replay', fixturePath });
    await handle.stop();
    await handle.stop();
    expect(true).toBe(true);
  });
});
