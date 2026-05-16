// SPDX-License-Identifier: MIT
import { describe, test, expect, beforeEach } from 'vitest';
import { getCockpitSessionId, _resetCockpitSessionIdForTesting } from './distinct-id';

describe('getCockpitSessionId', () => {
  beforeEach(() => _resetCockpitSessionIdForTesting());

  test('returns stable id within process', () => {
    expect(getCockpitSessionId()).toBe(getCockpitSessionId());
  });

  test('id has cockpit_ prefix + uuid shape', () => {
    expect(getCockpitSessionId()).toMatch(/^cockpit_[0-9a-f-]{36}$/);
  });
});
