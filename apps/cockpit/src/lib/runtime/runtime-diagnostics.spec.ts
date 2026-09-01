import { RUNTIME_BRIDGE_VERSION } from '@threadplane/cockpit-runtime-bridge';
import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  buildRuntimeDiagnostics,
  copyRuntimeDiagnostics,
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
      'https://runtime.test/path?cockpit_did=did&cockpit_phk=key&cockpit_host=host&session=session&nonce=nonce#prompt',
    ),
    'streaming',
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
      runtime: 'https://runtime.test/path',
      state: 'ready',
      checkedAt: 1_250,
      lastReadyAt: 1_250,
      protocolVersion: RUNTIME_BRIDGE_VERSION,
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
      events.slice(0, 20).map(({ at }) => at),
    );
  });

  test('strips target secrets, active nonce, error details, and extra fields', () => {
    const checking = runtimeReducer(
      createRuntimeSnapshot(
        parseRuntimeTarget(
          'https://runtime.test/path?cockpit_did=did&cockpit_phk=key&cockpit_host=host&session=session&nonce=nonce#document',
        ),
        'streaming',
      ),
      {
        type: 'check_started',
        intent: 'recheck',
        nonce: 'active-secret-nonce',
        startedAt: 1_000,
      },
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
      buildRuntimeDiagnostics(checking, [sourceEvent]),
    );
    expect(serialized).not.toMatch(
      /cockpit_did|cockpit_phk|cockpit_host|session=|nonce=|active-secret|secret|stack|prompt|document|chat|extra/i,
    );
    expect(buildRuntimeDiagnostics(checking, [sourceEvent]).runtime).toBe(
      'https://runtime.test/path',
    );
  });

  test('uses null for invalid configuration without exposing the rejected value', () => {
    const rejected = 'javascript:raw-secret';
    const snapshot = createRuntimeSnapshot(
      parseRuntimeTarget(rejected),
      'streaming',
    );
    const serialized = JSON.stringify(buildRuntimeDiagnostics(snapshot, []));

    expect(buildRuntimeDiagnostics(snapshot, []).runtime).toBeNull();
    expect(serialized).not.toContain(rejected);
    expect(serialized).not.toContain('raw-secret');
  });

  test('does not expose the allowlisted bridge code as an extra diagnostic field', () => {
    const checking = runtimeReducer(
      createRuntimeSnapshot(
        parseRuntimeTarget('https://runtime.test'),
        'streaming',
      ),
      {
        type: 'check_started',
        intent: 'recheck',
        nonce: 'nonce-1',
        startedAt: 1_000,
      },
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
  test('serializes the exact payload with two-space indentation', async () => {
    const snapshot = createReadySnapshot();
    const events = [activity(0)];
    const writeText = vi.fn().mockResolvedValue(undefined);

    await expect(
      copyRuntimeDiagnostics(snapshot, events, writeText),
    ).resolves.toBe('succeeded');
    expect(writeText).toHaveBeenCalledWith(
      JSON.stringify(buildRuntimeDiagnostics(snapshot, events), null, 2),
    );
  });

  test('does not report success until the clipboard write resolves', async () => {
    let resolveWrite: (() => void) | undefined;
    const writeText = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveWrite = resolve;
        }),
    );
    let result: string | undefined;
    const pending = copyRuntimeDiagnostics(
      createReadySnapshot(),
      [],
      writeText,
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
  ])('returns failed when an injected clipboard writer fails', async (writer) => {
    await expect(
      copyRuntimeDiagnostics(createReadySnapshot(), [], writer),
    ).resolves.toBe('failed');
  });

  test('returns failed when the default clipboard is missing', async () => {
    vi.stubGlobal('navigator', {});
    await expect(
      copyRuntimeDiagnostics(createReadySnapshot(), []),
    ).resolves.toBe('failed');
  });
});
