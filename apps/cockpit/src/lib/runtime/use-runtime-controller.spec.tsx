// SPDX-License-Identifier: MIT
/** @vitest-environment jsdom */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from 'vitest';
import { RUNTIME_BRIDGE_VERSION } from '@threadplane/cockpit-runtime-bridge';
import type { RuntimeActivityInput } from './session-activity';
import type { RuntimeTerminalTransition } from './runtime-state';
import {
  useRuntimeController,
  type RuntimeController,
  type UseRuntimeControllerOptions,
} from './use-runtime-controller';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const firstNonce = '00000000-0000-4000-8000-000000000001';
const firstEventId = '00000000-0000-4000-8000-000000000002';
const secondNonce = '00000000-0000-4000-8000-000000000003';
const secondEventId = '00000000-0000-4000-8000-000000000004';

interface HarnessProps extends UseRuntimeControllerOptions {
  mountFrame?: boolean;
}

let controller: RuntimeController;

function Harness({ mountFrame = true, ...options }: HarnessProps) {
  controller = useRuntimeController(options);
  return mountFrame ? <iframe ref={controller.frameRef} /> : null;
}

function runtimeReady(nonce: string) {
  return {
    type: 'tplane:runtime-ready',
    version: RUNTIME_BRIDGE_VERSION,
    nonce,
  } as const;
}

function runtimeError(nonce: string) {
  return {
    type: 'tplane:runtime-error',
    version: RUNTIME_BRIDGE_VERSION,
    nonce,
    code: 'bootstrap_failed',
  } as const;
}

function emitMessage(
  data: unknown,
  origin: string,
  source: MessageEventSource | null,
) {
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { data, origin, source }));
  });
}

describe('useRuntimeController', () => {
  let container: HTMLDivElement;
  let root: Root;
  let onActivity: Mock<(event: RuntimeActivityInput) => void>;
  let onTerminalTransition: Mock<
    (event: RuntimeTerminalTransition) => void
  >;
  let randomUUID: Mock<() => `${string}-${string}-${string}-${string}-${string}`>;

  const render = (
    runtimeUrl: string | null,
    capability = 'streaming',
    mountFrame = true,
  ) => {
    act(() => {
      root.render(
        <Harness
          runtimeUrl={runtimeUrl}
          capability={capability}
          onActivity={onActivity}
          onTerminalTransition={onTerminalTransition}
          mountFrame={mountFrame}
        />,
      );
    });
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-31T17:00:00.000Z'));
    randomUUID = vi
      .spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValue(firstNonce);
    onActivity = vi.fn();
    onTerminalTransition = vi.fn();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('omits frame commands for missing and invalid targets', () => {
    const open = vi.spyOn(window, 'open');

    render(null);
    expect(controller.snapshot.phase).toBe('not_configured');
    expect(controller.validatedRuntimeUrl).toBeNull();
    act(() => {
      controller.onFrameLoad();
      controller.recheck();
      controller.reload();
    });
    expect(controller.open()).toBe('failed');

    render('javascript:alert(1)');
    expect(controller.snapshot.phase).toBe('invalid_configuration');
    expect(controller.validatedRuntimeUrl).toBeNull();
    act(() => {
      controller.onFrameLoad();
      controller.recheck();
      controller.reload();
    });
    expect(controller.open()).toBe('failed');

    expect(randomUUID).toHaveBeenCalledTimes(1);
    expect(open).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    expect(onActivity).toHaveBeenCalledTimes(1);
    expect(onActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'configuration_invalid',
        capability: 'streaming',
      }),
    );
    expect(onTerminalTransition).toHaveBeenCalledTimes(1);
    expect(onTerminalTransition).toHaveBeenCalledWith({
      capability: 'streaming',
      fromState: 'not_configured',
      toState: 'invalid_configuration',
      reasonCode: 'invalid_runtime_url',
    });
  });

  it('starts configured targets in connecting without doing hydration-placeholder work', () => {
    render('https://runtime.test/path?secret=x#hash');

    expect(controller.snapshot).toMatchObject({
      phase: 'connecting',
      activeNonce: null,
      frameGeneration: 0,
    });
    expect(controller.validatedRuntimeUrl).toBe(
      'https://runtime.test/path',
    );
    expect(randomUUID).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    expect(onActivity).not.toHaveBeenCalled();
    expect(onTerminalTransition).not.toHaveBeenCalled();
  });

  it('posts one exact-origin v1 check on frame load without treating load as ready', () => {
    randomUUID
      .mockReturnValueOnce(firstNonce)
      .mockReturnValueOnce(firstEventId);
    render('https://runtime.test/path?secret=x#hash');
    const frameWindow = controller.frameRef.current?.contentWindow;
    expect(frameWindow).not.toBeNull();
    const postMessage = vi.spyOn(frameWindow!, 'postMessage');

    act(() => controller.onFrameLoad());

    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledWith(
      {
        type: 'tplane:runtime-check',
        version: RUNTIME_BRIDGE_VERSION,
        nonce: firstNonce,
        capability: 'streaming',
      },
      'https://runtime.test',
    );
    expect(postMessage).not.toHaveBeenCalledWith(expect.anything(), '*');
    expect(controller.snapshot).toMatchObject({
      phase: 'connecting',
      activeNonce: firstNonce,
      checkStartedAt: Date.parse('2026-08-31T17:00:00.000Z'),
    });
    expect(vi.getTimerCount()).toBe(1);
    expect(onActivity).toHaveBeenCalledTimes(1);
    expect(onActivity).toHaveBeenCalledWith({
      id: firstEventId,
      at: '2026-08-31T17:00:00.000Z',
      kind: 'runtime_check_requested',
      capability: 'streaming',
    });
    expect(onTerminalTransition).not.toHaveBeenCalled();
  });

  it('accepts ready only from the mounted frame, exact origin, valid shape, and current nonce', () => {
    randomUUID
      .mockReturnValueOnce(firstNonce)
      .mockReturnValueOnce(firstEventId)
      .mockReturnValueOnce(secondEventId);
    render('https://runtime.test/path');
    const frameWindow = controller.frameRef.current!.contentWindow!;
    act(() => controller.onFrameLoad());

    emitMessage(runtimeReady(firstNonce), 'https://runtime.test', window);
    emitMessage(runtimeReady(firstNonce), 'https://sibling.test', frameWindow);
    emitMessage(
      { ...runtimeReady(firstNonce), version: 2 },
      'https://runtime.test',
      frameWindow,
    );
    emitMessage(
      { ...runtimeReady(firstNonce), extra: true },
      'https://runtime.test',
      frameWindow,
    );
    emitMessage(runtimeReady('stale'), 'https://runtime.test', frameWindow);
    expect(controller.snapshot.phase).toBe('connecting');

    vi.setSystemTime(new Date('2026-08-31T17:00:00.250Z'));
    emitMessage(runtimeReady(firstNonce), 'https://runtime.test', frameWindow);

    expect(controller.snapshot).toMatchObject({
      phase: 'ready',
      activeNonce: null,
      checkedAt: Date.parse('2026-08-31T17:00:00.250Z'),
      lastReadyAt: Date.parse('2026-08-31T17:00:00.250Z'),
    });
    expect(vi.getTimerCount()).toBe(0);
    expect(onTerminalTransition).toHaveBeenCalledTimes(1);
    expect(onTerminalTransition).toHaveBeenCalledWith({
      capability: 'streaming',
      fromState: 'connecting',
      toState: 'ready',
      elapsedMs: 250,
    });
    expect(onActivity.mock.calls.map(([event]) => event.kind)).toEqual([
      'runtime_check_requested',
      'runtime_ready',
    ]);
  });

  it('accepts only the allowlisted current runtime error response', () => {
    randomUUID
      .mockReturnValueOnce(firstNonce)
      .mockReturnValueOnce(firstEventId)
      .mockReturnValueOnce(secondEventId);
    render('https://runtime.test/path');
    const frameWindow = controller.frameRef.current!.contentWindow!;
    act(() => controller.onFrameLoad());

    emitMessage(
      { ...runtimeError(firstNonce), code: 'raw_failure' },
      'https://runtime.test',
      frameWindow,
    );
    expect(controller.snapshot.phase).toBe('connecting');

    vi.setSystemTime(new Date('2026-08-31T17:00:00.300Z'));
    emitMessage(runtimeError(firstNonce), 'https://runtime.test', frameWindow);

    expect(controller.snapshot).toMatchObject({
      phase: 'error',
      errorCode: 'bootstrap_failed',
      activeNonce: null,
    });
    expect(onTerminalTransition).toHaveBeenCalledWith({
      capability: 'streaming',
      fromState: 'connecting',
      toState: 'error',
      elapsedMs: 300,
      reasonCode: 'bootstrap_failed',
    });
    expect(onActivity.mock.calls.map(([event]) => event.kind)).toEqual([
      'runtime_check_requested',
      'runtime_initialization_error',
    ]);
  });

  it('becomes unresponsive after five seconds', () => {
    randomUUID
      .mockReturnValueOnce(firstNonce)
      .mockReturnValueOnce(firstEventId)
      .mockReturnValueOnce(secondEventId);
    render('https://runtime.test/path');
    act(() => controller.onFrameLoad());

    act(() => vi.advanceTimersByTime(4_999));
    expect(controller.snapshot.phase).toBe('connecting');
    act(() => vi.advanceTimersByTime(1));

    expect(controller.snapshot).toMatchObject({
      phase: 'unresponsive',
      activeNonce: null,
      checkedAt: Date.parse('2026-08-31T17:00:05.000Z'),
    });
    expect(vi.getTimerCount()).toBe(0);
    expect(onTerminalTransition).toHaveBeenCalledWith({
      capability: 'streaming',
      fromState: 'connecting',
      toState: 'unresponsive',
      elapsedMs: 5_000,
    });
    expect(onActivity.mock.calls.map(([event]) => event.kind)).toEqual([
      'runtime_check_requested',
      'runtime_unresponsive',
    ]);
  });

  it('recheck cancels the prior timer and nonce before starting one new check', () => {
    randomUUID
      .mockReturnValueOnce(firstNonce)
      .mockReturnValueOnce(firstEventId)
      .mockReturnValueOnce(secondNonce)
      .mockReturnValueOnce(secondEventId);
    render('https://runtime.test/path');
    const frameWindow = controller.frameRef.current!.contentWindow!;
    const postMessage = vi.spyOn(frameWindow, 'postMessage');
    act(() => controller.onFrameLoad());
    act(() => controller.recheck());

    expect(controller.snapshot).toMatchObject({
      phase: 'checking',
      activeNonce: secondNonce,
    });
    expect(vi.getTimerCount()).toBe(1);
    expect(postMessage).toHaveBeenCalledTimes(2);

    emitMessage(runtimeReady(firstNonce), 'https://runtime.test', frameWindow);
    expect(controller.snapshot.phase).toBe('checking');
    emitMessage(runtimeReady(secondNonce), 'https://runtime.test', frameWindow);
    expect(controller.snapshot.phase).toBe('ready');
  });

  it('reload cancels active work, increments only frame generation, and checks the new load while reloading', () => {
    randomUUID
      .mockReturnValueOnce(firstNonce)
      .mockReturnValueOnce(firstEventId)
      .mockReturnValueOnce(secondEventId)
      .mockReturnValueOnce(secondNonce)
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000005');
    render('https://runtime.test/path');
    act(() => controller.onFrameLoad());
    const routeGeneration = controller.snapshot.routeGeneration;

    act(() => controller.reload());

    expect(controller.snapshot).toMatchObject({
      phase: 'reloading',
      activeNonce: null,
      frameGeneration: 1,
      routeGeneration,
    });
    expect(vi.getTimerCount()).toBe(0);
    expect(onActivity.mock.calls.map(([event]) => event.kind)).toEqual([
      'runtime_check_requested',
      'runtime_reload_requested',
    ]);

    act(() => controller.onFrameLoad());
    expect(controller.snapshot).toMatchObject({
      phase: 'reloading',
      activeNonce: secondNonce,
      frameGeneration: 1,
      routeGeneration,
    });
    expect(vi.getTimerCount()).toBe(1);
  });

  it('preserves recovery origin through recheck and reports one recovered transition', () => {
    randomUUID
      .mockReturnValueOnce(firstNonce)
      .mockReturnValueOnce(firstEventId)
      .mockReturnValueOnce(secondEventId)
      .mockReturnValueOnce(secondNonce)
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000005')
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000006');
    render('https://runtime.test/path');
    const frameWindow = controller.frameRef.current!.contentWindow!;
    act(() => controller.onFrameLoad());
    act(() => vi.advanceTimersByTime(5_000));
    act(() => controller.recheck());
    vi.setSystemTime(new Date('2026-08-31T17:00:05.100Z'));
    emitMessage(runtimeReady(secondNonce), 'https://runtime.test', frameWindow);

    expect(onTerminalTransition).toHaveBeenCalledTimes(2);
    expect(onTerminalTransition).toHaveBeenLastCalledWith({
      capability: 'streaming',
      fromState: 'unresponsive',
      toState: 'ready',
      elapsedMs: 100,
      transition: 'recovered',
    });
    expect(onActivity.mock.calls.map(([event]) => event.kind)).toEqual([
      'runtime_check_requested',
      'runtime_unresponsive',
      'runtime_check_requested',
      'runtime_recovered',
    ]);
  });

  it('invalidates the old route context before accepting messages or timers', () => {
    randomUUID
      .mockReturnValueOnce(firstNonce)
      .mockReturnValueOnce(firstEventId)
      .mockReturnValueOnce(secondNonce)
      .mockReturnValueOnce(secondEventId);
    render('https://runtime.test/old', 'streaming');
    const frameWindow = controller.frameRef.current!.contentWindow!;
    act(() => controller.onFrameLoad());

    render('https://next.runtime.test/new', 'persistence');

    expect(controller.snapshot).toMatchObject({
      phase: 'connecting',
      capability: 'persistence',
      activeNonce: null,
      routeGeneration: 1,
    });
    expect(controller.validatedRuntimeUrl).toBe(
      'https://next.runtime.test/new',
    );
    expect(vi.getTimerCount()).toBe(0);
    emitMessage(runtimeReady(firstNonce), 'https://runtime.test', frameWindow);
    expect(controller.snapshot.phase).toBe('connecting');

    act(() => controller.onFrameLoad());
    expect(controller.snapshot.activeNonce).toBe(secondNonce);
    emitMessage(
      runtimeReady(secondNonce),
      'https://runtime.test',
      frameWindow,
    );
    expect(controller.snapshot.phase).toBe('connecting');
    emitMessage(
      runtimeReady(secondNonce),
      'https://next.runtime.test',
      frameWindow,
    );
    expect(controller.snapshot.phase).toBe('ready');
  });

  it('installs one message listener and invalidates work on unmount', () => {
    const addEventListener = vi.spyOn(window, 'addEventListener');
    const removeEventListener = vi.spyOn(window, 'removeEventListener');
    render('https://runtime.test/path');
    act(() => controller.onFrameLoad());

    expect(
      addEventListener.mock.calls.filter(([type]) => type === 'message'),
    ).toHaveLength(1);
    act(() => root.unmount());

    expect(vi.getTimerCount()).toBe(0);
    expect(
      removeEventListener.mock.calls.filter(([type]) => type === 'message'),
    ).toHaveLength(1);
  });

  it('opens only the original configured URL and reports popup outcomes', () => {
    randomUUID
      .mockReturnValueOnce(firstEventId)
      .mockReturnValueOnce(secondEventId)
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000005');
    const configuredUrl =
      'https://runtime.test/path?existing=private#original-fragment';
    render(configuredUrl);
    const open = vi
      .spyOn(window, 'open')
      .mockReturnValueOnce(window)
      .mockReturnValueOnce(null)
      .mockImplementationOnce(() => {
        throw new Error('blocked');
      });

    expect(controller.open()).toBe('requested');
    expect(controller.open()).toBe('failed');
    expect(controller.open()).toBe('failed');

    expect(open).toHaveBeenNthCalledWith(
      1,
      configuredUrl,
      '_blank',
      'noopener,noreferrer',
    );
    expect(onActivity.mock.calls.map(([event]) => event.kind)).toEqual([
      'runtime_open_requested',
      'runtime_open_requested',
      'runtime_open_requested',
    ]);
    expect(JSON.stringify(onActivity.mock.calls)).not.toContain(configuredUrl);
  });

  it.each(['missing frame window', 'postMessage failure'])(
    'settles safely without a pending check after %s',
    (failure) => {
      randomUUID
        .mockReturnValueOnce(firstNonce)
        .mockReturnValueOnce(firstEventId)
        .mockReturnValueOnce(secondEventId);
      render('https://runtime.test/path', 'streaming', failure !== 'missing frame window');
      if (failure === 'postMessage failure') {
        vi.spyOn(
          controller.frameRef.current!.contentWindow!,
          'postMessage',
        ).mockImplementation(() => {
          throw new Error('cross-origin failure');
        });
      }

      act(() => controller.onFrameLoad());

      expect(controller.snapshot).toMatchObject({
        phase: 'unresponsive',
        activeNonce: null,
      });
      expect(vi.getTimerCount()).toBe(0);
      expect(onActivity.mock.calls.map(([event]) => event.kind)).toEqual([
        'runtime_check_requested',
        'runtime_unresponsive',
      ]);
    },
  );
});
