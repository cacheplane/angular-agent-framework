import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import type {
  Candidate,
  PilotCase,
  Validation,
  SubmissionAttempt,
} from './contracts.js';
import {
  createPilotContext,
  withPilotContext,
  PilotStop,
  pilotLimits,
} from './context.js';
import { validateCandidate } from './validation.js';

export interface AgentResult {
  attempts?: SubmissionAttempt[];
  candidate?: Candidate;
  validation: Validation;
  outcome:
    | 'completed'
    | 'rejected'
    | 'cancelled'
    | 'deadline'
    | 'model_limit'
    | 'evidence_limit'
    | 'submission_limit'
    | 'failed';
  modelCalls: number;
  evidenceReads: number;
  usage: { inputTokens: number | null; outputTokens: number | null };
  model: string;
  tracing: 'unavailable';
}
type Invocation = (
  input: { messages: { role: string; content: string }[] },
  config: {
    signal: AbortSignal;
    configurable: { thread_id: string };
    callbacks: never[];
  }
) => Promise<unknown>;
let running = false;
async function generatedInvoke(...args: Parameters<Invocation>) {
  const module = await import(
    pathToFileURL(
      resolve(
        import.meta.dirname,
        '../../.dawn/build/enrichment-company-pilot.ts'
      )
    ).href
  );
  return module.graph.invoke(...args);
}
/** Local operator entrypoint. Injectable invocation is for unpaid cancellation tests. */
export async function runAgent(
  c: PilotCase,
  options: { signal?: AbortSignal; invoke?: Invocation } = {}
): Promise<AgentResult> {
  if (running) throw new Error('Only one active pilot run is allowed');
  if (process.env['GROWTH_RESEARCH_PILOT_MODE'] !== 'local-company-only')
    throw new Error('pilot_mode_required');
  running = true;
  const context = createPilotContext(c);
  const cancel = () => context.controller.abort(new PilotStop('cancelled'));
  options.signal?.addEventListener('abort', cancel, { once: true });
  if (options.signal?.aborted) cancel();
  const timer = setTimeout(
    () => context.controller.abort(new PilotStop('deadline')),
    pilotLimits.deadlineMs
  );
  const tracingKeys = [
    'LANGSMITH_TRACING',
    'LANGCHAIN_TRACING_V2',
    'LANGCHAIN_TRACING',
  ] as const;
  const prior = tracingKeys.map((key) => process.env[key]);
  for (const key of tracingKeys) process.env[key] = 'false';
  let outcome: AgentResult['outcome'] = 'failed';
  try {
    await withPilotContext(context, async () => {
      context.controller.signal.throwIfAborted();
      await (options.invoke ?? generatedInvoke)(
        {
          messages: [
            {
              role: 'user',
              content: `Research company case ${c.id}. Read the company-review skill and captured evidence, then submit a candidate.`,
            },
          ],
        },
        {
          signal: context.controller.signal,
          configurable: { thread_id: randomUUID() },
          callbacks: [],
        }
      );
      context.controller.signal.throwIfAborted();
    });
    outcome = context.candidate ? 'completed' : 'rejected';
  } catch {
    const reason = context.controller.signal.reason;
    outcome =
      reason &&
      [
        'cancelled',
        'deadline',
        'model_limit',
        'evidence_limit',
        'submission_limit',
      ].includes(reason.code)
        ? (reason.code as AgentResult['outcome'])
        : 'failed';
  } finally {
    context.closed = true;
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', cancel);
    tracingKeys.forEach((key, i) => {
      if (prior[i] === undefined) delete process.env[key];
      else process.env[key] = prior[i];
    });
    running = false;
  }
  const candidate = outcome === 'completed' ? context.candidate : undefined;
  return {
    attempts: context.attempts,
    ...(candidate ? { candidate } : {}),
    validation: candidate
      ? validateCandidate(candidate, c)
      : context.validation?.status === 'rejected'
      ? context.validation
      : { status: 'rejected', reasonCodes: ['no_candidate'] },
    outcome,
    modelCalls: context.modelCalls,
    evidenceReads: context.evidenceReads,
    usage: {
      inputTokens: context.inputTokens,
      outputTokens: context.outputTokens,
    },
    model: 'gpt-4.1-mini',
    tracing: 'unavailable',
  };
}
