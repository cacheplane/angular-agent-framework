import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { PilotEvent } from '../pilot/context.js';
import type { TelemetrySink } from './telemetry.js';

const EventSchema = z.object({
  kind: z.enum(['model', 'evidence', 'submission']),
  callIndex: z.number().int().positive(),
  startedAt: z.number().nonnegative(),
  endedAt: z.number().nonnegative(),
  outcome: z.enum(['succeeded', 'rejected', 'failed']),
  inputTokens: z.number().nonnegative().optional(),
  outputTokens: z.number().nonnegative().optional(),
});
const iso = (time: number) => new Date(time).toISOString();
// LangSmith requires dotted_order whenever trace_id is supplied. Preserve the
// measured millisecond timestamp, padding the remaining microseconds with zero.
const dottedOrder = (time: number, id: string) =>
  `${iso(time).slice(0, -1).replace(/[-:.]/g, '')}000Z${id}`;
export type TraceDiagnostic = {
  code:
    | 'missing_configuration'
    | 'invalid_configuration'
    | 'exported'
    | 'transport_failed'
    | 'http_rejected';
  status?: number;
};
class TraceTransportError extends Error {
  constructor(
    readonly code: 'transport_failed' | 'http_rejected',
    readonly status?: number
  ) {
    super(code);
  }
}
function reportDiagnostic(
  observer: ((value: TraceDiagnostic) => void) | undefined,
  diagnostic: TraceDiagnostic
): void {
  try {
    observer?.(diagnostic);
  } catch {
    /* Diagnostics never affect research. */
  }
}
/** Manual REST ingestion avoids SDK environment metadata and background retries.
 * See docs.langchain.com/langsmith/trace-with-api; /runs accepts complete spans.
 */
export function createTraceTransport(options: {
  apiKey: string;
  projectId: string;
  endpoint?: string;
  workspaceId?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
  onDiagnostic?: (value: TraceDiagnostic) => void;
}) {
  const base = new URL(options.endpoint ?? 'https://api.smith.langchain.com');
  if (
    base.protocol !== 'https:' ||
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    base.pathname !== '/'
  )
    throw new Error('invalid_trace_endpoint');
  const projectId = z.uuid().parse(options.projectId);
  const timeout = options.timeoutMs ?? 3000;
  if (!Number.isFinite(timeout) || timeout <= 0 || timeout > 5000)
    throw new Error('invalid_trace_timeout');
  async function request(
    path: string,
    body: unknown,
    signal: AbortSignal,
    parseJson = false
  ): Promise<unknown> {
    try {
      const response = await (options.fetch ?? fetch)(new URL(path, base), {
        method: 'POST',
        redirect: 'error',
        signal,
        headers: {
          'content-type': 'application/json',
          'x-api-key': options.apiKey,
          ...(options.workspaceId
            ? { 'x-tenant-id': options.workspaceId }
            : {}),
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        await response.body?.cancel();
        throw new TraceTransportError('http_rejected', response.status);
      }
      const text = await response.text();
      return parseJson && text ? JSON.parse(text) : null;
    } catch (error) {
      if (error instanceof TraceTransportError) throw error;
      throw new TraceTransportError('transport_failed');
    }
  }
  const emit: TelemetrySink = async (summary, events = []) => {
    try {
      const attemptId = z.uuid().parse(summary.attemptId);
      const end = summary.endedAt ?? Date.now();
      const start = summary.startedAt ?? end - summary.elapsedMs;
      const rootOrder = dottedOrder(start, attemptId);
      const signal = AbortSignal.timeout(timeout);
      await request(
        '/runs',
        {
          id: attemptId,
          trace_id: attemptId,
          dotted_order: rootOrder,
          session_id: projectId,
          name: 'company_research',
          run_type: 'chain',
          start_time: iso(start),
          end_time: iso(end),
          inputs: {},
          outputs: {
            outcome: summary.outcome,
            modelCalls: summary.modelCalls,
            evidenceReads: summary.evidenceReads,
            inputTokens: summary.inputTokens,
            outputTokens: summary.outputTokens,
            cost: null,
          },
        },
        signal
      );
      const exported = await Promise.allSettled(
        events.slice(0, 24).map(async (raw: PilotEvent) => {
          const event = EventSchema.parse(raw);
          const childId = randomUUID();
          await request(
            '/runs',
            {
              id: childId,
              trace_id: attemptId,
              dotted_order: `${rootOrder}.${dottedOrder(event.startedAt, childId)}`,
              parent_run_id: attemptId,
              session_id: projectId,
              name: `company_${event.kind}`,
              run_type: event.kind === 'model' ? 'llm' : 'tool',
              start_time: iso(event.startedAt),
              end_time: iso(event.endedAt),
              inputs: {},
              outputs: {
                callIndex: event.callIndex,
                outcome: event.outcome,
                ...(event.inputTokens === undefined
                  ? {}
                  : { inputTokens: event.inputTokens }),
                ...(event.outputTokens === undefined
                  ? {}
                  : { outputTokens: event.outputTokens }),
              },
            },
            signal
          );
        })
      );
      const failed = exported.find((result) => result.status === 'rejected');
      if (failed?.status === 'rejected') throw failed.reason;
      reportDiagnostic(options.onDiagnostic, { code: 'exported' });
    } catch (error) {
      reportDiagnostic(
        options.onDiagnostic,
        error instanceof TraceTransportError
          ? {
              code: error.code,
              ...(error.status === undefined ? {} : { status: error.status }),
            }
          : { code: 'invalid_configuration' }
      );
      /* Missing tracing, timeout or rejected export does not fail research. */
    }
  };
  return {
    emit,
    async requestDeletion(attemptId: string) {
      await request(
        '/api/v1/runs/delete',
        { trace_ids: [z.uuid().parse(attemptId)], session_id: projectId },
        AbortSignal.timeout(timeout)
      );
    },
    async isAbsent(attemptId: string): Promise<boolean> {
      const value = await request(
        '/runs/query',
        {
          trace: z.uuid().parse(attemptId),
          session: [projectId],
          limit: 1,
          select: ['id'],
        },
        AbortSignal.timeout(timeout),
        true
      );
      const result = z
        .object({ runs: z.array(z.object({ id: z.string() })) })
        .parse(value);
      return result.runs.length === 0;
    },
  };
}
/** Lazy configuration keeps import/schema extraction independent of secrets. */
export const configuredTraceSink: TelemetrySink = async (...args) => {
  const diagnostic = (value: TraceDiagnostic) =>
    console.info('company_trace', value);
  const apiKey =
    process.env['GROWTH_RESEARCH_TRACE_API_KEY'] ??
    process.env['LANGSMITH_API_KEY'] ??
    process.env['LANGCHAIN_API_KEY'];
  const projectId = process.env['GROWTH_RESEARCH_TRACE_PROJECT_ID'];
  if (!apiKey || !projectId) {
    reportDiagnostic(diagnostic, { code: 'missing_configuration' });
    return;
  }
  try {
    await createTraceTransport({
      apiKey,
      projectId,
      endpoint: process.env['LANGSMITH_ENDPOINT'],
      workspaceId:
        process.env['GROWTH_RESEARCH_TRACE_WORKSPACE_ID'] ??
        process.env['LANGSMITH_WORKSPACE_ID'],
      onDiagnostic: diagnostic,
    }).emit(...args);
  } catch {
    reportDiagnostic(diagnostic, { code: 'invalid_configuration' });
    /* optional telemetry */
  }
};
