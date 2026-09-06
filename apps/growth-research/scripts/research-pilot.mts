import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { acquireCompanies } from '../src/pilot/acquisition.js';
import { syntheticCorpus } from '../src/pilot/fixtures.js';
import { validateCorpus, corpusHash } from '../src/pilot/corpus.js';
import { runCorpus } from '../src/pilot/runner.js';
import {
  createReviewPacket,
  readRecord,
  scoreReview,
  writeRecord,
} from '../src/pilot/reports.js';

const allowed: Record<string, string[]> = {
  synthetic: ['output'],
  acquire: ['output', 'domains'],
  run: ['output', 'corpus', 'approach'],
  inspect: ['output', 'run'],
  review: ['output', 'indices'],
  score: ['output', 'packet', 'labels'],
};
export function parsePilotArguments(argv: string[]) {
  const [command, ...rest] = argv;
  if (!command || !Object.hasOwn(allowed, command) || rest.length % 2)
    throw new Error('pilot_invalid_arguments');
  const args: Record<string, string> = { command };
  for (let i = 0; i < rest.length; i += 2) {
    const key = rest[i].slice(2);
    if (
      !rest[i].startsWith('--') ||
      !allowed[command].includes(key) ||
      key in args ||
      !rest[i + 1]
    )
      throw new Error('pilot_invalid_arguments');
    args[key] = rest[i + 1];
  }
  if (allowed[command].some((key) => !args[key]) || !isAbsolute(args.output))
    throw new Error('pilot_invalid_arguments');
  if (command === 'run' && args.approach !== 'agent')
    throw new Error('pilot_invalid_arguments');
  if (args.run) z.uuid().parse(args.run);
  if (args.packet) z.uuid().parse(args.packet);
  if (args.indices)
    for (const id of args.indices.split(',')) z.uuid().parse(id);
  return args;
}

async function inputJson(path: string) {
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.size > 2 * 1024 * 1024)
      throw new Error('pilot_invalid_input');
    return JSON.parse(await handle.readFile('utf8'));
  } finally {
    await handle.close();
  }
}

export async function main(
  argv: string[],
  log = (value: unknown) => console.log(JSON.stringify(value, null, 2))
) {
  const args = parsePilotArguments(argv);
  if (args.command === 'synthetic') {
    const id = randomUUID();
    await writeRecord(args.output, id, syntheticCorpus);
    log({
      corpusId: id,
      corpusHash: corpusHash(syntheticCorpus),
      cases: syntheticCorpus.cases.map((c) => c.id),
    });
  } else if (args.command === 'acquire') {
    const domains = args.domains.split(',');
    if (domains.length !== 6)
      throw new Error('pilot_six_public_companies_required');
    const result = await acquireCompanies(
      domains,
      AbortSignal.timeout(120_000)
    );
    const corpus = validateCorpus({
      version: result.version,
      repetitions: result.repetitions,
      cases: result.cases,
    });
    const corpusId = randomUUID(),
      acquisitionId = randomUUID();
    await writeRecord(args.output, corpusId, corpus);
    await writeRecord(args.output, acquisitionId, {
      corpusId,
      captures: result.captures,
    });
    log({
      corpusId,
      acquisitionId,
      corpusHash: corpusHash(corpus),
      captures: result.captures,
    });
  } else if (args.command === 'run') {
    if (process.env['GROWTH_RESEARCH_PILOT_MODE'] !== 'local-company-only')
      throw new Error('pilot_mode_required');
    if (!process.env['OPENAI_API_KEY'])
      throw new Error('pilot_provider_key_required');
    const corpus = validateCorpus(await inputJson(args.corpus));
    log({
      starting: true,
      approach: args.approach,
      corpusHash: corpusHash(corpus),
      cases: corpus.cases.map((c) => ({ id: c.id, domain: c.domain })),
      repetitions: corpus.repetitions,
    });
    const revision = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: resolve(import.meta.dirname, '../../..'),
      encoding: 'utf8',
    }).trim();
    const abort = new AbortController();
    const cancel = () => abort.abort();
    process.once('SIGINT', cancel);
    try {
      log(
        await runCorpus(corpus, 'agent', {
          root: args.output,
          revision,
          signal: abort.signal,
          progress: log,
        })
      );
    } finally {
      process.removeListener('SIGINT', cancel);
    }
  } else if (args.command === 'inspect') {
    // Privileged explicit inspection includes company findings, never credentials or contacts.
    log(await readRecord(args.output, args.run));
  } else if (args.command === 'review') {
    const records = [];
    for (const id of args.indices.split(',')) {
      const index = z
        .object({ kind: z.literal('corpus_index'), runIds: z.array(z.uuid()) })
        .parse(await readRecord(args.output, id));
      for (const runId of index.runIds)
        records.push(
          (await readRecord(args.output, runId)) as Parameters<
            typeof createReviewPacket
          >[0][number]
        );
    }
    const id = randomUUID();
    await writeRecord(args.output, id, createReviewPacket(records));
    log({ reviewPacketId: id, runs: records.length });
  } else {
    const packet = (await readRecord(args.output, args.packet)) as ReturnType<
      typeof createReviewPacket
    >;
    const labels = await inputJson(args.labels);
    const summary = scoreReview(packet, labels);
    const byApproach: Record<string, ReturnType<typeof scoreReview>> = {};
    for (const approach of ['agent', 'baseline']) {
      const ids = new Set<string>();
      for (const item of packet.items) {
        const run = z
          .object({
            approach: z.enum(['agent', 'baseline']),
            corpusHash: z.string(),
          })
          .parse(await readRecord(args.output, item.reviewId));
        if (run.corpusHash !== packet.corpusHash)
          throw new Error('pilot_review_corpus_mismatch');
        if (run.approach === approach) ids.add(item.reviewId);
      }
      if (ids.size)
        byApproach[approach] = scoreReview(
          {
            ...packet,
            items: packet.items.filter((item) => ids.has(item.reviewId)),
          },
          labels.filter((label: { reviewId: string }) =>
            ids.has(label.reviewId)
          )
        );
    }
    const id = randomUUID();
    await writeRecord(args.output, id, {
      kind: 'human_review',
      packetId: args.packet,
      importedAt: new Date().toISOString(),
      labels,
      summary,
      byApproach,
    });
    log({ reviewArtifactId: id, summary, byApproach });
  }
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main(process.argv.slice(2)).catch(() => {
    console.error('pilot_operation_failed');
    process.exitCode = 1;
  });
}
