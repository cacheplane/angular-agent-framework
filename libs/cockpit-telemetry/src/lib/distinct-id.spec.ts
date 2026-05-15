// SPDX-License-Identifier: MIT
// @vitest-environment jsdom
import { describe, test, expect, beforeEach } from 'vitest';
import { readCockpitConfigFromIframe } from './distinct-id';

describe('readCockpitConfigFromIframe', () => {
  function setSearch(s: string): void {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, search: s },
    });
  }

  beforeEach(() => setSearch(''));

  test('returns null when no URL params present', () => {
    setSearch('');
    expect(readCockpitConfigFromIframe()).toBe(null);
  });

  test('returns null when cockpit_did is missing', () => {
    setSearch('?cockpit_phk=k&cockpit_cap=c');
    expect(readCockpitConfigFromIframe()).toBe(null);
  });

  test('returns null when cockpit_phk is missing', () => {
    setSearch('?cockpit_did=d&cockpit_cap=c');
    expect(readCockpitConfigFromIframe()).toBe(null);
  });

  test('returns null when cockpit_cap is missing', () => {
    setSearch('?cockpit_did=d&cockpit_phk=k');
    expect(readCockpitConfigFromIframe()).toBe(null);
  });

  test('returns config with all params and default host', () => {
    setSearch('?cockpit_did=session-1&cockpit_phk=phc_test&cockpit_cap=streaming');
    const config = readCockpitConfigFromIframe();
    expect(config).toEqual({
      distinctId: 'session-1',
      posthogKey: 'phc_test',
      capabilitySlug: 'streaming',
      posthogHost: 'https://us.i.posthog.com',
    });
  });

  test('returns config with explicit host', () => {
    setSearch(
      '?cockpit_did=d&cockpit_phk=k&cockpit_cap=c&cockpit_host=https://eu.i.posthog.com',
    );
    expect(readCockpitConfigFromIframe()?.posthogHost).toBe('https://eu.i.posthog.com');
  });
});
