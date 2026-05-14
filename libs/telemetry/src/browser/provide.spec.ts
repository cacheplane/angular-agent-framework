// @vitest-environment jsdom
import { describe, test, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideNgafTelemetry } from './provide';
import { NgafTelemetryService } from './service';
import { NGAF_TELEMETRY_CONFIG } from './tokens';

describe('provideNgafTelemetry', () => {
  test('returns EnvironmentProviders that bind config + service', () => {
    TestBed.configureTestingModule({
      providers: [provideNgafTelemetry({ enabled: false })],
    });
    expect(TestBed.inject(NGAF_TELEMETRY_CONFIG)).toEqual({ enabled: false });
    expect(TestBed.inject(NgafTelemetryService)).toBeInstanceOf(NgafTelemetryService);
  });

  test('config defaults: sampleRate defaults to 1.0 when omitted', () => {
    TestBed.configureTestingModule({
      providers: [provideNgafTelemetry({ enabled: true, posthogKey: 'phc_x' })],
    });
    const cfg = TestBed.inject(NGAF_TELEMETRY_CONFIG);
    expect(cfg?.sampleRate ?? 1.0).toBe(1.0);
  });

  test('posthogHost passes through', () => {
    TestBed.configureTestingModule({
      providers: [provideNgafTelemetry({ enabled: true, posthogKey: 'x', posthogHost: 'https://eu.i.posthog.com' })],
    });
    expect(TestBed.inject(NGAF_TELEMETRY_CONFIG)?.posthogHost).toBe('https://eu.i.posthog.com');
  });

  test('enabled:true without posthogKey still resolves (service no-ops at call time)', () => {
    TestBed.configureTestingModule({
      providers: [provideNgafTelemetry({ enabled: true })],
    });
    expect(TestBed.inject(NgafTelemetryService)).toBeInstanceOf(NgafTelemetryService);
  });
});
