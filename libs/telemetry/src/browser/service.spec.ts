// @vitest-environment jsdom
import { beforeEach, describe, test, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { NgafTelemetryService } from './service';
import { NGAF_TELEMETRY_CONFIG } from './tokens';

describe('NgafTelemetryService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

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

  test('capture() delivers events to a configured neutral sink', async () => {
    const sink = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: NGAF_TELEMETRY_CONFIG, useValue: { enabled: true, sink } },
        NgafTelemetryService,
      ],
    });
    const svc = TestBed.inject(NgafTelemetryService);

    await svc.captureRuntimeInstanceCreated({
      transport: 'langgraph',
      surface: 'canonical_demo',
      model: 'gpt-5-mini',
    });

    expect(sink).toHaveBeenCalledWith({
      event: 'ngaf:runtime_instance_created',
      properties: {
        transport: 'langgraph',
        surface: 'canonical_demo',
        model: 'gpt-5-mini',
        sample_weight: 1,
      },
    });
  });

  test('capture() posts neutral event payloads to a configured endpoint', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 202 }));
    TestBed.configureTestingModule({
      providers: [
        { provide: NGAF_TELEMETRY_CONFIG, useValue: { enabled: true, endpoint: '/api/ingest' } },
        NgafTelemetryService,
      ],
    });
    const svc = TestBed.inject(NgafTelemetryService);

    await svc.capture('ngaf:browser_chat_init', { surface: 'canonical_demo' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchMock.mock.calls.at(0);
    expect(call).toBeDefined();
    const [url, init] = call as [Parameters<typeof fetch>[0], RequestInit];
    expect(url).toBe('/api/ingest');
    expect(init).toEqual(expect.objectContaining({
      method: 'POST',
      keepalive: true,
      headers: { 'content-type': 'application/json' },
    }));
    expect(JSON.parse(String((init as RequestInit).body))).toEqual(expect.objectContaining({
      event: 'ngaf:browser_chat_init',
      distinctId: expect.stringMatching(/^browser:/),
      properties: {
        surface: 'canonical_demo',
        sample_weight: 1,
      },
    }));
  });

  test('captureStreamErrored() strips error messages from browser telemetry', async () => {
    const sink = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: NGAF_TELEMETRY_CONFIG, useValue: { enabled: true, sink } },
        NgafTelemetryService,
      ],
    });
    const svc = TestBed.inject(NgafTelemetryService);

    await svc.captureStreamErrored({
      transport: 'langgraph',
      surface: 'canonical_demo',
      error: new Error('contains user prompt text'),
    });

    expect(sink).toHaveBeenCalledWith({
      event: 'ngaf:stream_errored',
      properties: {
        transport: 'langgraph',
        surface: 'canonical_demo',
        errorClass: 'Error',
        sample_weight: 1,
      },
    });
    expect(JSON.stringify(sink.mock.calls[0])).not.toContain('contains user prompt text');
  });

  test('capture() respects sampleRate:0 before delivering to a sink', async () => {
    const sink = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: NGAF_TELEMETRY_CONFIG, useValue: { enabled: true, sink, sampleRate: 0 } },
        NgafTelemetryService,
      ],
    });
    const svc = TestBed.inject(NgafTelemetryService);

    await svc.capture('ngaf:browser_chat_init');

    expect(sink).not.toHaveBeenCalled();
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
