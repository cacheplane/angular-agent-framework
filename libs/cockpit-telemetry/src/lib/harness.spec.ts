// SPDX-License-Identifier: MIT
// @vitest-environment jsdom
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { Component, type ApplicationConfig } from '@angular/core';

const mocks = vi.hoisted(() => ({
  bootstrapApplication: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@angular/platform-browser', () => ({
  bootstrapApplication: mocks.bootstrapApplication,
}));

import { bootstrapWithCockpitHarness } from './harness';

@Component({ selector: 'lib-test', standalone: true, template: '' })
class TestComponent {}

describe('bootstrapWithCockpitHarness', () => {
  function setSearch(s: string): void {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, search: s },
    });
  }

  beforeEach(() => {
    setSearch('');
    mocks.bootstrapApplication.mockClear();
  });

  test('bootstraps pristine when no cockpit URL params present', async () => {
    setSearch('');
    const appConfig: ApplicationConfig = { providers: [] };
    await bootstrapWithCockpitHarness(TestComponent, appConfig);
    expect(mocks.bootstrapApplication).toHaveBeenCalledWith(
      TestComponent,
      expect.objectContaining({ providers: [] }),
    );
  });

  test('bootstraps with provideCockpitTelemetry when params present', async () => {
    setSearch('?cockpit_did=d1&cockpit_phk=phc_test&cockpit_cap=streaming');
    const appConfig: ApplicationConfig = { providers: [{ provide: 'TEST', useValue: 1 }] };
    await bootstrapWithCockpitHarness(TestComponent, appConfig);
    const call = mocks.bootstrapApplication.mock.calls[0];
    expect(call[0]).toBe(TestComponent);
    const cfg = call[1] as ApplicationConfig;
    expect((cfg.providers ?? []).length).toBeGreaterThan((appConfig.providers ?? []).length);
  });
});
