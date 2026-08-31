export type ActivitySeverity = 'neutral' | 'success' | 'error';
export type ActivityMode = 'Run' | 'Code' | 'Docs' | 'API';

type RuntimeActivityKind =
  | 'runtime_check_requested'
  | 'runtime_ready'
  | 'runtime_unresponsive'
  | 'runtime_initialization_error'
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
}

export type ActivityAction =
  | { type: 'add'; event: SessionActivityEvent }
  | { type: 'clear' };

export function createSessionActivityEvent(
  input: RuntimeActivityInput,
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
  };
}

const MAX_ACTIVITY_EVENTS = 50;

export function activityReducer(
  state: SessionActivityEvent[],
  action: ActivityAction,
): SessionActivityEvent[] {
  switch (action.type) {
    case 'add':
      return [action.event, ...state].slice(0, MAX_ACTIVITY_EVENTS);
    case 'clear':
      return [];
  }
}
