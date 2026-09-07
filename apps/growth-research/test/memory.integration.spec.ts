import { execFile } from 'node:child_process';
import { cp, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { linkFixtureDependencies } from './fixture-dependencies.js';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const execute = promisify(execFile);
const database = process.env['GROWTH_RESEARCH_TEST_DATABASE_URL'];
if (!database) throw new Error('GROWTH_RESEARCH_TEST_DATABASE_URL is required; no production fallback is permitted');

async function probe(action: string, fixture: 'atlas' | 'beacon', id?: string, root = appRoot) {
  const result = await execute(process.execPath, ['scripts/memory-probe.mts', action, ...(id ? [id] : [])], {
    cwd: root,
    timeout: 30_000,
    env: { ...process.env, DAWN_DATABASE_URL: database, GROWTH_RESEARCH_FIXTURE_MODE: 'synthetic-only', GROWTH_RESEARCH_FIXTURE_SLOT: fixture, OPENAI_API_KEY: 'synthetic-test-key' },
  });
  return JSON.parse(result.stdout.trim()) as { id: string; content: string; candidateIds: string[]; activeIds: string[]; recalled: string; pid: number };
}

it('persists candidates across fresh processes, excludes them from active recall, isolates fixture slots and preserves deletion', async () => {
  const written = await probe('write', 'atlas');
  const relocated = await mkdtemp(join(tmpdir(), 'growth-memory-relocated-'));
  let controlId: string | undefined;
  try {
    await cp(join(appRoot, 'src'), join(relocated, 'src'), { recursive: true });
    for (const name of ['dawn.config.ts', 'package.json']) await cp(join(appRoot, name), join(relocated, name));
    await mkdir(join(relocated, 'scripts'));
    await cp(join(appRoot, 'scripts/memory-probe.mts'), join(relocated, 'scripts/memory-probe.mts'));
    await linkFixtureDependencies(appRoot, relocated);
    const read = await probe('read', 'atlas');
    expect(read.pid).not.toBe(written.pid);
    expect(read.candidateIds).toContain(written.id);
    expect(read.activeIds).not.toContain(written.id);
    expect(read.recalled).not.toContain(written.id);
    const moved = await probe('read', 'atlas', undefined, relocated);
    expect(moved.candidateIds).toContain(written.id);
    const other = await probe('read', 'beacon');
    expect(other.candidateIds).not.toContain(written.id);
    expect(other.activeIds).not.toContain(written.id);
    const control = await probe('seed-active-control', 'atlas');
    controlId = control.id;
    expect(control.id).not.toBe(written.id);
    const positive = await probe('read', 'atlas', control.id);
    expect(positive.candidateIds).toContain(written.id);
    expect(positive.activeIds).not.toContain(written.id);
    expect(positive.activeIds).toContain(control.id);
    expect(positive.recalled).toContain(control.content);
    expect(positive.recalled).not.toContain(written.id);
    const positiveMoved = await probe('read', 'atlas', control.id, relocated);
    expect(positiveMoved.recalled).toContain(control.content);
    const negativeOther = await probe('read', 'beacon', control.id);
    expect(negativeOther.activeIds).not.toContain(control.id);
    expect(negativeOther.recalled).not.toContain(control.content);
    await probe('delete', 'atlas', written.id);
    const deleted = await probe('read', 'atlas');
    expect(deleted.candidateIds).not.toContain(written.id);
  } finally {
    try {
      await probe('delete', 'atlas', written.id);
      if (controlId) await probe('delete', 'atlas', controlId);
    } finally {
      await rm(relocated, { recursive: true, force: true });
    }
  }
}, 90_000);
