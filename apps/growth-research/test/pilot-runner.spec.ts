import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { runCorpus } from '../src/pilot/runner.js';
import { readRecord } from '../src/pilot/reports.js';

it('retains failures and creates independent sequential repetition records', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pilot-runner-'));
  const corpus = {
    version: 'test',
    repetitions: 2,
    cases: [
      {
        id: 'empty',
        kind: 'synthetic',
        domain: 'empty.example',
        pages: [],
        expected: {
          claims: [],
          unknowns: ['name', 'description', 'industry'],
          contradiction: false,
        },
      },
    ],
  };
  let active = 0,
    calls = 0;
  const result = await runCorpus(corpus, 'baseline', {
    root,
    revision: 'test',
    baseline: async () => {
      expect(active++).toBe(0);
      calls++;
      await Promise.resolve();
      active--;
      if (calls === 1) throw new Error('secret raw message');
      return {
        profile: { name: null, description: null, industry: null },
        claims: [],
        invalidCitationCount: 0,
        usage: { inputTokens: 2, outputTokens: 3 },
        model: 'fixture',
        modelCalls: 1,
      };
    },
  });
  expect(result.runIds).toHaveLength(2);
  expect(new Set(result.runIds).size).toBe(2);
  const records = await Promise.all(
    result.runIds.map((id) => readRecord(root, id))
  );
  expect(records[0]).toMatchObject({
    outcome: 'failed',
    errorCode: 'research_failed',
  });
  expect(records[1]).toMatchObject({ outcome: 'completed', repetition: 2 });
  expect(JSON.stringify(records)).not.toContain('secret raw');
});

it('fails corpus validation before any model work', async () => {
  let called = false;
  await expect(
    runCorpus({}, 'baseline', {
      root: '/unused',
      revision: 'test',
      baseline: async () => {
        called = true;
        throw new Error();
      },
    })
  ).rejects.toThrow();
  expect(called).toBe(false);
  const empty = {
    id: 'empty',
    kind: 'synthetic',
    domain: 'empty.example',
    pages: [],
    expected: {
      claims: [],
      unknowns: ['name', 'description', 'industry'],
      contradiction: false,
    },
  };
  await expect(
    runCorpus(
      {
        version: 'mixed',
        repetitions: 1,
        cases: [empty, { ...empty, id: 'public', kind: 'public' }],
      },
      'baseline',
      {
        root: '/unused',
        revision: 'test',
        baseline: async () => {
          called = true;
          throw new Error();
        },
      }
    )
  ).rejects.toThrow();
  await expect(
    runCorpus(
      {
        version: 'large',
        repetitions: 1,
        cases: Array.from({ length: 7 }, (_, i) => ({
          ...empty,
          id: `case-${i}`,
        })),
      },
      'baseline',
      {
        root: '/unused',
        revision: 'test',
        baseline: async () => {
          called = true;
          throw new Error();
        },
      }
    )
  ).rejects.toThrow();
  expect(called).toBe(false);
});
