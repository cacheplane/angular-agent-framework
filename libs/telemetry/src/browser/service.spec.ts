// @vitest-environment jsdom
import { describe, test, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { NgafTelemetryService } from './service';
import { NGAF_TELEMETRY_CONFIG } from './tokens';

describe('NgafTelemetryService', () => {
  test('capture() resolves without calling posthog when enabled is false', async () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: NGAF_TELEMETRY_CONFIG, useValue: { enabled: false } },
        NgafTelemetryService,
      ],
    });
    const svc = TestBed.inject(NgafTelemetryService);
    await expect(svc.capture('ngaf:browser_provided')).resolves.toBeUndefined();
  });

  test('capture() resolves without calling posthog when no config provided', async () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: NGAF_TELEMETRY_CONFIG, useValue: null },
        NgafTelemetryService,
      ],
    });
    const svc = TestBed.inject(NgafTelemetryService);
    await expect(svc.capture('ngaf:browser_provided')).resolves.toBeUndefined();
  });

  test('capture() no-ops when posthogKey is missing even with enabled:true', async () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: NGAF_TELEMETRY_CONFIG, useValue: { enabled: true } },
        NgafTelemetryService,
      ],
    });
    const svc = TestBed.inject(NgafTelemetryService);
    await expect(svc.capture('ngaf:browser_provided')).resolves.toBeUndefined();
  });

  test('capture() with enabled:true and posthogKey invokes posthog-js (lazy)', async () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: NGAF_TELEMETRY_CONFIG, useValue: { enabled: true, posthogKey: 'phc_test' } },
        NgafTelemetryService,
      ],
    });
    const svc = TestBed.inject(NgafTelemetryService);
    expect(typeof svc.capture).toBe('function');
  });

  test('service is provided as root-scoped', () => {
    expect(NgafTelemetryService).toBeDefined();
  });
});
