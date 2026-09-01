// SPDX-License-Identifier: MIT
import { describe, test, expect, beforeEach, expectTypeOf, vi } from 'vitest';
import { track } from './client';
import type {
  CockpitRuntimeActionProps,
  CockpitRuntimeStatusChangedProps,
} from './events';
import type { RuntimePhase } from '../runtime/runtime-state';

const mocks = vi.hoisted(() => ({ capture: vi.fn(), __loaded: true }));

vi.mock('posthog-js', () => ({
  default: {
    capture: mocks.capture,
    get __loaded() {
      return mocks.__loaded;
    },
  },
}));

describe('track', () => {
  beforeEach(() => {
    mocks.capture.mockClear();
    mocks.__loaded = true;
  });

  test('fires posthog.capture when loaded', () => {
    track('cockpit:recipe_opened', { capability: 'streaming' });
    expect(mocks.capture).toHaveBeenCalledWith('cockpit:recipe_opened', {
      capability: 'streaming',
    });
  });

  test('no-ops when posthog not loaded', () => {
    mocks.__loaded = false;
    track('cockpit:mode_switched', {
      capability: 'x',
      from_mode: 'run',
      to_mode: 'code',
    });
    expect(mocks.capture).not.toHaveBeenCalled();
  });

  test('passes empty properties when not provided', () => {
    track('cockpit:code_copied');
    expect(mocks.capture).toHaveBeenCalledWith('cockpit:code_copied', {});
  });

  test('accepts only the allowlisted operational analytics vocabulary', () => {
    expectTypeOf<CockpitRuntimeActionProps['action']>().toEqualTypeOf<
      'recheck' | 'reload' | 'open' | 'copy_diagnostics'
    >();
    expectTypeOf<
      CockpitRuntimeActionProps['state_before']
    >().toEqualTypeOf<RuntimePhase>();
    expectTypeOf<CockpitRuntimeActionProps['outcome']>().toEqualTypeOf<
      'requested' | 'succeeded' | 'failed'
    >();
    expectTypeOf<
      CockpitRuntimeStatusChangedProps['reason_code']
    >().toEqualTypeOf<'bootstrap_failed' | 'invalid_runtime_url' | undefined>();

    const action: CockpitRuntimeActionProps = {
      capability: 'streaming',
      action: 'copy_diagnostics',
      state_before: 'ready',
      outcome: 'succeeded',
    };
    const status: CockpitRuntimeStatusChangedProps = {
      capability: 'streaming',
      from_state: 'unresponsive',
      to_state: 'ready',
      transition: 'recovered',
      elapsed_ms: 25,
    };

    track('cockpit:runtime_action', action);
    track('cockpit:runtime_status_changed', status);

    expect(mocks.capture).toHaveBeenNthCalledWith(
      1,
      'cockpit:runtime_action',
      action
    );
    expect(mocks.capture).toHaveBeenNthCalledWith(
      2,
      'cockpit:runtime_status_changed',
      status
    );
    const propertyKeys = mocks.capture.mock.calls.flatMap(([, properties]) =>
      Object.keys(properties)
    );
    expect(propertyKeys).not.toEqual(
      expect.arrayContaining([
        'url',
        'runtime_url',
        'nonce',
        'raw_error',
        'diagnostics_id',
        'session_id',
      ])
    );
  });

  test('correlates operational events with their exact property bags', () => {
    track('cockpit:recipe_opened');
    track('cockpit:mode_switched', {
      capability: 'streaming',
      from_mode: 'run',
      to_mode: 'code',
    });

    const compileInvalidOperationalCalls = () => {
      // @ts-expect-error runtime actions require their property bag
      track('cockpit:runtime_action');
      // @ts-expect-error reload cannot report clipboard success
      track('cockpit:runtime_action', {
        capability: 'streaming',
        action: 'reload',
        state_before: 'ready',
        outcome: 'succeeded',
      });
      // @ts-expect-error status events cannot use action properties
      track('cockpit:runtime_status_changed', {
        capability: 'streaming',
        action: 'recheck',
        state_before: 'ready',
        outcome: 'requested',
      });
      // @ts-expect-error recovery is only a terminal failure to ready
      track('cockpit:runtime_status_changed', {
        capability: 'streaming',
        from_state: 'ready',
        to_state: 'error',
        transition: 'recovered',
      });
      // @ts-expect-error terminal recovery origins require recovered transition
      track('cockpit:runtime_status_changed', {
        capability: 'streaming',
        from_state: 'unresponsive',
        to_state: 'ready',
      });
      // @ts-expect-error invalid URL reasons belong only to invalid configuration
      track('cockpit:runtime_status_changed', {
        capability: 'streaming',
        from_state: 'checking',
        to_state: 'error',
        reason_code: 'invalid_runtime_url',
      });
    };
    expectTypeOf(compileInvalidOperationalCalls).toBeFunction();
  });
});
