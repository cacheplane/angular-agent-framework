import { describe, expect, it, test } from 'vitest';
import {
  classifyRuntimeTerminalTransition,
  createRuntimeSnapshot,
  parseRuntimeTarget,
  runtimeRailStatus,
  runtimeReducer,
  type RuntimeSnapshot,
} from './runtime-state';

const capability = 'streaming';
const configuredTarget = parseRuntimeTarget(
  'https://runtime.test/path?secret=x#hash'
);

function checkingSnapshot(): RuntimeSnapshot {
  return runtimeReducer(createRuntimeSnapshot(configuredTarget, capability), {
    type: 'check_started',
    intent: 'recheck',
    nonce: 'nonce-1',
    startedAt: 1_000,
  });
}

describe('parseRuntimeTarget', () => {
  test('treats null as not configured', () => {
    expect(parseRuntimeTarget(null)).toEqual({ kind: 'not_configured' });
  });

  test.each([
    '',
    '   ',
    '/relative',
    'javascript:alert(1)',
    'data:text/plain,secret',
    'ftp://runtime.test/path',
  ])('rejects an unsafe configured value without exposing it: %s', (value) => {
    expect(parseRuntimeTarget(value)).toEqual({
      kind: 'invalid_configuration',
    });
  });

  test('treats an out-of-contract undefined value as invalid rather than throwing', () => {
    expect(parseRuntimeTarget(undefined as unknown as null)).toEqual({
      kind: 'invalid_configuration',
    });
  });

  test('preserves configured identity and strips the entire query and hash', () => {
    expect(configuredTarget).toEqual({
      kind: 'configured',
      configuredUrl: 'https://runtime.test/path?secret=x#hash',
      sanitizedUrl: 'https://runtime.test/path',
      origin: 'https://runtime.test',
    });
  });

  test('accepts HTTP credentials while omitting them from the sanitized identity', () => {
    expect(
      parseRuntimeTarget(
        'https://user:password@runtime.test/path?secret=x#hash'
      )
    ).toEqual({
      kind: 'configured',
      configuredUrl: 'https://user:password@runtime.test/path?secret=x#hash',
      sanitizedUrl: 'https://runtime.test/path',
      origin: 'https://runtime.test',
    });
  });

  test('accepts HTTP and normalizes an empty pathname', () => {
    expect(parseRuntimeTarget('http://runtime.test?token=secret')).toEqual({
      kind: 'configured',
      configuredUrl: 'http://runtime.test?token=secret',
      sanitizedUrl: 'http://runtime.test/',
      origin: 'http://runtime.test',
    });
  });

  test('never throws for a malformed URL', () => {
    expect(() => parseRuntimeTarget('http://[invalid')).not.toThrow();
    expect(parseRuntimeTarget('http://[invalid')).toEqual({
      kind: 'invalid_configuration',
    });
  });
});

describe('runtime state', () => {
  test('initializes each target category to its distinct phase', () => {
    expect(
      createRuntimeSnapshot(parseRuntimeTarget(null), capability).phase
    ).toBe('not_configured');
    expect(
      createRuntimeSnapshot(parseRuntimeTarget('invalid'), capability).phase
    ).toBe('invalid_configuration');
    expect(createRuntimeSnapshot(configuredTarget, capability)).toMatchObject({
      phase: 'connecting',
      target: configuredTarget,
      capability,
      activeNonce: null,
      checkStartedAt: null,
      checkedAt: null,
      lastReadyAt: null,
      errorCode: null,
      frameGeneration: 0,
      routeGeneration: 0,
      targetGeneration: 0,
      recoveryOrigin: null,
    });
  });

  test('tracks configuration and target generations independently from routes and frames', () => {
    const initial = createRuntimeSnapshot(configuredTarget, capability);
    const configuring = runtimeReducer(initial, {
      type: 'configuration_started',
    } as never);
    expect(configuring).toMatchObject({
      phase: 'configuring',
      routeGeneration: 0,
      frameGeneration: 0,
      targetGeneration: 0,
    });

    const configured = runtimeReducer(configuring, {
      type: 'configuration_succeeded',
    } as never);
    expect(configured.phase).toBe('connecting');

    const targetChanged = runtimeReducer(configured, {
      type: 'context_reset',
      target: configuredTarget,
      capability,
      routeChanged: false,
      targetChanged: true,
    } as never);
    expect(targetChanged).toMatchObject({
      phase: 'connecting',
      routeGeneration: 0,
      frameGeneration: 1,
      targetGeneration: 1,
    });

    const routeChanged = runtimeReducer(targetChanged, {
      type: 'context_reset',
      target: configuredTarget,
      capability: 'persistence',
      routeChanged: true,
      targetChanged: false,
    } as never);
    expect(routeChanged).toMatchObject({
      routeGeneration: 1,
      frameGeneration: 1,
      targetGeneration: 1,
    });
  });

  test.each([
    ['unauthorized', 'unauthorized'],
    ['network_blocked', 'network_blocked'],
    ['incompatible_bridge', 'incompatible_bridge'],
  ] as const)(
    'records the allowlisted %s runtime failure phase',
    (code, phase) => {
      const failed = runtimeReducer(
        createRuntimeSnapshot(configuredTarget, capability),
        { type: 'runtime_failure', code, at: 1_250 } as never
      );
      expect(failed).toMatchObject({
        phase,
        errorCode: code,
        checkedAt: 1_250,
      });
    }
  );

  test('starts an initial frame check without claiming ready', () => {
    const state = runtimeReducer(
      createRuntimeSnapshot(configuredTarget, capability),
      {
        type: 'check_started',
        intent: 'frame_load',
        nonce: 'nonce-1',
        startedAt: 1_000,
      }
    );

    expect(state).toMatchObject({
      phase: 'connecting',
      activeNonce: 'nonce-1',
      checkStartedAt: 1_000,
    });
  });

  test('user recheck enters checking', () => {
    expect(checkingSnapshot()).toMatchObject({
      phase: 'checking',
      activeNonce: 'nonce-1',
      checkStartedAt: 1_000,
    });
  });

  test('accepts ready only for the current nonce and records readiness history', () => {
    const state = runtimeReducer(checkingSnapshot(), {
      type: 'ready',
      nonce: 'nonce-1',
      at: 1_250,
    });

    expect(state).toMatchObject({
      phase: 'ready',
      activeNonce: null,
      checkStartedAt: null,
      checkedAt: 1_250,
      lastReadyAt: 1_250,
      errorCode: null,
    });
  });

  test('records a current-nonce timeout without changing ready history', () => {
    const previouslyReady = runtimeReducer(checkingSnapshot(), {
      type: 'ready',
      nonce: 'nonce-1',
      at: 1_250,
    });
    const checkingAgain = runtimeReducer(previouslyReady, {
      type: 'check_started',
      intent: 'recheck',
      nonce: 'nonce-2',
      startedAt: 2_000,
    });

    expect(
      runtimeReducer(checkingAgain, {
        type: 'timeout',
        nonce: 'nonce-2',
        at: 7_000,
      })
    ).toMatchObject({
      phase: 'unresponsive',
      activeNonce: null,
      checkStartedAt: null,
      checkedAt: 7_000,
      lastReadyAt: 1_250,
      errorCode: null,
    });
  });

  test('records only the allowlisted initialization error', () => {
    expect(
      runtimeReducer(checkingSnapshot(), {
        type: 'bootstrap_failed',
        nonce: 'nonce-1',
        code: 'bootstrap_failed',
        at: 1_300,
      })
    ).toMatchObject({
      phase: 'error',
      activeNonce: null,
      checkStartedAt: null,
      checkedAt: 1_300,
      errorCode: 'bootstrap_failed',
    });
  });

  test.each([
    { type: 'ready', nonce: 'stale', at: 2_000 } as const,
    { type: 'timeout', nonce: 'stale', at: 2_000 } as const,
    {
      type: 'bootstrap_failed',
      nonce: 'stale',
      code: 'bootstrap_failed',
      at: 2_000,
    } as const,
  ])('returns the same state for stale terminal action $type', (action) => {
    const state = checkingSnapshot();
    expect(runtimeReducer(state, action)).toBe(state);
  });

  test('reload invalidates the check and preserves target, capability, and history', () => {
    const ready = runtimeReducer(checkingSnapshot(), {
      type: 'ready',
      nonce: 'nonce-1',
      at: 1_250,
    });
    const checkingAgain = runtimeReducer(ready, {
      type: 'check_started',
      intent: 'recheck',
      nonce: 'nonce-2',
      startedAt: 2_000,
    });
    const reloading = runtimeReducer(checkingAgain, {
      type: 'reload_requested',
    });

    expect(reloading).toMatchObject({
      phase: 'reloading',
      target: configuredTarget,
      capability,
      activeNonce: null,
      checkStartedAt: null,
      checkedAt: 1_250,
      lastReadyAt: 1_250,
      frameGeneration: 1,
    });

    expect(
      runtimeReducer(reloading, {
        type: 'check_started',
        intent: 'frame_load',
        nonce: 'nonce-3',
        startedAt: 2_100,
      }).phase
    ).toBe('reloading');
  });

  test('cancellation invalidates a nonce without inventing a terminal phase', () => {
    expect(
      runtimeReducer(checkingSnapshot(), { type: 'check_cancelled' })
    ).toMatchObject({
      phase: 'checking',
      activeNonce: null,
      checkStartedAt: null,
      checkedAt: null,
    });
  });

  test('route reset creates the correct fresh snapshot', () => {
    const resetTarget = parseRuntimeTarget('https://next.runtime.test/new');
    expect(
      runtimeReducer(checkingSnapshot(), {
        type: 'route_reset',
        target: resetTarget,
        capability: 'persistence',
      })
    ).toEqual({
      ...createRuntimeSnapshot(resetTarget, 'persistence'),
      routeGeneration: 1,
    });
  });
});

describe('classifyRuntimeTerminalTransition', () => {
  test.each(['connecting', 'checking', 'reloading'] as const)(
    'does not classify a transition to %s',
    (phase) => {
      const previous = createRuntimeSnapshot(configuredTarget, capability);
      expect(
        classifyRuntimeTerminalTransition(previous, { ...previous, phase })
      ).toBeNull();
    }
  );

  test('does not classify a duplicate semantic terminal state', () => {
    const ready = runtimeReducer(checkingSnapshot(), {
      type: 'ready',
      nonce: 'nonce-1',
      at: 1_250,
    });
    expect(
      classifyRuntimeTerminalTransition(ready, {
        ...ready,
        checkedAt: 2_000,
      })
    ).toBeNull();
  });

  test('classifies a ready terminal transition with safe elapsed time', () => {
    const previous = checkingSnapshot();
    const next = runtimeReducer(previous, {
      type: 'ready',
      nonce: 'nonce-1',
      at: 1_250,
    });

    expect(classifyRuntimeTerminalTransition(previous, next)).toEqual({
      capability,
      fromState: 'checking',
      toState: 'ready',
      elapsedMs: 250,
    });
  });

  test.each(['unresponsive', 'error'] as const)(
    'classifies a direct %s to ready change as one recovery',
    (phase) => {
      const previous = {
        ...createRuntimeSnapshot(configuredTarget, capability),
        phase,
      };
      const next = { ...previous, phase: 'ready' as const };
      expect(classifyRuntimeTerminalTransition(previous, next)).toEqual({
        capability,
        fromState: phase,
        toState: 'ready',
        transition: 'recovered',
      });
    }
  );

  test('classifies unresponsive through recheck to ready as exactly one recovery', () => {
    const pending = checkingSnapshot();
    const unresponsive = runtimeReducer(pending, {
      type: 'timeout',
      nonce: 'nonce-1',
      at: 6_000,
    });
    const rechecking = runtimeReducer(unresponsive, {
      type: 'check_started',
      intent: 'recheck',
      nonce: 'nonce-2',
      startedAt: 7_000,
    });
    const ready = runtimeReducer(rechecking, {
      type: 'ready',
      nonce: 'nonce-2',
      at: 7_250,
    });

    expect(
      [
        classifyRuntimeTerminalTransition(unresponsive, rechecking),
        classifyRuntimeTerminalTransition(rechecking, ready),
        classifyRuntimeTerminalTransition(ready, { ...ready }),
      ].filter((transition) => transition !== null)
    ).toEqual([
      {
        capability,
        fromState: 'unresponsive',
        toState: 'ready',
        elapsedMs: 250,
        transition: 'recovered',
      },
    ]);
    expect(ready.recoveryOrigin).toBeNull();
  });

  test('classifies error through reload and frame check to ready as exactly one recovery', () => {
    const failed = runtimeReducer(checkingSnapshot(), {
      type: 'bootstrap_failed',
      nonce: 'nonce-1',
      code: 'bootstrap_failed',
      at: 1_300,
    });
    const reloading = runtimeReducer(failed, { type: 'reload_requested' });
    const checkingReload = runtimeReducer(reloading, {
      type: 'check_started',
      intent: 'frame_load',
      nonce: 'nonce-2',
      startedAt: 2_000,
    });
    const ready = runtimeReducer(checkingReload, {
      type: 'ready',
      nonce: 'nonce-2',
      at: 2_200,
    });

    expect(
      [
        classifyRuntimeTerminalTransition(failed, reloading),
        classifyRuntimeTerminalTransition(reloading, checkingReload),
        classifyRuntimeTerminalTransition(checkingReload, ready),
      ].filter((transition) => transition !== null)
    ).toEqual([
      {
        capability,
        fromState: 'error',
        toState: 'ready',
        elapsedMs: 200,
        transition: 'recovered',
      },
    ]);
    expect(ready.recoveryOrigin).toBeNull();
  });

  test('keeps ready through recheck to ready generic after a recovery', () => {
    const unresponsive = runtimeReducer(checkingSnapshot(), {
      type: 'timeout',
      nonce: 'nonce-1',
      at: 6_000,
    });
    const recoveredCheck = runtimeReducer(unresponsive, {
      type: 'check_started',
      intent: 'recheck',
      nonce: 'nonce-2',
      startedAt: 7_000,
    });
    const recovered = runtimeReducer(recoveredCheck, {
      type: 'ready',
      nonce: 'nonce-2',
      at: 7_250,
    });
    const ordinaryCheck = runtimeReducer(recovered, {
      type: 'check_started',
      intent: 'recheck',
      nonce: 'nonce-3',
      startedAt: 8_000,
    });
    const readyAgain = runtimeReducer(ordinaryCheck, {
      type: 'ready',
      nonce: 'nonce-3',
      at: 8_100,
    });

    expect(
      classifyRuntimeTerminalTransition(ordinaryCheck, readyAgain)
    ).toEqual({
      capability,
      fromState: 'checking',
      toState: 'ready',
      elapsedMs: 100,
    });
  });

  test('stale terminal actions preserve a pending recovery origin', () => {
    const unresponsive = runtimeReducer(checkingSnapshot(), {
      type: 'timeout',
      nonce: 'nonce-1',
      at: 6_000,
    });
    const rechecking = runtimeReducer(unresponsive, {
      type: 'check_started',
      intent: 'recheck',
      nonce: 'nonce-2',
      startedAt: 7_000,
    });

    expect(
      runtimeReducer(rechecking, {
        type: 'ready',
        nonce: 'stale',
        at: 7_250,
      })
    ).toBe(rechecking);
    expect(rechecking.recoveryOrigin).toBe('unresponsive');
  });

  test('classifies initialization failure with only its allowlisted reason', () => {
    const previous = checkingSnapshot();
    const next = runtimeReducer(previous, {
      type: 'bootstrap_failed',
      nonce: 'nonce-1',
      code: 'bootstrap_failed',
      at: 1_300,
    });
    expect(classifyRuntimeTerminalTransition(previous, next)).toEqual({
      capability,
      fromState: 'checking',
      toState: 'error',
      elapsedMs: 300,
      reasonCode: 'bootstrap_failed',
    });
  });

  test('classifies invalid configuration without exposing its rejected value', () => {
    const previous = createRuntimeSnapshot(
      parseRuntimeTarget(null),
      capability
    );
    const next = createRuntimeSnapshot(
      parseRuntimeTarget('https://runtime.test/?secret=x'),
      capability
    );
    const invalid = {
      ...next,
      target: parseRuntimeTarget('javascript:secret'),
      phase: 'invalid_configuration' as const,
    };

    expect(classifyRuntimeTerminalTransition(previous, invalid)).toEqual({
      capability,
      fromState: 'not_configured',
      toState: 'invalid_configuration',
      reasonCode: 'invalid_runtime_url',
    });
    expect(JSON.stringify(invalid)).not.toContain('javascript:secret');
  });

  test('omits elapsed time when timestamps are unsafe', () => {
    const previous = {
      ...checkingSnapshot(),
      checkStartedAt: Number.NaN,
    };
    const next = {
      ...previous,
      phase: 'unresponsive' as const,
      activeNonce: null,
      checkStartedAt: null,
      checkedAt: 2_000,
    };

    expect(classifyRuntimeTerminalTransition(previous, next)).toEqual({
      capability,
      fromState: 'checking',
      toState: 'unresponsive',
    });
  });

  test('classifies invalid configuration again after a capability route reset', () => {
    const previous = createRuntimeSnapshot(
      parseRuntimeTarget('invalid-a'),
      'capability-a'
    );
    const next = runtimeReducer(previous, {
      type: 'route_reset',
      target: parseRuntimeTarget('invalid-b'),
      capability: 'capability-b',
    });

    expect(classifyRuntimeTerminalTransition(previous, next)).toEqual({
      capability: 'capability-b',
      fromState: 'invalid_configuration',
      toState: 'invalid_configuration',
      reasonCode: 'invalid_runtime_url',
    });
    expect(next.routeGeneration).toBe(1);
  });

  test('classifies a new invalid route for the same capability but dedupes its renders', () => {
    const previous = createRuntimeSnapshot(
      parseRuntimeTarget('invalid-a'),
      capability
    );
    const next = runtimeReducer(previous, {
      type: 'route_reset',
      target: parseRuntimeTarget('invalid-b'),
      capability,
    });

    expect(classifyRuntimeTerminalTransition(previous, next)).toEqual({
      capability,
      fromState: 'invalid_configuration',
      toState: 'invalid_configuration',
      reasonCode: 'invalid_runtime_url',
    });
    expect(
      classifyRuntimeTerminalTransition(next, {
        ...next,
        checkedAt: 2_000,
      })
    ).toBeNull();
  });
});

describe('runtimeRailStatus', () => {
  it('maps every phase to a rail status', () => {
    expect(runtimeRailStatus('ready')).toEqual({
      kind: 'success',
      label: 'runtime ready',
    });
    expect(runtimeRailStatus('connecting')).toEqual({
      kind: 'working',
      label: 'runtime starting',
    });
    expect(runtimeRailStatus('configuring' as never)).toEqual({
      kind: 'working',
      label: 'runtime starting',
    });
    expect(runtimeRailStatus('checking')).toEqual({
      kind: 'working',
      label: 'runtime starting',
    });
    expect(runtimeRailStatus('reloading')).toEqual({
      kind: 'working',
      label: 'runtime starting',
    });
    expect(runtimeRailStatus('unresponsive')).toEqual({
      kind: 'error',
      label: 'runtime error',
    });
    expect(runtimeRailStatus('error')).toEqual({
      kind: 'error',
      label: 'runtime error',
    });
    for (const phase of [
      'unauthorized',
      'network_blocked',
      'incompatible_bridge',
    ] as const) {
      expect(runtimeRailStatus(phase as never)).toEqual({
        kind: 'error',
        label: 'runtime error',
      });
    }
    expect(runtimeRailStatus('invalid_configuration')).toEqual({
      kind: 'error',
      label: 'runtime error',
    });
  });

  it('reports no status when there is no runtime to report on', () => {
    expect(runtimeRailStatus('not_configured')).toBeNull();
  });
});
