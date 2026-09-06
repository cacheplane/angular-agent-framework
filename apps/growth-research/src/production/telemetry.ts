import type { PilotEvent } from '../pilot/context.js';
/** Deliberately no prompt, page, candidate, identity, error object or credentials. */
export interface CompanyTelemetry {
  attemptId: string;
  phase: 'settled';
  outcome: string;
  elapsedMs: number;
  startedAt?: number;
  endedAt?: number;
  modelCalls: number;
  evidenceReads: number;
  inputTokens: number | null;
  outputTokens: number | null;
}
export type TelemetrySink = (
  event: CompanyTelemetry,
  events?: readonly PilotEvent[]
) => Promise<void>;
export async function emitTelemetry(
  sink: TelemetrySink | undefined,
  event: CompanyTelemetry,
  events: readonly PilotEvent[] = []
): Promise<void> {
  try {
    await sink?.(event, events);
  } catch {
    /* Observability must not alter execution. */
  }
}
