/// <reference types="node" />
// The app build type-checks src/**/*.ts with `types: []`; this spec is the one
// file that reads from disk, so it pulls in the node globals it needs itself.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateHeroRecording } from './hero-recording.types';

const FIXTURE = resolve(__dirname, '../../../public/hero-replay.json');

describe('hero-replay.json', () => {
  const rec = validateHeroRecording(JSON.parse(readFileSync(FIXTURE, 'utf8')));
  it('has the prompt, resume and genui runs in order', () => {
    expect(rec.runs.slice(0, 3).map((r) => r.label)).toEqual(['prompt', 'resume', 'genui']);
  });
  it('the prompt run pauses on an interrupt', () => {
    expect(JSON.stringify(rec.runs[0].events)).toMatch(/approval_request/);
  });
  it('the genui run carries an A2UI payload', () => {
    expect(JSON.stringify(rec.runs[2].events)).toMatch(/a2ui/i);
  });
  it('never contains an API key or bearer token', () => {
    expect(JSON.stringify(rec)).not.toMatch(/sk-[A-Za-z0-9]{10,}|Bearer /);
  });
});
