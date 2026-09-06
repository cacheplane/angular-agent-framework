import { AsyncLocalStorage } from 'node:async_hooks';
import {
  CandidateSchema,
  type Candidate,
  type PilotCase,
  type Validation,
  type SubmissionAttempt,
} from './contracts.js';
import { validateCandidate } from './validation.js';
export const pilotLimits = {
  modelRequests: 6,
  evidenceReads: 6,
  submissionAttempts: 12,
  deadlineMs: 90_000,
} as const;
export class PilotStop extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}
/** Constructed from counters and deterministic validation only; never raw inputs. */
export interface PilotEvent {
  kind: 'model' | 'evidence' | 'submission';
  callIndex: number;
  startedAt: number;
  endedAt: number;
  outcome: 'succeeded' | 'rejected' | 'failed';
  inputTokens?: number;
  outputTokens?: number;
  reasonCodes?: string[];
}
export interface PilotContext {
  authorization?: 'production';
  case: PilotCase;
  controller: AbortController;
  deadline: number;
  modelCalls: number;
  evidenceReads: number;
  candidate?: Candidate;
  validation?: Validation;
  attempts: SubmissionAttempt[];
  closed: boolean;
  inputTokens: number | null;
  outputTokens: number | null;
  pendingOperations: Set<Promise<unknown>>;
  events: PilotEvent[];
}
// Dawn's TS loader and the operator loader may materialize this module separately.
// Share the server-owned ALS instance, never case selection through environment data.
const key = Symbol.for('growth-research.local-pilot-context');
const globals = globalThis as typeof globalThis & {
  [key: symbol]: AsyncLocalStorage<PilotContext>;
};
const storage =
  globals[key] ?? (globals[key] = new AsyncLocalStorage<PilotContext>());
export const getPilotContext = () => storage.getStore();
export const createPilotContext = (
  c: PilotCase,
  options: { authorization?: 'production'; deadline?: number } = {}
): PilotContext => ({
  ...(options.authorization ? { authorization: options.authorization } : {}),
  case: structuredClone(c),
  controller: new AbortController(),
  deadline: Math.min(
    options.deadline ?? Infinity,
    Date.now() + pilotLimits.deadlineMs
  ),
  modelCalls: 0,
  evidenceReads: 0,
  attempts: [],
  closed: false,
  inputTokens: null,
  outputTokens: null,
  pendingOperations: new Set(),
  events: [],
});
export const withPilotContext = <T>(context: PilotContext, fn: () => T): T =>
  storage.run(context, fn);
export async function trackPilotOperation<T>(
  context: PilotContext,
  operation: () => Promise<T>
): Promise<T> {
  assertPilotContext();
  const pending = operation();
  context.pendingOperations.add(pending);
  try {
    return await pending;
  } finally {
    context.pendingOperations.delete(pending);
  }
}
export async function drainPilotOperations(
  context: PilotContext
): Promise<void> {
  await Promise.allSettled([...context.pendingOperations]);
}
export function assertPilotContext(): PilotContext {
  const c = storage.getStore();
  if (
    !c ||
    (c.authorization === 'production'
      ? process.env['GROWTH_RESEARCH_PRODUCTION_MODE'] !==
        'managed-company-only'
      : process.env['GROWTH_RESEARCH_PILOT_MODE'] !== 'local-company-only')
  )
    throw new PilotStop('pilot_mode_required');
  if (c.closed) throw new PilotStop('run_closed');
  c.controller.signal.throwIfAborted();
  if (Date.now() >= c.deadline) {
    c.controller.abort(new PilotStop('deadline'));
    throw new PilotStop('deadline');
  }
  return c;
}
export function countModelRequest() {
  const c = assertPilotContext();
  if (c.modelCalls >= pilotLimits.modelRequests) {
    c.controller.abort(new PilotStop('model_limit'));
    throw new PilotStop('model_limit');
  }
  c.modelCalls++;
}
export function readEvidence(input: { sourceId?: string }) {
  const c = assertPilotContext();
  if (c.evidenceReads >= pilotLimits.evidenceReads) {
    c.controller.abort(new PilotStop('evidence_limit'));
    throw new PilotStop('evidence_limit');
  }
  c.evidenceReads++;
  const event: PilotEvent = {
    kind: 'evidence',
    callIndex: c.evidenceReads,
    startedAt: Date.now(),
    endedAt: 0,
    outcome: 'failed',
  };
  try {
    if (!input.sourceId) {
      const sources = c.case.pages.map((p, i) => ({
        sourceId: `source-${i + 1}`,
        canonicalUrl: p.canonicalUrl,
        retrievedAt: p.retrievedAt,
      }));
      event.outcome = 'succeeded';
      return sources;
    }
    const page = c.case.pages.find(
      (_, i) => input.sourceId === `source-${i + 1}`
    );
    if (!page) throw new PilotStop('invalid_source');
    const result = {
      ...structuredClone(page),
      citationOptions: [...page.facts, ...page.snippets]
        .filter((quote) => quote.length > 0)
        .map((quote) => ({
          sourceId: input.sourceId,
          quote: quote.slice(0, 240),
        })),
    };
    event.outcome = 'succeeded';
    return result;
  } finally {
    event.endedAt = Date.now();
    c.events.push(event);
  }
}
export function submitCandidate(value: unknown) {
  const c = assertPilotContext();
  if (c.attempts.length >= pilotLimits.submissionAttempts) {
    c.controller.abort(new PilotStop('submission_limit'));
    throw new PilotStop('submission_limit');
  }
  const event: PilotEvent = {
    kind: 'submission',
    callIndex: c.attempts.length + 1,
    startedAt: Date.now(),
    endedAt: 0,
    outcome: 'failed',
  };
  try {
    const validation = validateCandidate(value, c.case);
    event.reasonCodes = [...validation.reasonCodes];
    const parsed = CandidateSchema.safeParse(value);
    c.attempts.push({
      validation,
      ...(parsed.success && !validation.reasonCodes.includes('identity_content')
        ? { candidate: parsed.data }
        : {}),
    });
    delete c.candidate;
    c.validation = validation;
    if (validation.status === 'structurally_valid') {
      assertPilotContext();
      c.candidate = CandidateSchema.parse(value);
      // Dawn serializes authored tool return values; its supported invocation
      // AbortSignal stops the loop without spending another provider request.
      c.controller.abort(new PilotStop('submitted'));
    }
    event.outcome =
      validation.status === 'structurally_valid' ? 'succeeded' : 'rejected';
    return validation;
  } finally {
    event.endedAt = Date.now();
    c.events.push(event);
  }
}

/** Preserve schema failures rejected by the tool runtime before its function runs. */
export function recordRejectedSubmission(value: unknown) {
  if (CandidateSchema.safeParse(value).success) return;
  submitCandidate(value);
}
