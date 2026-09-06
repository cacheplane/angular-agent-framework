import { AsyncLocalStorageProviderSingleton } from '@langchain/core/singletons';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  createPilotContext,
  drainPilotOperations,
  PilotStop,
  withPilotContext,
} from '../pilot/context.js';
import { validateCandidate } from '../pilot/validation.js';
import type { ClaimStore } from './claims.js';
import {
  CompanyResultSchema,
  parseCompanyRequest,
  type CompanyResult,
} from './contracts.js';
import { emitTelemetry, type TelemetrySink } from './telemetry.js';

type Invocation = (
  input: { messages: { role: string; content: string }[] },
  config: {
    signal: AbortSignal;
    configurable: { thread_id: string };
    callbacks: never[];
  }
) => Promise<unknown>;
async function invokeGenerated(
  ...args: Parameters<Invocation>
): Promise<unknown> {
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
export function createCompanyExecutor(options: {
  claims: ClaimStore;
  invoke?: Invocation;
  telemetry?: TelemetrySink;
}) {
  return async (
    input: unknown,
    signal?: AbortSignal
  ): Promise<CompanyResult> => {
    if (
      process.env['GROWTH_RESEARCH_PRODUCTION_MODE'] !== 'managed-company-only'
    )
      throw new Error('production_mode_required');
    // Queued work can expire before it starts. Validate all evidence first,
    // then leave a durable non-execution record for terminal-thread cleanup.
    const request = parseCompanyRequest(input, Date.now(), {
      allowExpired: true,
    });
    if (Date.parse(request.expiresAt) <= Date.now()) {
      await options.claims.rejectExpired(request.attemptId, request.expiresAt);
      throw new Error('invalid_expiry');
    }
    signal?.throwIfAborted();
    if (!(await options.claims.acquire(request.attemptId, request.expiresAt))) {
      // Database time may cross the deadline after the process-time check.
      // This insert is conditional on expiry and cannot change an existing row.
      await options.claims.rejectExpired(request.attemptId, request.expiresAt);
      throw new Error('attempt_already_claimed');
    }
    const started = Date.now();
    const context = createPilotContext(
      {
        id: request.attemptId,
        kind: 'public',
        domain: request.domain,
        pages: request.pages,
        expected: { claims: [], unknowns: [], contradiction: false },
      },
      { authorization: 'production', deadline: Date.parse(request.expiresAt) }
    );
    const cancel = () => context.controller.abort(new PilotStop('cancelled'));
    signal?.addEventListener('abort', cancel, { once: true });
    if (signal?.aborted) cancel();
    const timer = setTimeout(
      () => context.controller.abort(new PilotStop('deadline')),
      Math.max(1, context.deadline - Date.now())
    );
    let outcome: CompanyResult['outcome'] = 'failed';
    try {
      context.controller.signal.throwIfAborted();
      if (
        !request.pages.some((page) => page.facts.length || page.snippets.length)
      )
        outcome = 'skipped';
      else {
        // Clear the live parent before configuring callbacks: runWithConfig
        // otherwise reuses an active parent's tracing-enabled RunTree instead
        // of constructing its own non-tracing root. Clear context variables too.
        await AsyncLocalStorageProviderSingleton.getInstance().run(
          undefined,
          () =>
            AsyncLocalStorageProviderSingleton.runWithConfig(
              { callbacks: [], configurable: {} },
              () =>
                withPilotContext(context, () =>
                  (options.invoke ?? invokeGenerated)(
                    {
                      messages: [
                        {
                          role: 'user',
                          content:
                            'Read the company-review skill and captured evidence, then submit a supported company candidate.',
                        },
                      ],
                    },
                    {
                      signal: context.controller.signal,
                      configurable: { thread_id: request.attemptId },
                      callbacks: [],
                    }
                  )
                )
            )
        );
        outcome = context.candidate ? 'completed' : 'rejected';
      }
    } catch {
      const code = context.controller.signal.reason?.code;
      outcome =
        code === 'submitted' && context.candidate
          ? 'completed'
          : [
              'cancelled',
              'deadline',
              'model_limit',
              'evidence_limit',
              'submission_limit',
            ].includes(code)
          ? code
          : 'failed';
    } finally {
      context.closed = true;
      if (!context.controller.signal.aborted)
        context.controller.abort(new PilotStop('run_closed'));
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
      // invoke can reject on abort before its fetch settles. The transport owns
      // these promises; never equate a terminal graph status with quiescence.
      await drainPilotOperations(context);
    }
    if (signal?.aborted) outcome = 'cancelled';
    else if (Date.now() >= context.deadline) outcome = 'deadline';
    const candidate = outcome === 'completed' ? context.candidate : undefined;
    const validation = candidate
      ? validateCandidate(candidate, context.case)
      : {
          status: 'rejected' as const,
          reasonCodes: [
            outcome === 'skipped' ? 'empty_evidence' : 'no_candidate',
          ],
        };
    if (candidate && validation.status !== 'structurally_valid')
      outcome = 'rejected';
    const result = CompanyResultSchema.parse({
      version: 'company_research.result.v1',
      attemptId: request.attemptId,
      evidenceHash: request.evidenceHash,
      generationRef: request.generationRef,
      outcome,
      ...(outcome === 'completed' ? { candidate } : {}),
      validation,
      modelCalls: context.modelCalls,
      evidenceReads: context.evidenceReads,
      usage: {
        inputTokens: context.inputTokens,
        outputTokens: context.outputTokens,
      },
      model: 'gpt-4.1-mini',
      settledAt: null,
    });
    await emitTelemetry(
      options.telemetry,
      {
        attemptId: request.attemptId,
        phase: 'settled',
        outcome,
        elapsedMs: Date.now() - started,
        startedAt: started,
        endedAt: Date.now(),
        modelCalls: result.modelCalls,
        evidenceReads: result.evidenceReads,
        ...result.usage,
      },
      context.events
    );
    // No exporter may remain active when cleanup sees this fence settled.
    await options.claims.settle(request.attemptId);
    result.settledAt =
      (await options.claims.get(request.attemptId))?.settledAt ?? null;
    if (signal?.aborted || Date.now() >= context.deadline) {
      result.outcome = signal?.aborted ? 'cancelled' : 'deadline';
      delete result.candidate;
      result.validation = { status: 'rejected', reasonCodes: ['late_result'] };
    }
    return result;
  };
}
