import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { read, readOptional } from './snapshots';

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsc-snapshots-'));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('read', () => {
  it('parses a snapshot file', () => {
    fs.writeFileSync(path.join(dir, 'meta.json'), '{"startDate":"2026-01-01"}');
    expect(read<{ startDate: string }>(dir, 'meta.json')).toEqual({ startDate: '2026-01-01' });
  });

  it('names the missing file and points at the pull instead of throwing ENOENT', () => {
    expect(() => read(dir, 'queries.json')).toThrow(/Missing snapshot .*queries\.json/);
    expect(() => read(dir, 'queries.json')).toThrow(/npm run gsc:pull/);
  });

  it('reports malformed JSON with the offending file', () => {
    fs.writeFileSync(path.join(dir, 'pages.json'), '{ broken');
    expect(() => read(dir, 'pages.json')).toThrow(/Malformed JSON in .*pages\.json/);
  });
});

describe('readOptional', () => {
  it('returns null when the file is genuinely absent', () => {
    expect(readOptional(dir, 'inspection-errors.json')).toBeNull();
  });

  it('still rethrows on malformed JSON rather than reporting absence', () => {
    fs.writeFileSync(path.join(dir, 'inspection-errors.json'), '{ broken');
    expect(() => readOptional(dir, 'inspection-errors.json')).toThrow(/Malformed JSON/);
  });

  it('parses the file when it is present', () => {
    fs.writeFileSync(path.join(dir, 'inspection-errors.json'), '[{"url":"u","error":"429"}]');
    expect(readOptional(dir, 'inspection-errors.json')).toEqual([{ url: 'u', error: '429' }]);
  });
});
