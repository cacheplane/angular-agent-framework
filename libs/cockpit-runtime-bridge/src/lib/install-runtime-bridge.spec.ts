import { describe, expect, it, vi } from 'vitest';
import {
  installRuntimeBridge,
  type RuntimeBridgeEnvironment,
} from './install-runtime-bridge';

type MessageListener = (event: MessageEvent<unknown>) => void;
type UnsafeRuntimeBridge = { markError(code: unknown): void };

function createEnvironment(...arguments_: [referrer?: string | undefined]) {
  const referrer = arguments_.length === 0 ? 'https://cockpit.example/embed' : arguments_[0];
  let messageListener: MessageListener | undefined;
  const parentPostMessage = vi.fn();
  const parent = { postMessage: parentPostMessage } as unknown as Window;
  const runtimeWindow = {
    parent,
    addEventListener: vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
      if (type === 'message') {
        messageListener = listener as unknown as MessageListener;
      }
    }),
    removeEventListener: vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
      if (type === 'message' && messageListener === listener) {
        messageListener = undefined;
      }
    }),
  } as unknown as Window;
  const environment = {
    window: runtimeWindow,
    document: { referrer } as Document,
  } as RuntimeBridgeEnvironment;

  return {
    environment,
    parent,
    parentPostMessage,
    runtimeWindow,
    dispatchCheck(
      nonce: string,
      origin = 'https://cockpit.example',
      source: MessageEventSource | null = parent
    ) {
      messageListener?.({
        data: {
          type: 'tplane:runtime-check',
          version: 1,
          nonce,
          capability: 'chat',
        },
        origin,
        source,
      } as MessageEvent<unknown>);
    },
    dispatchMessage(data: unknown, origin = 'https://cockpit.example', source: MessageEventSource | null = parent) {
      messageListener?.({ data, origin, source } as MessageEvent<unknown>);
    },
  };
}

describe('installRuntimeBridge', () => {
  it('uses the current browser globals when no environment is provided', () => {
    const { environment, dispatchCheck, parentPostMessage } = createEnvironment();

    vi.stubGlobal('window', environment.window);
    vi.stubGlobal('document', environment.document);

    try {
      const bridge = installRuntimeBridge();

      dispatchCheck('nonce-1');
      bridge.markReady();

      expect(parentPostMessage).toHaveBeenCalledWith(
        { type: 'tplane:runtime-ready', version: 1, nonce: 'nonce-1' },
        'https://cockpit.example'
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('does not emit a ready reply when installed', () => {
    const { environment, parentPostMessage } = createEnvironment();

    installRuntimeBridge(environment);

    expect(parentPostMessage).not.toHaveBeenCalled();
  });

  it('ignores checks from a non-parent source', () => {
    const { environment, dispatchCheck, parentPostMessage } = createEnvironment();
    const bridge = installRuntimeBridge(environment);

    dispatchCheck('nonce-1', 'https://cockpit.example', {} as MessageEventSource);
    bridge.markReady();

    expect(parentPostMessage).not.toHaveBeenCalled();
  });

  it('ignores checks whose origin does not match the referrer origin', () => {
    const { environment, dispatchCheck, parentPostMessage } = createEnvironment();
    const bridge = installRuntimeBridge(environment);

    dispatchCheck('nonce-1', 'https://other.example');
    bridge.markReady();

    expect(parentPostMessage).not.toHaveBeenCalled();
  });

  it('derives the referrer origin once during installation', () => {
    const { environment, dispatchCheck, parentPostMessage } = createEnvironment();
    let referrerReads = 0;
    environment.document = {
      get referrer() {
        referrerReads += 1;

        if (referrerReads === 1) {
          return 'https://cockpit.example/embedded';
        }

        throw new Error('referrer should only be read during installation');
      },
    } as Document;

    const bridge = installRuntimeBridge(environment);

    expect(referrerReads).toBe(1);

    dispatchCheck('nonce-1');
    bridge.markReady();
    dispatchCheck('nonce-2');

    expect(referrerReads).toBe(1);
    expect(parentPostMessage).toHaveBeenNthCalledWith(
      1,
      { type: 'tplane:runtime-ready', version: 1, nonce: 'nonce-1' },
      'https://cockpit.example'
    );
    expect(parentPostMessage).toHaveBeenNthCalledWith(
      2,
      { type: 'tplane:runtime-ready', version: 1, nonce: 'nonce-2' },
      'https://cockpit.example'
    );
  });

  it.each([undefined, '', '/embedded', 'not a URL', 'ftp://cockpit.example', 'javascript:alert(1)'])(
    'disables replies for an unusable referrer: %j',
    (referrer) => {
      const { environment, dispatchCheck, parentPostMessage } = createEnvironment(referrer);
      const bridge = installRuntimeBridge(environment);

      dispatchCheck('nonce-1');
      bridge.markReady();

      expect(parentPostMessage).not.toHaveBeenCalled();
    }
  );

  it('accepts an HTTP referrer origin', () => {
    const { environment, dispatchCheck, parentPostMessage } = createEnvironment(
      'http://cockpit.example/some/path'
    );
    const bridge = installRuntimeBridge(environment);

    dispatchCheck('nonce-1', 'http://cockpit.example');
    bridge.markReady();

    expect(parentPostMessage).toHaveBeenCalledWith(
      { type: 'tplane:runtime-ready', version: 1, nonce: 'nonce-1' },
      'http://cockpit.example'
    );
  });

  it('uses only the referrer URL origin rather than query-provided origins', () => {
    const { environment, dispatchCheck, parentPostMessage } = createEnvironment(
      'https://cockpit.example/embed?parent=https://evil.example'
    );
    const bridge = installRuntimeBridge(environment);

    dispatchCheck('evil-nonce', 'https://evil.example');
    dispatchCheck('cockpit-nonce');
    bridge.markReady();

    expect(parentPostMessage).toHaveBeenCalledTimes(1);
    expect(parentPostMessage).toHaveBeenCalledWith(
      { type: 'tplane:runtime-ready', version: 1, nonce: 'cockpit-nonce' },
      'https://cockpit.example'
    );
  });

  it('retains only the newest valid check while initializing', () => {
    const { environment, dispatchCheck, parentPostMessage } = createEnvironment();
    const bridge = installRuntimeBridge(environment);

    dispatchCheck('nonce-1');
    dispatchCheck('nonce-2');
    bridge.markReady();

    expect(parentPostMessage).toHaveBeenCalledTimes(1);
    expect(parentPostMessage).toHaveBeenCalledWith(
      { type: 'tplane:runtime-ready', version: 1, nonce: 'nonce-2' },
      'https://cockpit.example'
    );
  });

  it('flushes a pending check once when marked ready', () => {
    const { environment, dispatchCheck, parentPostMessage } = createEnvironment();
    const bridge = installRuntimeBridge(environment);

    dispatchCheck('nonce-1');
    bridge.markReady();

    expect(parentPostMessage).toHaveBeenCalledWith(
      { type: 'tplane:runtime-ready', version: 1, nonce: 'nonce-1' },
      'https://cockpit.example'
    );
    expect(parentPostMessage).not.toHaveBeenCalledWith(expect.anything(), '*');
  });

  it('keeps the ready state when a pending reply cannot be delivered', () => {
    const { environment, dispatchCheck, parentPostMessage } = createEnvironment();
    const bridge = installRuntimeBridge(environment);

    parentPostMessage.mockImplementationOnce(() => {
      throw new Error('delivery failed');
    });
    dispatchCheck('nonce-1');

    expect(() => bridge.markReady()).not.toThrow();

    dispatchCheck('nonce-2');

    expect(parentPostMessage).toHaveBeenCalledTimes(2);
    expect(parentPostMessage).toHaveBeenLastCalledWith(
      { type: 'tplane:runtime-ready', version: 1, nonce: 'nonce-2' },
      'https://cockpit.example'
    );
  });

  it('flushes an allowlisted bootstrap failure once when marked errored', () => {
    const { environment, dispatchCheck, parentPostMessage } = createEnvironment();
    const bridge = installRuntimeBridge(environment);

    dispatchCheck('nonce-1');
    bridge.markError('bootstrap_failed');

    expect(parentPostMessage).toHaveBeenCalledTimes(1);
    expect(parentPostMessage).toHaveBeenCalledWith(
      {
        type: 'tplane:runtime-error',
        version: 1,
        nonce: 'nonce-1',
        code: 'bootstrap_failed',
      },
      'https://cockpit.example'
    );
  });

  it('ignores invalid runtime error codes while retaining a pending check', () => {
    const { environment, dispatchCheck, parentPostMessage } = createEnvironment();
    const bridge = installRuntimeBridge(environment);
    const unsafeBridge = bridge as unknown as UnsafeRuntimeBridge;

    dispatchCheck('nonce-1');

    expect(() => unsafeBridge.markError('unexpected_failure')).not.toThrow();
    expect(() => unsafeBridge.markError({ code: 'bootstrap_failed' })).not.toThrow();
    expect(parentPostMessage).not.toHaveBeenCalled();

    bridge.markError('bootstrap_failed');

    expect(parentPostMessage).toHaveBeenCalledTimes(1);
    expect(parentPostMessage).toHaveBeenCalledWith(
      {
        type: 'tplane:runtime-error',
        version: 1,
        nonce: 'nonce-1',
        code: 'bootstrap_failed',
      },
      'https://cockpit.example'
    );
  });

  it('allows a later ready transition after an invalid error call before any check', () => {
    const { environment, dispatchCheck, parentPostMessage } = createEnvironment();
    const bridge = installRuntimeBridge(environment);
    const unsafeBridge = bridge as unknown as UnsafeRuntimeBridge;

    unsafeBridge.markError('unexpected_failure');
    dispatchCheck('nonce-1');
    bridge.markReady();

    expect(parentPostMessage).toHaveBeenCalledWith(
      { type: 'tplane:runtime-ready', version: 1, nonce: 'nonce-1' },
      'https://cockpit.example'
    );
  });

  it('allows a later error transition after an invalid error call before any check', () => {
    const { environment, dispatchCheck, parentPostMessage } = createEnvironment();
    const bridge = installRuntimeBridge(environment);
    const unsafeBridge = bridge as unknown as UnsafeRuntimeBridge;

    unsafeBridge.markError('unexpected_failure');
    dispatchCheck('nonce-1');
    bridge.markError('bootstrap_failed');

    expect(parentPostMessage).toHaveBeenCalledWith(
      {
        type: 'tplane:runtime-error',
        version: 1,
        nonce: 'nonce-1',
        code: 'bootstrap_failed',
      },
      'https://cockpit.example'
    );
  });

  it('keeps the error state when a pending reply cannot be delivered', () => {
    const { environment, dispatchCheck, parentPostMessage } = createEnvironment();
    const bridge = installRuntimeBridge(environment);

    parentPostMessage.mockImplementationOnce(() => {
      throw new Error('delivery failed');
    });
    dispatchCheck('nonce-1');

    expect(() => bridge.markError('bootstrap_failed')).not.toThrow();

    dispatchCheck('nonce-2');

    expect(parentPostMessage).toHaveBeenCalledTimes(2);
    expect(parentPostMessage).toHaveBeenLastCalledWith(
      {
        type: 'tplane:runtime-error',
        version: 1,
        nonce: 'nonce-2',
        code: 'bootstrap_failed',
      },
      'https://cockpit.example'
    );
  });

  it('makes lifecycle calls idempotent and preserves the first terminal state', () => {
    const { environment, dispatchCheck, parentPostMessage } = createEnvironment();
    const bridge = installRuntimeBridge(environment);

    dispatchCheck('nonce-1');
    bridge.markReady();
    bridge.markError('bootstrap_failed');
    bridge.markReady();
    dispatchCheck('nonce-2');

    expect(parentPostMessage).toHaveBeenCalledTimes(2);
    expect(parentPostMessage).toHaveBeenNthCalledWith(
      1,
      { type: 'tplane:runtime-ready', version: 1, nonce: 'nonce-1' },
      'https://cockpit.example'
    );
    expect(parentPostMessage).toHaveBeenNthCalledWith(
      2,
      { type: 'tplane:runtime-ready', version: 1, nonce: 'nonce-2' },
      'https://cockpit.example'
    );
  });

  it('preserves bootstrap failure when error is the first terminal state', () => {
    const { environment, dispatchCheck, parentPostMessage } = createEnvironment();
    const bridge = installRuntimeBridge(environment);

    dispatchCheck('nonce-1');
    bridge.markError('bootstrap_failed');
    bridge.markReady();
    bridge.markError('bootstrap_failed');
    dispatchCheck('nonce-2');

    expect(parentPostMessage).toHaveBeenCalledTimes(2);
    expect(parentPostMessage).toHaveBeenNthCalledWith(
      1,
      {
        type: 'tplane:runtime-error',
        version: 1,
        nonce: 'nonce-1',
        code: 'bootstrap_failed',
      },
      'https://cockpit.example'
    );
    expect(parentPostMessage).toHaveBeenNthCalledWith(
      2,
      {
        type: 'tplane:runtime-error',
        version: 1,
        nonce: 'nonce-2',
        code: 'bootstrap_failed',
      },
      'https://cockpit.example'
    );
  });

  it('immediately returns the terminal error with the later check nonce', () => {
    const { environment, dispatchCheck, parentPostMessage } = createEnvironment();
    const bridge = installRuntimeBridge(environment);

    bridge.markError('bootstrap_failed');
    dispatchCheck('nonce-2');

    expect(parentPostMessage).toHaveBeenCalledWith(
      {
        type: 'tplane:runtime-error',
        version: 1,
        nonce: 'nonce-2',
        code: 'bootstrap_failed',
      },
      'https://cockpit.example'
    );
  });

  it('does not throw or change terminal state when an immediate reply cannot be delivered', () => {
    const { environment, dispatchCheck, parentPostMessage } = createEnvironment();
    const bridge = installRuntimeBridge(environment);

    bridge.markReady();
    parentPostMessage.mockImplementationOnce(() => {
      throw new Error('delivery failed');
    });

    expect(() => dispatchCheck('nonce-1')).not.toThrow();

    dispatchCheck('nonce-2');

    expect(parentPostMessage).toHaveBeenCalledTimes(2);
    expect(parentPostMessage).toHaveBeenLastCalledWith(
      { type: 'tplane:runtime-ready', version: 1, nonce: 'nonce-2' },
      'https://cockpit.example'
    );
  });

  it('removes its listener and blocks future replies when disposed', () => {
    const { environment, dispatchCheck, parentPostMessage, runtimeWindow } = createEnvironment();
    const bridge = installRuntimeBridge(environment);

    dispatchCheck('nonce-1');
    bridge.dispose();
    dispatchCheck('nonce-2');
    bridge.markReady();
    bridge.markError('bootstrap_failed');

    expect(runtimeWindow.removeEventListener).toHaveBeenCalledTimes(1);
    expect(parentPostMessage).not.toHaveBeenCalled();
  });

  it('ignores malformed protocol checks', () => {
    const { environment, dispatchMessage, parentPostMessage } = createEnvironment();
    const bridge = installRuntimeBridge(environment);

    dispatchMessage({
      type: 'tplane:runtime-check',
      version: 1,
      nonce: 'nonce-1',
      capability: 'chat',
      extra: true,
    });
    bridge.markReady();

    expect(parentPostMessage).not.toHaveBeenCalled();
  });
});
