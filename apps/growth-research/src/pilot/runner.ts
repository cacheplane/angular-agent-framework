import { randomUUID } from 'node:crypto';
import { validateCorpus, corpusHash } from './corpus.js';
import { runBaseline, BaselineFailure } from './baseline.js';
import { writeRecord, createReviewPacket } from './reports.js';
import type { PilotCase } from './contracts.js';

type Options = {
  root: string;
  revision: string;
  signal?: AbortSignal;
  baseline?: typeof runBaseline;
  progress?: (record: {
    runId: string;
    caseId: string;
    outcome: string;
  }) => void;
};
export async function runCorpus(
  input: unknown,
  approach: 'agent' | 'baseline',
  options: Options
) {
  const corpus = validateCorpus(input);
  const hash = corpusHash(corpus);
  const records = [];
  const runIds: string[] = [];
  for (const company of corpus.cases)
    for (let repetition = 1; repetition <= corpus.repetitions; repetition++) {
      const runId = randomUUID(),
        startedAt = new Date().toISOString(),
        start = performance.now();
      const signal =
        approach === 'agent'
          ? options.signal ?? new AbortController().signal
          : AbortSignal.any([
              AbortSignal.timeout(90_000),
              ...(options.signal ? [options.signal] : []),
            ]);
      const record = {
        schemaVersion: 1,
        runId,
        caseId: company.id,
        corpusKind: company.kind,
        corpusVersion: corpus.version,
        corpusHash: hash,
        approach,
        repetition,
        revision: options.revision,
        promptVersion: 'company-pilot-v1',
        skillVersion: 'company-evidence-v1',
        startedAt,
        finishedAt: '',
        elapsedMs: 0,
        outcome: 'failed',
        errorCode: null as string | null,
        model:
          approach === 'agent'
            ? 'gpt-4.1-mini'
            : process.env['LIFECYCLE_ENRICHMENT_MODEL'] || 'claude-sonnet-4-6',
        modelCalls: null as number | null,
        evidenceReads: null as number | null,
        usage: {
          inputTokens: null as number | null,
          outputTokens: null as number | null,
        },
        estimatedCost: null,
        tracing: 'unavailable',
        profile: { name: null, description: null, industry: null } as Record<
          string,
          string | null
        >,
        claims: [] as {
          text: string;
          sourceIds: string[];
          quoteStatus?: string;
        }[],
        sources: company.pages.map((page, index) => ({
          id: `source-${index + 1}`,
          ...page,
        })),
        expected: company.expected,
        validation: { status: 'unavailable', reasonCodes: [] as string[] },
        invalidCitationCount: null as number | null,
      };
      try {
        signal.throwIfAborted();
        if (approach === 'baseline') {
          const result = await (options.baseline ?? runBaseline)(
            company,
            signal
          );
          signal.throwIfAborted();
          Object.assign(record, result, {
            outcome: 'completed',
            evidenceReads: 0,
            validation: {
              status: 'legacy_normalized',
              reasonCodes: result.invalidCitationCount
                ? ['raw_invalid_citation']
                : [],
            },
          });
        } else {
          const { runAgent } = await import('./agent-runner.js');
          const result = await runAgent(company, { signal });
          record.outcome = result.outcome;
          record.modelCalls = result.modelCalls;
          record.evidenceReads = result.evidenceReads;
          record.usage = result.usage;
          record.validation = result.validation;
          Object.assign(record, { attempts: result.attempts ?? [] });
          record.invalidCitationCount = (result.attempts ?? []).reduce(
            (sum, attempt) =>
              sum +
              (attempt.candidate?.claims
                .flatMap((claim) => claim.citations)
                .filter(
                  (citation) =>
                    !record.sources.some(
                      (source) => source.id === citation.sourceId
                    )
                ).length ?? 0),
            0
          );
          if (result.candidate && !signal.aborted) {
            record.profile = result.candidate.profile;
            record.claims = result.candidate.claims.map((claim) => ({
              text: claim.text,
              sourceIds: claim.citations.map((citation) => citation.sourceId),
            }));
            Object.assign(record, { candidate: result.candidate });
          }
          signal.throwIfAborted();
        }
      } catch (error) {
        record.outcome = signal.aborted
          ? signal.reason instanceof DOMException &&
            signal.reason.name === 'TimeoutError'
            ? 'deadline'
            : 'cancelled'
          : 'failed';
        record.errorCode = signal.aborted
          ? record.outcome
          : error instanceof BaselineFailure
          ? error.message
          : 'research_failed';
        if (error instanceof BaselineFailure) {
          record.modelCalls = error.modelCalls;
          record.usage = error.usage;
          record.invalidCitationCount = error.invalidCitationCount;
          Object.assign(record, { rejectedClaims: error.claims });
        }
        record.profile = { name: null, description: null, industry: null };
        record.claims = [];
        Reflect.deleteProperty(record, 'candidate');
      }
      record.finishedAt = new Date().toISOString();
      record.elapsedMs = Math.round(performance.now() - start);
      await writeRecord(options.root, runId, record);
      runIds.push(runId);
      records.push(record);
      options.progress?.({
        runId,
        caseId: company.id,
        outcome: record.outcome,
      });
    }
  const indexId = randomUUID(),
    reviewId = randomUUID();
  const packet = createReviewPacket(records);
  await writeRecord(options.root, reviewId, packet);
  const index = {
    schemaVersion: 1,
    kind: 'corpus_index',
    corpusHash: hash,
    approach,
    runIds,
    reviewId,
    outcomes: records.map((record) => ({
      runId: record.runId,
      caseId: record.caseId,
      outcome: record.outcome,
    })),
  };
  await writeRecord(options.root, indexId, index);
  return { indexId, ...index };
}

export function acquisitionCorpus(cases: PilotCase[]) {
  return validateCorpus({
    version: 'company-public-v1',
    repetitions: 2,
    cases,
  });
}
