import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { deriveStageProof, STAGE_PROOF } from './stage-proof';

const REC = resolve(
  __dirname,
  '../../../../examples/chat/angular/public/stage-replay.json'
);

interface Run {
  beat: string;
  events: unknown[];
}

describe('stage proof', () => {
  const rec = JSON.parse(readFileSync(REC, 'utf8'));
  const proof = deriveStageProof(rec);

  it('counts the first beat from the recording, never types it', () => {
    expect(proof.stream).toMatch(/^\d{3,} events · 1 tool call · \d sources$/);
    expect(proof.stream.startsWith(`${rec.runs[0].events.length} events`)).toBe(
      true
    );
  });

  it('counts the sources the frame badge shows, not the search hits', () => {
    // The Sources badge counts additional_kwargs.citations on the final AI
    // message; the committed take has three.
    expect(proof.stream).toMatch(/ · 3 sources$/);
  });

  it('reads the reload, the checkpoint count and the fork step', () => {
    expect(proof.persist).toMatch(
      /^reloaded · \d+ checkpoints · forked at step \d+$/
    );
  });

  it('maps the fork checkpointIndex onto the devtools step label', () => {
    // history() is newest-first: index 9 of 10 states is step 1.
    expect(proof.persist).toBe('reloaded · 10 checkpoints · forked at step 1');
  });

  it('reads the pending interrupt and the checkpoint count', () => {
    expect(proof.approve).toMatch(
      /^1 interrupt pending · checkpoint \d+ of \d+$/
    );
  });

  it('reads the surface and its component count', () => {
    expect(proof.render).toMatch(
      /^1 surface · \d+ components · no generated code ran$/
    );
  });

  it('counts every A2UI component in the surface, containers included', () => {
    // Column + Name + Email address + Subject + Message + Send + its label.
    expect(proof.render).toBe(
      '1 surface · 7 components · no generated code ran'
    );
  });

  it('drops a segment it cannot derive instead of defaulting it', () => {
    const noCitations = {
      ...rec,
      runs: rec.runs.map((r: Run, i: number) =>
        i === 0 ? { ...r, events: [] } : r
      ),
    };
    const p = deriveStageProof(noCitations);
    expect(p.stream).not.toMatch(/sources/);
    expect(p.stream).not.toMatch(/NaN|undefined/);
  });

  it('drops the surface clauses when the render run has no surface', () => {
    const noSurface = {
      ...rec,
      runs: rec.runs.map((r: Run) =>
        r.beat === 'render' ? { ...r, events: [] } : r
      ),
    };
    const p = deriveStageProof(noSurface);
    expect(p.render).toBe('no generated code ran');
  });

  it('is what the page ships', () => {
    expect(STAGE_PROOF).toEqual(proof);
  });
});
