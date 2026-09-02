import type { RuntimeAdapter } from '@threadplane/cockpit-registry';
import type { SanitizedRuntimeTargetDisplay } from './runtime-target-session';
import type { RuntimePhase } from './runtime-state';

export type ActivitySeverity = 'neutral' | 'success' | 'error';
export type ActivityMode = 'Run' | 'Code' | 'Docs' | 'API';

export type RuntimeActivityReasonCode =
  | 'bootstrap_failed'
  | 'invalid_runtime_url'
  | 'unauthorized'
  | 'network_blocked'
  | 'incompatible_bridge';

export interface RuntimeActivityContext {
  adapter: RuntimeAdapter;
  targetKind: SanitizedRuntimeTargetDisplay['kind'];
  protocolVersion: number;
  configurationGeneration: number;
  phase: RuntimePhase;
  reasonCode: RuntimeActivityReasonCode | null;
}

const RUNTIME_ADAPTERS = ['ag-ui', 'langgraph', 'none'] as const;
const RUNTIME_TARGET_KINDS = ['shared', 'ag-ui', 'langsmith', 'none'] as const;
const RUNTIME_PHASES = [
  'not_configured',
  'invalid_configuration',
  'configuring',
  'connecting',
  'checking',
  'ready',
  'unresponsive',
  'reloading',
  'error',
  'unauthorized',
  'network_blocked',
  'incompatible_bridge',
] as const;
const RUNTIME_REASON_CODES = [
  'bootstrap_failed',
  'invalid_runtime_url',
  'unauthorized',
  'network_blocked',
  'incompatible_bridge',
] as const;

const knownString = <T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T
): T =>
  typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;

const safeNonnegativeInteger = (value: unknown): number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : 0;

const knownReasonCode = (value: unknown): RuntimeActivityReasonCode | null =>
  typeof value === 'string' &&
  (RUNTIME_REASON_CODES as readonly string[]).includes(value)
    ? (value as RuntimeActivityReasonCode)
    : null;

const defaultRuntimeActivityContext = (): RuntimeActivityContext => ({
  adapter: 'none',
  targetKind: 'none',
  protocolVersion: 0,
  configurationGeneration: 0,
  phase: 'not_configured',
  reasonCode: null,
});

export function projectRuntimeActivityContext(
  context: unknown
): RuntimeActivityContext {
  if (typeof context !== 'object' || context === null) {
    return defaultRuntimeActivityContext();
  }

  try {
    const source = context as Record<PropertyKey, unknown>;
    return {
      adapter: knownString(source['adapter'], RUNTIME_ADAPTERS, 'none'),
      targetKind: knownString(
        source['targetKind'],
        RUNTIME_TARGET_KINDS,
        'none'
      ),
      protocolVersion: safeNonnegativeInteger(source['protocolVersion']),
      configurationGeneration: safeNonnegativeInteger(
        source['configurationGeneration']
      ),
      phase: knownString(source['phase'], RUNTIME_PHASES, 'not_configured'),
      reasonCode: knownReasonCode(source['reasonCode']),
    };
  } catch {
    return defaultRuntimeActivityContext();
  }
}

type RuntimeActivityKind =
  | 'runtime_check_requested'
  | 'runtime_ready'
  | 'runtime_unresponsive'
  | 'runtime_initialization_error'
  | 'runtime_unauthorized'
  | 'runtime_network_blocked'
  | 'runtime_incompatible_bridge'
  | 'runtime_reload_requested'
  | 'runtime_recovered'
  | 'runtime_open_requested'
  | 'diagnostics_copied'
  | 'diagnostics_copy_failed'
  | 'configuration_invalid';

interface RuntimeActivityInputBase {
  id: string;
  at: string;
  capability: string;
  runtime?: RuntimeActivityContext;
}

export type RuntimeActivityInput = RuntimeActivityInputBase &
  (
    | { kind: RuntimeActivityKind }
    | { kind: 'mode_changed'; mode: ActivityMode }
  );

export type ActivityKind = RuntimeActivityInput['kind'];

export interface SessionActivityEvent {
  id: string;
  at: string;
  kind: ActivityKind;
  severity: ActivitySeverity;
  capability: string;
  summary: string;
  runtime?: RuntimeActivityContext;
}

export type ActivityAction =
  | { type: 'add'; event: SessionActivityEvent }
  | { type: 'clear' };

export function createSessionActivityEvent(
  input: RuntimeActivityInput
): SessionActivityEvent {
  let severity: ActivitySeverity;
  let summary: string;

  switch (input.kind) {
    case 'runtime_check_requested':
      severity = 'neutral';
      summary = 'Runtime check requested';
      break;
    case 'runtime_ready':
      severity = 'success';
      summary = 'Runtime ready';
      break;
    case 'runtime_unresponsive':
      severity = 'error';
      summary = 'Runtime unresponsive';
      break;
    case 'runtime_initialization_error':
      severity = 'error';
      summary = 'Runtime initialization failed';
      break;
    case 'runtime_unauthorized':
      severity = 'error';
      summary = 'Runtime authorization failed';
      break;
    case 'runtime_network_blocked':
      severity = 'error';
      summary = 'Runtime network request blocked';
      break;
    case 'runtime_incompatible_bridge':
      severity = 'error';
      summary = 'Runtime bridge incompatible';
      break;
    case 'runtime_reload_requested':
      severity = 'neutral';
      summary = 'Runtime reload requested';
      break;
    case 'runtime_recovered':
      severity = 'success';
      summary = 'Runtime recovered';
      break;
    case 'mode_changed':
      severity = 'neutral';
      summary = `Mode changed to ${input.mode}`;
      break;
    case 'runtime_open_requested':
      severity = 'neutral';
      summary = 'Runtime open requested';
      break;
    case 'diagnostics_copied':
      severity = 'success';
      summary = 'Diagnostics copied';
      break;
    case 'diagnostics_copy_failed':
      severity = 'error';
      summary = 'Diagnostics copy failed';
      break;
    case 'configuration_invalid':
      severity = 'error';
      summary = 'Runtime configuration invalid';
      break;
  }

  return {
    id: input.id,
    at: input.at,
    kind: input.kind,
    severity,
    capability: input.capability,
    summary,
    ...(input.runtime
      ? {
          runtime: projectRuntimeActivityContext(input.runtime),
        }
      : {}),
  };
}

const MAX_ACTIVITY_EVENTS = 50;

export function activityReducer(
  state: SessionActivityEvent[],
  action: ActivityAction
): SessionActivityEvent[] {
  switch (action.type) {
    case 'add':
      return [action.event, ...state].slice(0, MAX_ACTIVITY_EVENTS);
    case 'clear':
      return [];
  }
}

/**
 * Problems the user has not looked at yet.
 *
 * Errors only: `mode_changed` and `runtime_ready` fire during ordinary use, so
 * counting every unread event would light the indicator from the user's own
 * actions.
 *
 * `seenCount` is a marker over the log, but `activityReducer` prepends, so the
 * seen events are the array's TAIL and the unseen window runs from index 0.
 *
 * The clamp is load-bearing, not defensive: a marker past the end (possible if
 * the log was trimmed or cleared under it) would otherwise give `slice` a
 * negative end index, which counts back from the tail and reports already-seen
 * errors as unseen.
 */
export function countUnseenProblems(
  events: readonly SessionActivityEvent[],
  seenCount: number
): number {
  const unseen = Math.max(0, events.length - seenCount);
  return events.slice(0, unseen).filter((event) => event.severity === 'error')
    .length;
}
