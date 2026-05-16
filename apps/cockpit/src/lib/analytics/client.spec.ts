// SPDX-License-Identifier: MIT
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { track } from './client';

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
    expect(mocks.capture).toHaveBeenCalledWith('cockpit:recipe_opened', { capability: 'streaming' });
  });

  test('no-ops when posthog not loaded', () => {
    mocks.__loaded = false;
    track('cockpit:mode_switched', { capability: 'x', from_mode: 'run', to_mode: 'code' });
    expect(mocks.capture).not.toHaveBeenCalled();
  });

  test('passes empty properties when not provided', () => {
    track('cockpit:code_copied');
    expect(mocks.capture).toHaveBeenCalledWith('cockpit:code_copied', {});
  });
});
