import { RUNTIME_BRIDGE_VERSION } from '@threadplane/cockpit-runtime-bridge';
import type { RuntimeAdapter } from '@threadplane/cockpit-registry';
import type { SanitizedRuntimeTargetDisplay } from './runtime-target-session';
import {
  projectRuntimeActivityContext,
  type RuntimeActivityContext,
  type RuntimeActivityReasonCode,
  type SessionActivityEvent,
} from './session-activity';
import type { RuntimePhase, RuntimeSnapshot } from './runtime-state';

export interface RuntimeDiagnosticEvent {
  at: string;
  kind: SessionActivityEvent['kind'];
  severity: SessionActivityEvent['severity'];
  capability: string;
  summary: string;
  runtime?: RuntimeActivityContext;
}

export interface RuntimeDiagnostics {
  capability: string;
  adapter: RuntimeAdapter;
  targetKind: SanitizedRuntimeTargetDisplay['kind'];
  state: RuntimePhase;
  checkedAt: number | null;
  lastReadyAt: number | null;
  protocolVersion: number;
  configurationGeneration: number;
  reasonCode: RuntimeActivityReasonCode | null;
  recentEvents: RuntimeDiagnosticEvent[];
}

export interface RuntimeDiagnosticsTargetContext {
  adapter: RuntimeAdapter;
  targetKind: SanitizedRuntimeTargetDisplay['kind'];
  protocolVersion?: number;
  configurationGeneration: number;
  phase?: RuntimePhase;
  reasonCode: RuntimeActivityReasonCode | null;
}

export type ClipboardWriter = (text: string) => void | PromiseLike<void>;
export type CopyDiagnosticsOutcome = 'succeeded' | 'failed';

const MAX_DIAGNOSTIC_EVENTS = 20;

export function buildRuntimeDiagnostics(
  snapshot: RuntimeSnapshot,
  events: readonly SessionActivityEvent[],
  targetContext?: RuntimeDiagnosticsTargetContext
): RuntimeDiagnostics {
  const projectedInput = targetContext
    ? projectRuntimeActivityContext(targetContext)
    : null;
  const projectedTargetContext = projectedInput
    ? {
        ...projectedInput,
        protocolVersion:
          projectedInput.protocolVersion || RUNTIME_BRIDGE_VERSION,
        phase:
          projectedInput.phase === 'not_configured'
            ? snapshot.phase
            : projectedInput.phase,
      }
    : null;
  const reasonCode = projectedTargetContext
    ? projectedTargetContext.reasonCode
    : snapshot.phase === 'invalid_configuration'
    ? 'invalid_runtime_url'
    : snapshot.errorCode;
  return {
    capability: snapshot.capability,
    adapter: projectedTargetContext?.adapter ?? 'none',
    targetKind: projectedTargetContext?.targetKind ?? 'none',
    state: snapshot.phase,
    checkedAt: snapshot.checkedAt,
    lastReadyAt: snapshot.lastReadyAt,
    protocolVersion:
      projectedTargetContext?.protocolVersion ?? RUNTIME_BRIDGE_VERSION,
    configurationGeneration:
      projectedTargetContext?.configurationGeneration ?? 0,
    reasonCode,
    recentEvents: events.slice(0, MAX_DIAGNOSTIC_EVENTS).map((event) => ({
      at: event.at,
      kind: event.kind,
      severity: event.severity,
      capability: event.capability,
      summary: event.summary,
      ...(event.runtime
        ? { runtime: projectRuntimeActivityContext(event.runtime) }
        : {}),
    })),
  };
}

function getDefaultClipboardWriter(): ClipboardWriter | null {
  try {
    if (
      typeof navigator === 'undefined' ||
      typeof navigator.clipboard?.writeText !== 'function'
    ) {
      return null;
    }
    return (text) => navigator.clipboard.writeText(text);
  } catch {
    return null;
  }
}

export async function copyRuntimeDiagnostics(
  snapshot: RuntimeSnapshot,
  events: readonly SessionActivityEvent[],
  writeText?: ClipboardWriter,
  targetContext?: RuntimeDiagnosticsTargetContext
): Promise<CopyDiagnosticsOutcome> {
  const writer = writeText ?? getDefaultClipboardWriter();
  if (writer === null) {
    return 'failed';
  }

  try {
    const serialized = JSON.stringify(
      buildRuntimeDiagnostics(snapshot, events, targetContext),
      null,
      2
    );
    await writer(serialized);
    return 'succeeded';
  } catch {
    return 'failed';
  }
}
