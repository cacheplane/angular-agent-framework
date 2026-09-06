import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

vi.mock('server-only', () => ({}));

import { deriveStageProof, STAGE_PROOF } from './stage-proof';

const REC = resolve(
  __dirname,
  '../../../../examples/chat/angular/public/stage-replay.json'
);

interface Run {
  beat: string;
  action: { kind: string };
  events: { event: Dict }[];
}
type Dict = Record<string, unknown>;

/** Structured clone of one run so a case can edit it without touching the fixture. */
const cloneRun = (r: Run): Run => JSON.parse(JSON.stringify(r)) as Run;

describe('stage proof', () => {
  const rec = JSON.parse(readFileSync(REC, 'utf8'));
  const proof = deriveStageProof(rec);

  it('counts the first beat from the recording, never types it', () => {
    expect(proof.stream).toBe('586 events · 1 tool call · 3 sources');
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

  it('maps the fork checkpointIndex onto the chronological step ordinal', () => {
    // checkpointIndex 9 indexes the newest-first history the user forked
    // FROM (the snapshot with 3 runs completed, 10 states): 10 - 9 = step 1,
    // the first checkpoint. The devtools label that row `__start__`; the
    // ordinal is the count the copy can be checked against.
    expect(proof.persist).toBe('reloaded · 10 checkpoints · forked at step 1');
  });

  it('reads the pending interrupt and the checkpoint count', () => {
    // The approve run ends interrupted, so there is no snapshot with 5 runs
    // completed; the line reads the latest one at or before that count.
    expect(proof.approve).toBe('1 interrupt pending · checkpoint 10 of 10');
  });

  it('counts the interrupts the approve run left pending', () => {
    const twoInterrupts = {
      ...rec,
      runs: rec.runs.map((r: Run) => {
        if (r.beat !== 'approve' || r.action.kind !== 'submit') return r;
        const c = cloneRun(r);
        let seen = 0;
        for (const { event } of c.events) {
          for (const holder of [event, event['data'] as Dict | undefined]) {
            const list = holder?.['__interrupt__'];
            if (Array.isArray(list) && list.length > 0) {
              list.push(list[0]);
              seen += 1;
            }
          }
        }
        expect(seen).toBeGreaterThan(0);
        return c;
      }),
    };
    expect(deriveStageProof(twoInterrupts).approve).toBe(
      '2 interrupts pending · checkpoint 10 of 10'
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
    // Strip only additional_kwargs.citations from the final AI message of
    // run 0's last `values` event; the events and the tool call stay.
    const noCitations = {
      ...rec,
      runs: rec.runs.map((r: Run, i: number) => {
        if (i !== 0) return r;
        const c = cloneRun(r);
        const last = c.events
          .map(({ event }) => event)
          .filter((ev) => ev['type'] === 'values')
          .at(-1);
        const messages = (last?.['data'] as Dict)['messages'] as {
          type?: string;
          additional_kwargs?: Dict;
        }[];
        const ai = messages.filter((m) => m.type === 'ai').at(-1);
        expect(Array.isArray(ai?.additional_kwargs?.['citations'])).toBe(true);
        delete ai?.additional_kwargs?.['citations'];
        return c;
      }),
    };
    const p = deriveStageProof(noCitations);
    expect(p.stream).toBe('586 events · 1 tool call');
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
