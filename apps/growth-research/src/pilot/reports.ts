import { constants } from 'node:fs';
import { link, lstat, mkdir, open, realpath, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

async function outputRoot(root: string) {
  await mkdir(root, { recursive: true, mode: 0o700 });
  const resolved = resolve(root);
  if ((await lstat(resolved)).isSymbolicLink())
    throw new Error('pilot_output_symlink');
  return realpath(resolved);
}
function recordId(id: string) {
  return z.uuid().parse(id);
}

export async function writeRecord(root: string, id: string, record: unknown) {
  const encoded = `${JSON.stringify(record, null, 2)}\n`;
  if (Buffer.byteLength(encoded) > 2 * 1024 * 1024)
    throw new Error('pilot_record_too_large');
  const directory = await outputRoot(root);
  const target = join(directory, `${recordId(id)}.json`);
  const temporary = join(directory, `.${randomUUID()}.tmp`);
  const handle = await open(temporary, 'wx', 0o600);
  try {
    await handle.writeFile(encoded);
    await handle.sync();
    await handle.close();
    await link(temporary, target); // Atomic publication that cannot overwrite an existing run.
  } finally {
    await handle.close();
    await unlink(temporary);
  }
}

export async function readRecord(root: string, id: string): Promise<unknown> {
  const directory = await outputRoot(root);
  const handle = await open(
    join(directory, `${recordId(id)}.json`),
    constants.O_RDONLY | constants.O_NOFOLLOW
  );
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.size > 2 * 1024 * 1024)
      throw new Error('pilot_invalid_record');
    return JSON.parse(await handle.readFile('utf8'));
  } finally {
    await handle.close();
  }
}

interface ReviewableRecord {
  runId: string;
  caseId: string;
  approach: string;
  outcome: string;
  corpusKind: string;
  corpusHash: string;
  claims: { text: string; sourceIds: string[] }[];
  profile: unknown;
  sources: unknown;
  expected: unknown;
}
export function createReviewPacket(records: ReviewableRecord[]) {
  if (
    new Set(
      records.map((record) => `${record.corpusKind}:${record.corpusHash}`)
    ).size !== 1 ||
    new Set(records.map((record) => record.runId)).size !== records.length
  )
    throw new Error('pilot_incompatible_review_records');
  // No approach/model/order/quote-shape hints in the blinded packet.
  const items = records
    .map((record) => ({
      reviewId: record.runId,
      caseId: record.caseId,
      outcome: record.outcome,
      claims: record.claims.map((claim) => ({
        text: claim.text,
        sourceIds: claim.sourceIds,
      })),
      profile: record.profile,
      sources: record.sources,
      expected: record.expected,
    }))
    .sort((a, b) => a.reviewId.localeCompare(b.reviewId));
  return {
    schemaVersion: 1 as const,
    corpusKind: records[0].corpusKind,
    corpusHash: records[0].corpusHash,
    items,
  };
}
const count = z.number().int().min(0).max(1000);
const Label = z
  .object({
    reviewId: z.uuid(),
    supportedClaims: count,
    reviewedClaims: count,
    supportedFields: count,
    applicableFields: count,
    correctAbstentions: count,
    applicableAbstentions: count,
    contradictionsMissed: count,
  })
  .strict();

export function scoreReview(
  packet: ReturnType<typeof createReviewPacket>,
  input: unknown = []
) {
  const labels = z.array(Label).parse(input);
  const ids = new Set(packet.items.map((item) => item.reviewId));
  if (new Set(labels.map((label) => label.reviewId)).size !== labels.length)
    throw new Error('pilot_duplicate_review');
  for (const label of labels) {
    if (
      !ids.has(label.reviewId) ||
      label.supportedClaims > label.reviewedClaims ||
      label.supportedFields > label.applicableFields ||
      label.correctAbstentions > label.applicableAbstentions
    )
      throw new Error('pilot_invalid_review');
    const item = packet.items.find((item) => item.reviewId === label.reviewId);
    if (!item) throw new Error('pilot_invalid_review');
    const expected = z
      .object({
        unknowns: z.array(z.enum(['name', 'description', 'industry'])).max(3),
        contradiction: z.boolean(),
      })
      .parse(item.expected);
    if (
      label.reviewedClaims !== item.claims.length ||
      label.applicableFields !== 3 - expected.unknowns.length ||
      label.applicableAbstentions !== expected.unknowns.length ||
      label.contradictionsMissed > Number(expected.contradiction)
    )
      throw new Error('pilot_invalid_review_counts');
  }
  const sum = (key: keyof Omit<z.infer<typeof Label>, 'reviewId'>) =>
    labels.reduce((total, label) => total + label[key], 0);
  const complete = labels.length === packet.items.length;
  return {
    totalRuns: packet.items.length,
    reviewedRuns: labels.length,
    unreviewedRuns: packet.items.length - labels.length,
    failedRuns: packet.items.filter((item) => item.outcome !== 'completed')
      .length,
    support: complete
      ? {
          numerator: sum('supportedClaims'),
          denominator: sum('reviewedClaims'),
        }
      : null,
    coverage: complete
      ? {
          numerator: sum('supportedFields'),
          denominator: sum('applicableFields'),
        }
      : null,
    abstentions: complete
      ? {
          numerator: sum('correctAbstentions'),
          denominator: sum('applicableAbstentions'),
        }
      : null,
    contradictionsMissed: complete ? sum('contradictionsMissed') : null,
  };
}
