import { describe, expect, expectTypeOf, test } from 'vitest';
import {
  activityReducer,
  countUnseenProblems,
  createSessionActivityEvent,
  type ActivityKind,
  type ActivitySeverity,
  type RuntimeActivityInput,
  type SessionActivityEvent,
} from './session-activity';
import { runtimeNeedsAttention, type RuntimePhase } from './runtime-state';

const common = {
  id: 'event-1',
  at: '2026-08-31T12:00:00.000Z',
  capability: 'streaming',
} as const;

describe('createSessionActivityEvent', () => {
  test.each([
    [
      { ...common, kind: 'runtime_check_requested' },
      'neutral',
      'Runtime check requested',
    ],
    [{ ...common, kind: 'runtime_ready' }, 'success', 'Runtime ready'],
    [
      { ...common, kind: 'runtime_unresponsive' },
      'error',
      'Runtime unresponsive',
    ],
    [
      { ...common, kind: 'runtime_initialization_error' },
      'error',
      'Runtime initialization failed',
    ],
    [
      { ...common, kind: 'runtime_reload_requested' },
      'neutral',
      'Runtime reload requested',
    ],
    [{ ...common, kind: 'runtime_recovered' }, 'success', 'Runtime recovered'],
    [
      { ...common, kind: 'mode_changed', mode: 'Run' },
      'neutral',
      'Mode changed to Run',
    ],
    [
      { ...common, kind: 'mode_changed', mode: 'Code' },
      'neutral',
      'Mode changed to Code',
    ],
    [
      { ...common, kind: 'mode_changed', mode: 'Docs' },
      'neutral',
      'Mode changed to Docs',
    ],
    [
      { ...common, kind: 'mode_changed', mode: 'API' },
      'neutral',
      'Mode changed to API',
    ],
    [
      { ...common, kind: 'runtime_open_requested' },
      'neutral',
      'Runtime open requested',
    ],
    [
      { ...common, kind: 'diagnostics_copied' },
      'success',
      'Diagnostics copied',
    ],
    [
      { ...common, kind: 'diagnostics_copy_failed' },
      'error',
      'Diagnostics copy failed',
    ],
    [
      { ...common, kind: 'configuration_invalid' },
      'error',
      'Runtime configuration invalid',
    ],
  ] satisfies ReadonlyArray<
    readonly [RuntimeActivityInput, SessionActivityEvent['severity'], string]
  >)(
    'formats $0.kind with fixed severity and summary',
    (input, severity, summary) => {
      expect(createSessionActivityEvent(input)).toEqual({
        id: common.id,
        at: common.at,
        kind: input.kind,
        severity,
        capability: common.capability,
        summary,
      });
    },
  );

  test('exports only the semantic allowlist as event kinds', () => {
    expectTypeOf<ActivityKind>().toEqualTypeOf<
      | 'runtime_check_requested'
      | 'runtime_ready'
      | 'runtime_unresponsive'
      | 'runtime_initialization_error'
      | 'runtime_reload_requested'
      | 'runtime_recovered'
      | 'mode_changed'
      | 'runtime_open_requested'
      | 'diagnostics_copied'
      | 'diagnostics_copy_failed'
      | 'configuration_invalid'
    >();
  });
});

describe('activityReducer', () => {
  function event(id: string, capability = 'streaming'): SessionActivityEvent {
    return createSessionActivityEvent({
      id,
      at: `2026-08-31T12:00:${id.padStart(2, '0')}.000Z`,
      capability,
      kind: 'runtime_ready',
    });
  }

  test('stores events newest first', () => {
    const first = event('1');
    const second = event('2');
    expect(
      activityReducer(activityReducer([], { type: 'add', event: first }), {
        type: 'add',
        event: second,
      }),
    ).toEqual([second, first]);
  });

  test('caps the list at exactly 50 and drops the oldest entries', () => {
    let state: SessionActivityEvent[] = [];
    for (let index = 0; index < 51; index += 1) {
      state = activityReducer(state, {
        type: 'add',
        event: event(String(index)),
      });
    }

    expect(state).toHaveLength(50);
    expect(state[0]?.id).toBe('50');
    expect(state.at(-1)?.id).toBe('1');
  });

  test('clear returns an empty event list', () => {
    expect(
      activityReducer([event('1')], { type: 'clear' }),
    ).toEqual([]);
  });

  test('retains capability labels on older entries', () => {
    const older = event('1', 'streaming');
    const newer = event('2', 'persistence');
    expect(
      activityReducer(activityReducer([], { type: 'add', event: older }), {
        type: 'add',
        event: newer,
      }).map(({ capability }) => capability),
    ).toEqual(['persistence', 'streaming']);
  });
});

describe('runtimeNeedsAttention', () => {
  test.each([
    ['not_configured', false],
    ['invalid_configuration', true],
    ['connecting', false],
    ['checking', false],
    ['ready', false],
    ['unresponsive', true],
    ['reloading', false],
    ['error', true],
  ] satisfies ReadonlyArray<readonly [RuntimePhase, boolean]>)(
    'derives attention for %s solely from phase',
    (phase, expected) => {
      expect(runtimeNeedsAttention(phase)).toBe(expected);
    },
  );
});

describe('countUnseenProblems', () => {
  const event = (
    id: string,
    kind: ActivityKind,
    severity: ActivitySeverity,
  ): SessionActivityEvent => ({
    id,
    at: '2026-08-31T17:00:00.000Z',
    kind,
    severity,
    capability: 'streaming',
    summary: kind,
  });

  test('counts only error events beyond the seen marker', () => {
    const events = [
      event('a', 'runtime_ready', 'success'),
      event('b', 'mode_changed', 'neutral'),
      event('c', 'runtime_unresponsive', 'error'),
    ];
    expect(countUnseenProblems(events, 0)).toBe(1);
  });

  test('ignores routine activity entirely', () => {
    const events = [
      event('a', 'runtime_ready', 'success'),
      event('b', 'mode_changed', 'neutral'),
    ];
    expect(countUnseenProblems(events, 0)).toBe(0);
  });

  test('ignores errors the user has already seen', () => {
    const events = [
      event('a', 'runtime_unresponsive', 'error'),
      event('b', 'mode_changed', 'neutral'),
    ];
    expect(countUnseenProblems(events, 2)).toBe(0);
  });

  test('reads the unseen window from the newest end of the log', () => {
    // activityReducer prepends, so index 0 is the most recent arrival and the
    // seen prefix is the TAIL of the array.
    const events = [
      event('c', 'runtime_unresponsive', 'error'),
      event('b', 'mode_changed', 'neutral'),
      event('a', 'runtime_ready', 'success'),
    ];
    expect(countUnseenProblems(events, 2)).toBe(1);
  });

  test('treats a marker beyond the log as everything seen', () => {
    const events = [event('a', 'runtime_unresponsive', 'error')];
    expect(countUnseenProblems(events, 5)).toBe(0);
  });
});
