import { mkdtemp, readFile, stat, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import {
  writeRecord,
  readRecord,
  createReviewPacket,
  scoreReview,
} from '../src/pilot/reports.js';

it('writes restrictive atomic records and refuses traversal or overwrite', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pilot-report-'));
  const id = randomUUID();
  await writeRecord(root, id, { outcome: 'failed', usage: null });
  expect(await readRecord(root, id)).toEqual({
    outcome: 'failed',
    usage: null,
  });
  expect((await stat(join(root, `${id}.json`))).mode & 0o777).toBe(0o600);
  await expect(writeRecord(root, id, { changed: true })).rejects.toThrow();
  await expect(readRecord(root, '../secret')).rejects.toThrow();
  const other = await mkdtemp(join(tmpdir(), 'pilot-outside-'));
  const linked = join(root, 'linked');
  await symlink(other, linked);
  await expect(writeRecord(linked, randomUUID(), {})).rejects.toThrow();
  expect(await readFile(join(root, `${id}.json`), 'utf8')).not.toContain(
    'changed'
  );
});

it('exports blinded evidence and scores only explicit human labels with denominators', () => {
  const records = [
    {
      runId: randomUUID(),
      caseId: 'clear',
      corpusKind: 'synthetic',
      corpusHash: 'hash',
      approach: 'agent',
      outcome: 'completed',
      claims: [{ text: 'Tools', sourceIds: ['source-1'] }],
      profile: { name: 'Atlas' },
      sources: [{ id: 'source-1', snippets: ['Tools'] }],
      expected: {
        claims: ['Tools'],
        unknowns: ['description', 'industry'],
        contradiction: false,
      },
    },
  ];
  const packet = createReviewPacket(records);
  expect(JSON.stringify(packet)).not.toContain('"approach"');
  expect(scoreReview(packet)).toMatchObject({
    reviewedRuns: 0,
    totalRuns: 1,
    support: null,
  });
  const review = [
    {
      reviewId: packet.items[0].reviewId,
      supportedClaims: 1,
      reviewedClaims: 1,
      supportedFields: 1,
      applicableFields: 1,
      correctAbstentions: 0,
      applicableAbstentions: 2,
      contradictionsMissed: 0,
    },
  ];
  expect(scoreReview(packet, review)).toMatchObject({
    reviewedRuns: 1,
    totalRuns: 1,
    support: { numerator: 1, denominator: 1 },
  });
  expect(() =>
    scoreReview(packet, [{ ...review[0], reviewId: randomUUID() }])
  ).toThrow();
  expect(() =>
    scoreReview(packet, [{ ...review[0], supportedClaims: 2 }])
  ).toThrow();
  expect(() =>
    scoreReview(packet, [
      { ...review[0], supportedClaims: 999, reviewedClaims: 999 },
    ])
  ).toThrow();
  const incomplete = createReviewPacket([
    ...records,
    { ...records[0], runId: randomUUID(), outcome: 'failed', claims: [] },
  ]);
  expect(scoreReview(incomplete, review)).toMatchObject({
    support: null,
    coverage: null,
    reviewedRuns: 1,
    totalRuns: 2,
  });
  expect(() =>
    createReviewPacket([
      ...records,
      { ...records[0], runId: randomUUID(), corpusKind: 'public' },
    ])
  ).toThrow();
});
