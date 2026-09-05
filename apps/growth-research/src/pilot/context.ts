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
export interface PilotContext {
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
export const createPilotContext = (c: PilotCase): PilotContext => ({
  case: structuredClone(c),
  controller: new AbortController(),
  deadline: Date.now() + pilotLimits.deadlineMs,
  modelCalls: 0,
  evidenceReads: 0,
  attempts: [],
  closed: false,
  inputTokens: null,
  outputTokens: null,
});
export const withPilotContext = <T>(context: PilotContext, fn: () => T): T =>
  storage.run(context, fn);
export function assertPilotContext(): PilotContext {
  const c = storage.getStore();
  if (process.env['GROWTH_RESEARCH_PILOT_MODE'] !== 'local-company-only' || !c)
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
  if (!input.sourceId)
    return c.case.pages.map((p, i) => ({
      sourceId: `source-${i + 1}`,
      canonicalUrl: p.canonicalUrl,
      retrievedAt: p.retrievedAt,
    }));
  const page = c.case.pages.find(
    (_, i) => input.sourceId === `source-${i + 1}`
  );
  if (!page) throw new PilotStop('invalid_source');
  return structuredClone(page);
}
export function submitCandidate(value: unknown) {
  const c = assertPilotContext();
  if (c.attempts.length >= pilotLimits.submissionAttempts) {
    c.controller.abort(new PilotStop('submission_limit'));
    throw new PilotStop('submission_limit');
  }
  const validation = validateCandidate(value, c.case);
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
  }
  return validation;
}

/** Preserve schema failures rejected by the tool runtime before its function runs. */
export function recordRejectedSubmission(value: unknown) {
  if (CandidateSchema.safeParse(value).success) return;
  const c = assertPilotContext();
  if (c.attempts.length >= pilotLimits.submissionAttempts) {
    c.controller.abort(new PilotStop('submission_limit'));
    throw new PilotStop('submission_limit');
  }
  delete c.candidate;
  c.validation = { status: 'rejected', reasonCodes: ['schema'] };
  c.attempts.push({ validation: c.validation });
}
