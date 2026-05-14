// @vitest-environment jsdom
/**
 * PERMANENT CONTRACT TEST.
 *
 * The trust contract at libs/telemetry/README.md promises that
 * @ngaf/telemetry/browser fires zero network calls and triggers zero
 * imports of posthog-js when the consumer does not call
 * provideNgafTelemetry() or calls it with enabled:false.
 *
 * If this test ever fails, the trust contract has been violated.
 * Do not "fix" the test — fix the offending import or call site.
 */
import { describe, test, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideNgafTelemetry } from './provide';
import { NgafTelemetryService } from './service';

vi.mock('posthog-js', () => {
  throw new Error('posthog-js MUST NOT be imported when telemetry is not enabled');
});

describe('browser silence (permanent contract)', () => {
  test('no posthog-js import when provideNgafTelemetry is never called', async () => {
    TestBed.configureTestingModule({ providers: [] });
    expect(NgafTelemetryService).toBeDefined();
  });

  test('no posthog-js import when provideNgafTelemetry({ enabled: false })', async () => {
    TestBed.configureTestingModule({
      providers: [provideNgafTelemetry({ enabled: false })],
    });
    const svc = TestBed.inject(NgafTelemetryService);
    await svc.capture('ngaf:browser_provided');
    expect(svc).toBeInstanceOf(NgafTelemetryService);
  });
});
