import { RUNTIME_BRIDGE_VERSION } from '@threadplane/cockpit-runtime-bridge';
import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  buildRuntimeDiagnostics,
  copyRuntimeDiagnostics,
  type RuntimeDiagnosticsTargetContext,
} from './runtime-diagnostics';
import {
  createRuntimeSnapshot,
  parseRuntimeTarget,
  runtimeReducer,
  type RuntimeSnapshot,
} from './runtime-state';
import {
  createSessionActivityEvent,
  type SessionActivityEvent,
} from './session-activity';

function createReadySnapshot(): RuntimeSnapshot {
  const initial = createRuntimeSnapshot(
    parseRuntimeTarget(
      'https://runtime.test/path?cockpit_did=did&cockpit_phk=key&cockpit_host=host&session=session&nonce=nonce#prompt'
    ),
    'streaming'
  );
  const checking = runtimeReducer(initial, {
    type: 'check_started',
    intent: 'recheck',
    nonce: 'active-secret-nonce',
    startedAt: 1_000,
  });
  return runtimeReducer(checking, {
    type: 'ready',
    nonce: 'active-secret-nonce',
    at: 1_250,
  });
}

function activity(index: number): SessionActivityEvent {
  return createSessionActivityEvent({
    id: `event-${index}`,
    at: `2026-08-31T12:${String(index).padStart(2, '0')}:00.000Z`,
    capability: index % 2 === 0 ? 'streaming' : 'persistence',
    kind: 'runtime_ready',
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('buildRuntimeDiagnostics', () => {
  test('returns the exact safe payload shape', () => {
    const snapshot = createReadySnapshot();
    const event = activity(0);

    expect(buildRuntimeDiagnostics(snapshot, [event])).toEqual({
      capability: 'streaming',
      adapter: 'none',
      targetKind: 'none',
      state: 'ready',
      checkedAt: 1_250,
      lastReadyAt: 1_250,
      protocolVersion: RUNTIME_BRIDGE_VERSION,
      configurationGeneration: 0,
      reasonCode: null,
      recentEvents: [
        {
          at: event.at,
          kind: 'runtime_ready',
          severity: 'success',
          capability: 'streaming',
          summary: 'Runtime ready',
        },
      ],
    });
  });

  test('projects at most the 20 newest events in existing order', () => {
    const events = Array.from({ length: 25 }, (_, index) => activity(index));
    const payload = buildRuntimeDiagnostics(createReadySnapshot(), events);

    expect(payload.recentEvents).toHaveLength(20);
    expect(payload.recentEvents.map(({ at }) => at)).toEqual(
      events.slice(0, 20).map(({ at }) => at)
    );
  });

  test('strips target secrets, active nonce, error details, and extra fields', () => {
    const checking = runtimeReducer(
      createRuntimeSnapshot(
        parseRuntimeTarget(
          'https://runtime.test/path?cockpit_did=did&cockpit_phk=key&cockpit_host=host&session=session&nonce=nonce#document'
        ),
        'streaming'
      ),
      {
        type: 'check_started',
        intent: 'recheck',
        nonce: 'active-secret-nonce',
        startedAt: 1_000,
      }
    ) as RuntimeSnapshot & {
      stack: string;
      prompt: string;
      document: string;
      chat: string;
    };
    checking.stack = 'secret stack';
    checking.prompt = 'secret prompt';
    checking.document = 'secret document';
    checking.chat = 'secret chat';
    const sourceEvent = {
      ...activity(0),
      extra: 'secret extra field',
    };

    const serialized = JSON.stringify(
      buildRuntimeDiagnostics(checking, [sourceEvent])
    );
    expect(serialized).not.toMatch(
      /cockpit_did|cockpit_phk|cockpit_host|session=|nonce=|active-secret|secret|stack|prompt|document|chat|extra/i
    );
    expect(buildRuntimeDiagnostics(checking, [sourceEvent])).not.toHaveProperty(
      'runtime'
    );
  });

  test('uses null for invalid configuration without exposing the rejected value', () => {
    const rejected = 'javascript:raw-secret';
    const snapshot = createRuntimeSnapshot(
      parseRuntimeTarget(rejected),
      'streaming'
    );
    const serialized = JSON.stringify(buildRuntimeDiagnostics(snapshot, []));

    expect(buildRuntimeDiagnostics(snapshot, [])).not.toHaveProperty('runtime');
    expect(buildRuntimeDiagnostics(snapshot, []).reasonCode).toBe(
      'invalid_runtime_url'
    );
    expect(serialized).not.toContain(rejected);
    expect(serialized).not.toContain('raw-secret');
  });

  test('projects an allowlisted reason code without exposing arbitrary details', () => {
    const checking = runtimeReducer(
      createRuntimeSnapshot(
        parseRuntimeTarget('https://runtime.test'),
        'streaming'
      ),
      {
        type: 'check_started',
        intent: 'recheck',
        nonce: 'nonce-1',
        startedAt: 1_000,
      }
    );
    const failed = runtimeReducer(checking, {
      type: 'bootstrap_failed',
      nonce: 'nonce-1',
      code: 'bootstrap_failed',
      at: 1_100,
    });
    const payload = buildRuntimeDiagnostics(failed, []);

    expect(payload.state).toBe('error');
    expect(payload).not.toHaveProperty('errorCode');
    expect(payload.reasonCode).toBe('bootstrap_failed');
  });

  test('includes only allowlisted custom-target metadata and never endpoint or key fields', () => {
    const payload = buildRuntimeDiagnostics(createReadySnapshot(), [], {
      adapter: 'langgraph',
      targetKind: 'langsmith',
      configurationGeneration: 4,
      reasonCode: 'unauthorized',
    });
    const serialized = JSON.stringify(payload);

    expect(payload).toMatchObject({
      adapter: 'langgraph',
      targetKind: 'langsmith',
      protocolVersion: RUNTIME_BRIDGE_VERSION,
      configurationGeneration: 4,
      state: 'ready',
      reasonCode: 'unauthorized',
    });
    expect(serialized).not.toMatch(
      /endpoint|apiUrl|apiKey|authorization|test-key-redact-me|https:\/\/api\.example\.test/i
    );
  });

  test('projects hostile runtime event context onto the six-field allowlist', () => {
    const hostileEvent = {
      ...activity(0),
      runtime: {
        adapter: 'langgraph',
        targetKind: 'langsmith',
        protocolVersion: 2,
        configurationGeneration: 7,
        phase: 'ready',
        reasonCode: null,
        endpoint: 'https://api.example.test/langgraph',
        apiKey: 'test-key-redact-me',
      },
    } as SessionActivityEvent;

    const payload = buildRuntimeDiagnostics(createReadySnapshot(), [
      hostileEvent,
    ]);

    expect(payload.recentEvents[0]?.runtime).toEqual({
      adapter: 'langgraph',
      targetKind: 'langsmith',
      protocolVersion: 2,
      configurationGeneration: 7,
      phase: 'ready',
      reasonCode: null,
    });
    expect(JSON.stringify(payload)).not.toMatch(
      /api\.example\.test|test-key-redact-me|endpoint|apiKey/i
    );
  });

  test('defaults hostile diagnostics context values without echoing them', () => {
    const hostileMarker = 'test-key-redact-me';
    const hostileEvent = {
      ...activity(0),
      runtime: {
        adapter: `unknown-${hostileMarker}`,
        targetKind: `unknown-${hostileMarker}`,
        protocolVersion: Number.POSITIVE_INFINITY,
        configurationGeneration: 1.5,
        phase: `unknown-${hostileMarker}`,
        reasonCode: `unknown-${hostileMarker}`,
      },
    } as unknown as SessionActivityEvent;
    const hostileTargetContext = {
      adapter: `unknown-${hostileMarker}`,
      targetKind: `unknown-${hostileMarker}`,
      configurationGeneration: -1,
      reasonCode: `unknown-${hostileMarker}`,
    } as unknown as RuntimeDiagnosticsTargetContext;

    const payload = buildRuntimeDiagnostics(
      createReadySnapshot(),
      [hostileEvent],
      hostileTargetContext
    );

    expect(payload).toMatchObject({
      adapter: 'none',
      targetKind: 'none',
      protocolVersion: RUNTIME_BRIDGE_VERSION,
      configurationGeneration: 0,
      state: 'ready',
      reasonCode: null,
    });
    expect(payload.recentEvents[0]?.runtime).toEqual({
      adapter: 'none',
      targetKind: 'none',
      protocolVersion: 0,
      configurationGeneration: 0,
      phase: 'not_configured',
      reasonCode: null,
    });
    expect(JSON.stringify(payload)).not.toContain(hostileMarker);
  });

  test('defaults throwing and revoked diagnostics contexts without throwing or echoing markers', () => {
    const hostileMarker = 'throwing-diagnostics-marker';
    const throwingContext = () =>
      Object.defineProperty({}, 'adapter', {
        enumerable: true,
        get() {
          throw new Error(hostileMarker);
        },
      });
    const revokedTarget = Proxy.revocable(
      {
        adapter: 'langgraph',
        targetKind: 'langsmith',
        configurationGeneration: 7,
        reasonCode: null,
      },
      {}
    );
    const revokedRuntime = Proxy.revocable(
      {
        adapter: 'langgraph',
        targetKind: 'langsmith',
        protocolVersion: 2,
        configurationGeneration: 7,
        phase: 'ready',
        reasonCode: null,
      },
      {}
    );
    revokedTarget.revoke();
    revokedRuntime.revoke();

    for (const [targetContext, runtime] of [
      [throwingContext(), throwingContext()],
      [revokedTarget.proxy, revokedRuntime.proxy],
    ] as const) {
      const hostileEvent = {
        ...activity(0),
        runtime,
      } as unknown as SessionActivityEvent;
      let payload: ReturnType<typeof buildRuntimeDiagnostics> | undefined;

      expect(() => {
        payload = buildRuntimeDiagnostics(
          createReadySnapshot(),
          [hostileEvent],
          targetContext as unknown as RuntimeDiagnosticsTargetContext
        );
      }).not.toThrow();
      expect(payload).toMatchObject({
        adapter: 'none',
        targetKind: 'none',
        protocolVersion: RUNTIME_BRIDGE_VERSION,
        configurationGeneration: 0,
        state: 'ready',
        reasonCode: null,
      });
      expect(payload?.recentEvents[0]?.runtime).toEqual({
        adapter: 'none',
        targetKind: 'none',
        protocolVersion: 0,
        configurationGeneration: 0,
        phase: 'not_configured',
        reasonCode: null,
      });
      expect(JSON.stringify(payload)).not.toContain(hostileMarker);
    }
  });

  test('freshly allocates the payload and projected event records', () => {
    const sourceEvent = activity(0);
    const sourceEvents = [sourceEvent];
    const first = buildRuntimeDiagnostics(createReadySnapshot(), sourceEvents);
    const second = buildRuntimeDiagnostics(createReadySnapshot(), sourceEvents);

    expect(first).not.toBe(second);
    expect(first.recentEvents).not.toBe(sourceEvents);
    expect(first.recentEvents[0]).not.toBe(sourceEvent);
    first.recentEvents[0]!.summary = 'mutated projection';
    expect(sourceEvent.summary).toBe('Runtime ready');
    expect(second.recentEvents[0]?.summary).toBe('Runtime ready');
  });
});

describe('copyRuntimeDiagnostics', () => {
  test('copies the sanitized active target context without endpoint or key fields', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    await expect(
      copyRuntimeDiagnostics(createReadySnapshot(), [], writeText, {
        adapter: 'langgraph',
        targetKind: 'langsmith',
        configurationGeneration: 9,
        reasonCode: 'unauthorized',
      } as never)
    ).resolves.toBe('succeeded');

    const serialized = writeText.mock.calls[0]?.[0] as string;
    expect(JSON.parse(serialized)).toMatchObject({
      adapter: 'langgraph',
      targetKind: 'langsmith',
      configurationGeneration: 9,
      reasonCode: 'unauthorized',
    });
    expect(serialized).not.toMatch(
      /endpoint|apiUrl|apiKey|authorization|test-key-redact-me/i
    );
  });

  test('serializes the exact payload with two-space indentation', async () => {
    const snapshot = createReadySnapshot();
    const events = [activity(0)];
    const writeText = vi.fn().mockResolvedValue(undefined);

    await expect(
      copyRuntimeDiagnostics(snapshot, events, writeText)
    ).resolves.toBe('succeeded');
    expect(writeText).toHaveBeenCalledWith(
      JSON.stringify(buildRuntimeDiagnostics(snapshot, events), null, 2)
    );
  });

  test('does not report success until the clipboard write resolves', async () => {
    let resolveWrite: (() => void) | undefined;
    const writeText = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveWrite = resolve;
        })
    );
    let result: string | undefined;
    const pending = copyRuntimeDiagnostics(
      createReadySnapshot(),
      [],
      writeText
    ).then((value) => {
      result = value;
    });

    await Promise.resolve();
    expect(result).toBeUndefined();
    resolveWrite?.();
    await pending;
    expect(result).toBe('succeeded');
  });

  test.each([
    vi.fn(() => {
      throw new Error('clipboard unavailable');
    }),
    vi.fn().mockRejectedValue(new Error('permission denied')),
  ])(
    'returns failed when an injected clipboard writer fails',
    async (writer) => {
      await expect(
        copyRuntimeDiagnostics(createReadySnapshot(), [], writer)
      ).resolves.toBe('failed');
    }
  );

  test('returns failed when the default clipboard is missing', async () => {
    vi.stubGlobal('navigator', {});
    await expect(
      copyRuntimeDiagnostics(createReadySnapshot(), [])
    ).resolves.toBe('failed');
  });
});
