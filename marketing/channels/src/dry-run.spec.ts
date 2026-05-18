import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { writeDryRunResult } from './dry-run';
import type { Draft } from './types';

let cwd: string;
let origCwd: string;

beforeEach(() => {
  origCwd = process.cwd();
  cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'dry-run-test-'));
  process.chdir(cwd);
});

afterEach(() => {
  process.chdir(origCwd);
  fs.rmSync(cwd, { recursive: true, force: true });
});

describe('writeDryRunResult', () => {
  it('writes a JSON file under marketing/cowork/outbox/dry-runs and returns a synthetic PostResult', async () => {
    const draft: Draft = { channel: 'x', text: 'hello' };
    const result = await writeDryRunResult(draft);

    expect(result.channel).toBe('x');
    expect(result.postId).toMatch(/^dry-[0-9a-f-]{36}$/);
    expect(result.url).toBe(`https://dry-run.local/x/${result.postId}`);
    expect(typeof result.postedAt).toBe('string');

    const outFile = path.join(
      cwd,
      'marketing',
      'cowork',
      'outbox',
      'dry-runs',
      `${result.postId}.json`,
    );
    expect(fs.existsSync(outFile)).toBe(true);
    const parsed = JSON.parse(fs.readFileSync(outFile, 'utf8'));
    expect(parsed.draft).toEqual({ channel: 'x', text: 'hello' });
    expect(typeof parsed.simulatedAt).toBe('string');
  });

  it('serializes Buffer media as base64 strings to keep the file portable', async () => {
    const draft: Draft = {
      channel: 'x',
      text: 'hi',
      media: [{ png: Buffer.from('hello'), alt: 'h' }],
    };
    const result = await writeDryRunResult(draft);
    const outFile = path.join(
      cwd,
      'marketing',
      'cowork',
      'outbox',
      'dry-runs',
      `${result.postId}.json`,
    );
    const parsed = JSON.parse(fs.readFileSync(outFile, 'utf8'));
    expect(parsed.draft.media[0].png).toBe('aGVsbG8='); // base64('hello')
    expect(parsed.draft.media[0].alt).toBe('h');
  });
});
