// SPDX-License-Identifier: MIT
// @vitest-environment jsdom
import { describe, test, expect, vi } from 'vitest';
import { readCockpitConfigFromIframe } from './distinct-id';

// If anything in this module's static import graph pulls posthog-js, the
// factory below throws at evaluation time and the spec file fails to load.
vi.mock('posthog-js', () => {
  throw new Error('posthog-js MUST NOT be imported when no cockpit URL params are present');
});

describe('browser silence (permanent contract)', () => {
  test('no posthog-js import triggered by readCockpitConfigFromIframe when no URL params', () => {
    // No-op URL params — just reads window.location.search.
    expect(readCockpitConfigFromIframe()).toBe(null);
    // posthog-js mock has thrown by now if it was imported eagerly.
  });
});
