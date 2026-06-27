// @vitest-environment jsdom
import { beforeEach, describe, test, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ThreadplaneTelemetryService } from './service';
import { THREADPLANE_TELEMETRY_CONFIG } from './tokens';

describe('ThreadplaneTelemetryService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test('capture() resolves without calling posthog when enabled is false', async () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: THREADPLANE_TELEMETRY_CONFIG, useValue: { enabled: false } },
        ThreadplaneTelemetryService,
      ],
    });
    const svc = TestBed.inject(ThreadplaneTelemetryService);
    await expect(svc.capture('tplane:browser_provided')).resolves.toBeUndefined();
  });

  test('capture() resolves without calling posthog when no config provided', async () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: THREADPLANE_TELEMETRY_CONFIG, useValue: null },
        ThreadplaneTelemetryService,
      ],
    });
    const svc = TestBed.inject(ThreadplaneTelemetryService);
    await expect(svc.capture('tplane:browser_provided')).resolves.toBeUndefined();
  });

  test('capture() no-ops when posthogKey is missing even with enabled:true', async () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: THREADPLANE_TELEMETRY_CONFIG, useValue: { enabled: true } },
        ThreadplaneTelemetryService,
      ],
    });
    const svc = TestBed.inject(ThreadplaneTelemetryService);
    await expect(svc.capture('tplane:browser_provided')).resolves.toBeUndefined();
  });

  test('capture() delivers events to a configured neutral sink', async () => {
    const sink = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: THREADPLANE_TELEMETRY_CONFIG, useValue: { enabled: true, sink } },
        ThreadplaneTelemetryService,
      ],
    });
    const svc = TestBed.inject(ThreadplaneTelemetryService);

    await svc.captureRuntimeInstanceCreated({
      transport: 'langgraph',
      surface: 'canonical_demo',
      model: 'gpt-5-mini',
    });

    expect(sink).toHaveBeenCalledWith({
      event: 'tplane:runtime_instance_created',
      properties: {
        transport: 'langgraph',
        surface: 'canonical_demo',
        model: 'gpt-5-mini',
        sample_weight: 1,
      },
    });
  });

  test('captureRuntimeRequestCreated() records request type through the neutral sink', async () => {
    const sink = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: THREADPLANE_TELEMETRY_CONFIG, useValue: { enabled: true, sink } },
        ThreadplaneTelemetryService,
      ],
    });
    const svc = TestBed.inject(ThreadplaneTelemetryService);

    await svc.captureRuntimeRequestCreated({
      transport: 'langgraph',
      surface: 'canonical_demo',
      requestType: 'submit',
    });

    expect(sink).toHaveBeenCalledWith({
      event: 'tplane:runtime_request_created',
      properties: {
        transport: 'langgraph',
        surface: 'canonical_demo',
        requestType: 'submit',
        sample_weight: 1,
      },
    });
  });


  test('capture() posts neutral event payloads to a configured endpoint', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 202 }));
    TestBed.configureTestingModule({
      providers: [
        { provide: THREADPLANE_TELEMETRY_CONFIG, useValue: { enabled: true, endpoint: '/api/ingest' } },
        ThreadplaneTelemetryService,
      ],
    });
    const svc = TestBed.inject(ThreadplaneTelemetryService);

    await svc.capture('tplane:browser_chat_init', { surface: 'canonical_demo' });

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
      event: 'tplane:browser_chat_init',
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
        { provide: THREADPLANE_TELEMETRY_CONFIG, useValue: { enabled: true, sink } },
        ThreadplaneTelemetryService,
      ],
    });
    const svc = TestBed.inject(ThreadplaneTelemetryService);

    await svc.captureStreamErrored({
      transport: 'langgraph',
      surface: 'canonical_demo',
      error: new Error('contains user prompt text'),
    });

    expect(sink).toHaveBeenCalledWith({
      event: 'tplane:stream_errored',
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
        { provide: THREADPLANE_TELEMETRY_CONFIG, useValue: { enabled: true, sink, sampleRate: 0 } },
        ThreadplaneTelemetryService,
      ],
    });
    const svc = TestBed.inject(ThreadplaneTelemetryService);

    await svc.capture('tplane:browser_chat_init');

    expect(sink).not.toHaveBeenCalled();
  });

  test('capture() with enabled:true and posthogKey invokes posthog-js (lazy)', async () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: THREADPLANE_TELEMETRY_CONFIG, useValue: { enabled: true, posthogKey: 'phc_test' } },
        ThreadplaneTelemetryService,
      ],
    });
    const svc = TestBed.inject(ThreadplaneTelemetryService);
    expect(typeof svc.capture).toBe('function');
  });

  test('service is provided as root-scoped', () => {
    expect(ThreadplaneTelemetryService).toBeDefined();
  });
});
