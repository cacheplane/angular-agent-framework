import { RUNTIME_BRIDGE_VERSION } from '@threadplane/cockpit-runtime-bridge';
import type { SessionActivityEvent } from './session-activity';
import type { RuntimePhase, RuntimeSnapshot } from './runtime-state';

export interface RuntimeDiagnosticEvent {
  at: string;
  kind: SessionActivityEvent['kind'];
  severity: SessionActivityEvent['severity'];
  capability: string;
  summary: string;
}

export interface RuntimeDiagnostics {
  capability: string;
  runtime: string | null;
  state: RuntimePhase;
  checkedAt: number | null;
  lastReadyAt: number | null;
  protocolVersion: typeof RUNTIME_BRIDGE_VERSION;
  recentEvents: RuntimeDiagnosticEvent[];
}

export type ClipboardWriter = (text: string) => void | PromiseLike<void>;
export type CopyDiagnosticsOutcome = 'succeeded' | 'failed';

const MAX_DIAGNOSTIC_EVENTS = 20;

export function buildRuntimeDiagnostics(
  snapshot: RuntimeSnapshot,
  events: readonly SessionActivityEvent[],
): RuntimeDiagnostics {
  return {
    capability: snapshot.capability,
    runtime:
      snapshot.target.kind === 'configured'
        ? snapshot.target.sanitizedUrl
        : null,
    state: snapshot.phase,
    checkedAt: snapshot.checkedAt,
    lastReadyAt: snapshot.lastReadyAt,
    protocolVersion: RUNTIME_BRIDGE_VERSION,
    recentEvents: events.slice(0, MAX_DIAGNOSTIC_EVENTS).map((event) => ({
      at: event.at,
      kind: event.kind,
      severity: event.severity,
      capability: event.capability,
      summary: event.summary,
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
): Promise<CopyDiagnosticsOutcome> {
  const writer = writeText ?? getDefaultClipboardWriter();
  if (writer === null) {
    return 'failed';
  }

  try {
    const serialized = JSON.stringify(
      buildRuntimeDiagnostics(snapshot, events),
      null,
      2,
    );
    await writer(serialized);
    return 'succeeded';
  } catch {
    return 'failed';
  }
}
