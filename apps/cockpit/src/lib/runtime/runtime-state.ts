export type RuntimePhase =
  | 'not_configured'
  | 'invalid_configuration'
  | 'connecting'
  | 'checking'
  | 'ready'
  | 'unresponsive'
  | 'reloading'
  | 'error';

export type RuntimeTarget =
  | { kind: 'not_configured' }
  | { kind: 'invalid_configuration' }
  | {
      kind: 'configured';
      configuredUrl: string;
      sanitizedUrl: string;
      origin: string;
    };

export type RuntimeErrorCode = 'bootstrap_failed';
export type RuntimeRecoveryOrigin = 'unresponsive' | 'error';

export interface RuntimeSnapshot {
  phase: RuntimePhase;
  target: RuntimeTarget;
  capability: string;
  activeNonce: string | null;
  checkStartedAt: number | null;
  checkedAt: number | null;
  lastReadyAt: number | null;
  errorCode: RuntimeErrorCode | null;
  frameGeneration: number;
  routeGeneration: number;
  recoveryOrigin: RuntimeRecoveryOrigin | null;
}

export type RuntimeAction =
  | {
      type: 'check_started';
      intent: 'frame_load' | 'recheck';
      nonce: string;
      startedAt: number;
    }
  | { type: 'ready'; nonce: string; at: number }
  | { type: 'timeout'; nonce: string; at: number }
  | {
      type: 'bootstrap_failed';
      nonce: string;
      code: RuntimeErrorCode;
      at: number;
    }
  | { type: 'reload_requested' }
  | { type: 'check_cancelled' }
  | { type: 'route_reset'; target: RuntimeTarget; capability: string };

export type RuntimeTerminalPhase =
  | 'invalid_configuration'
  | 'ready'
  | 'unresponsive'
  | 'error';

export interface RuntimeTerminalTransition {
  capability: string;
  fromState: RuntimePhase;
  toState: RuntimeTerminalPhase;
  elapsedMs?: number;
  transition?: 'recovered';
  reasonCode?: 'bootstrap_failed' | 'invalid_runtime_url';
}

export function parseRuntimeTarget(value: string | null): RuntimeTarget {
  if (value === null) {
    return { kind: 'not_configured' };
  }

  if (typeof value !== 'string' || value.trim().length === 0) {
    return { kind: 'invalid_configuration' };
  }

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { kind: 'invalid_configuration' };
    }

    return {
      kind: 'configured',
      configuredUrl: value,
      sanitizedUrl: `${parsed.origin}${parsed.pathname}`,
      origin: parsed.origin,
    };
  } catch {
    return { kind: 'invalid_configuration' };
  }
}

export function createRuntimeSnapshot(
  target: RuntimeTarget,
  capability: string,
  routeGeneration = 0,
): RuntimeSnapshot {
  const phase =
    target.kind === 'not_configured'
      ? 'not_configured'
      : target.kind === 'invalid_configuration'
        ? 'invalid_configuration'
        : 'connecting';

  return {
    phase,
    target,
    capability,
    activeNonce: null,
    checkStartedAt: null,
    checkedAt: null,
    lastReadyAt: null,
    errorCode: null,
    frameGeneration: 0,
    routeGeneration,
    recoveryOrigin: null,
  };
}

function hasCurrentNonce(state: RuntimeSnapshot, nonce: string): boolean {
  return state.activeNonce !== null && state.activeNonce === nonce;
}

function clearActiveCheck(state: RuntimeSnapshot): RuntimeSnapshot {
  return {
    ...state,
    activeNonce: null,
    checkStartedAt: null,
  };
}

function recoveryOriginFor(
  state: RuntimeSnapshot,
): RuntimeRecoveryOrigin | null {
  if (state.phase === 'unresponsive' || state.phase === 'error') {
    return state.phase;
  }
  return state.recoveryOrigin;
}

export function runtimeReducer(
  state: RuntimeSnapshot,
  action: RuntimeAction,
): RuntimeSnapshot {
  switch (action.type) {
    case 'check_started':
      if (state.target.kind !== 'configured') {
        return state;
      }
      return {
        ...state,
        phase: action.intent === 'recheck' ? 'checking' : state.phase,
        activeNonce: action.nonce,
        checkStartedAt: action.startedAt,
        errorCode: null,
        recoveryOrigin: recoveryOriginFor(state),
      };
    case 'ready':
      if (!hasCurrentNonce(state, action.nonce)) {
        return state;
      }
      return {
        ...clearActiveCheck(state),
        phase: 'ready',
        checkedAt: action.at,
        lastReadyAt: action.at,
        errorCode: null,
        recoveryOrigin: null,
      };
    case 'timeout':
      if (!hasCurrentNonce(state, action.nonce)) {
        return state;
      }
      return {
        ...clearActiveCheck(state),
        phase: 'unresponsive',
        checkedAt: action.at,
        errorCode: null,
        recoveryOrigin: null,
      };
    case 'bootstrap_failed':
      if (!hasCurrentNonce(state, action.nonce)) {
        return state;
      }
      return {
        ...clearActiveCheck(state),
        phase: 'error',
        checkedAt: action.at,
        errorCode: action.code,
        recoveryOrigin: null,
      };
    case 'reload_requested':
      if (state.target.kind !== 'configured') {
        return state;
      }
      return {
        ...clearActiveCheck(state),
        phase: 'reloading',
        frameGeneration: state.frameGeneration + 1,
        errorCode: null,
        recoveryOrigin: recoveryOriginFor(state),
      };
    case 'check_cancelled':
      return clearActiveCheck(state);
    case 'route_reset':
      return createRuntimeSnapshot(
        action.target,
        action.capability,
        state.routeGeneration + 1,
      );
  }
}

function isTerminalPhase(phase: RuntimePhase): phase is RuntimeTerminalPhase {
  return (
    phase === 'invalid_configuration' ||
    phase === 'ready' ||
    phase === 'unresponsive' ||
    phase === 'error'
  );
}

function safeElapsedMs(
  startedAt: number | null,
  completedAt: number | null,
): number | undefined {
  if (
    startedAt === null ||
    completedAt === null ||
    !Number.isFinite(startedAt) ||
    !Number.isFinite(completedAt) ||
    completedAt < startedAt
  ) {
    return undefined;
  }
  return completedAt - startedAt;
}

export function classifyRuntimeTerminalTransition(
  previous: RuntimeSnapshot,
  next: RuntimeSnapshot,
): RuntimeTerminalTransition | null {
  if (
    !isTerminalPhase(next.phase) ||
    (previous.phase === next.phase &&
      previous.routeGeneration === next.routeGeneration)
  ) {
    return null;
  }

  const result: RuntimeTerminalTransition = {
    capability: next.capability,
    fromState:
      next.phase === 'ready' && previous.recoveryOrigin !== null
        ? previous.recoveryOrigin
        : previous.phase,
    toState: next.phase,
  };
  const elapsedMs = safeElapsedMs(previous.checkStartedAt, next.checkedAt);
  if (elapsedMs !== undefined) {
    result.elapsedMs = elapsedMs;
  }
  if (
    next.phase === 'ready' &&
    (previous.phase === 'unresponsive' ||
      previous.phase === 'error' ||
      previous.recoveryOrigin !== null)
  ) {
    result.transition = 'recovered';
  }
  if (next.phase === 'error') {
    result.reasonCode = 'bootstrap_failed';
  } else if (next.phase === 'invalid_configuration') {
    result.reasonCode = 'invalid_runtime_url';
  }
  return result;
}

export function runtimeNeedsAttention(phase: RuntimePhase): boolean {
  return (
    phase === 'invalid_configuration' ||
    phase === 'unresponsive' ||
    phase === 'error'
  );
}
