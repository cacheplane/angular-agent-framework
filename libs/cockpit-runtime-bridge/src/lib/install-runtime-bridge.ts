import {
  parseRuntimeCheckMessage,
  RUNTIME_BRIDGE_VERSION,
  type RuntimeResponseMessage,
} from './protocol';

export type RuntimeBridgeEnvironment = {
  window: Pick<Window, 'parent' | 'addEventListener' | 'removeEventListener'>;
  document: Pick<Document, 'referrer'>;
};

export type InstalledRuntimeBridge = {
  markReady(): void;
  markError(code: 'bootstrap_failed'): void;
  dispose(): void;
};

type PendingCheck = {
  nonce: string;
  origin: string;
  source: Window;
};

type RuntimeBridgeState =
  | {
      phase: 'initializing';
      pendingCheck: PendingCheck | null;
    }
  | {
      phase: 'ready';
    }
  | {
      phase: 'error';
      code: 'bootstrap_failed';
    }
  | {
      phase: 'disposed';
    };

type TerminalRuntimeBridgeState = Extract<RuntimeBridgeState, { phase: 'ready' | 'error' }>;

function createRuntimeResponse(
  terminalState: TerminalRuntimeBridgeState,
  nonce: string
): RuntimeResponseMessage {
  switch (terminalState.phase) {
    case 'ready':
      return {
        type: 'tplane:runtime-ready',
        version: RUNTIME_BRIDGE_VERSION,
        nonce,
      };
    case 'error':
      return {
        type: 'tplane:runtime-error',
        version: RUNTIME_BRIDGE_VERSION,
        nonce,
        code: terminalState.code,
      };
  }

  const exhaustiveState: never = terminalState;
  return exhaustiveState;
}

function parseReferrerOrigin(referrer: string | undefined): string | null {
  if (!referrer) {
    return null;
  }

  try {
    const url = new URL(referrer);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.origin : null;
  } catch {
    return null;
  }
}

export function installRuntimeBridge(
  environment: RuntimeBridgeEnvironment = { window, document }
): InstalledRuntimeBridge {
  const expectedParentOrigin = parseReferrerOrigin(environment.document.referrer);
  let state: RuntimeBridgeState = { phase: 'initializing', pendingCheck: null };

  const reply = (terminalState: TerminalRuntimeBridgeState, check: PendingCheck) => {
    const response = createRuntimeResponse(terminalState, check.nonce);

    try {
      check.source.postMessage(response, check.origin);
    } catch {
      // The embedding page may disappear or reject delivery after validation.
    }
  };

  const onMessage = (event: MessageEvent<unknown>) => {
    if (state.phase === 'disposed') {
      return;
    }

    const check = parseRuntimeCheckMessage(event.data);
    const source = event.source;

    if (
      !check ||
      !expectedParentOrigin ||
      source !== environment.window.parent ||
      event.origin !== expectedParentOrigin
    ) {
      return;
    }

    const pendingCheck = {
      nonce: check.nonce,
      origin: event.origin,
      source: source as Window,
    };

    if (state.phase === 'initializing') {
      state = { phase: 'initializing', pendingCheck };
    } else {
      reply(state, pendingCheck);
    }
  };

  environment.window.addEventListener('message', onMessage);

  const markTerminal = (nextState: TerminalRuntimeBridgeState) => {
    if (state.phase !== 'initializing') {
      return;
    }

    const pendingCheck = state.pendingCheck;
    state = nextState;

    if (pendingCheck) {
      reply(state, pendingCheck);
    }
  };

  return {
    markReady() {
      markTerminal({ phase: 'ready' });
    },
    markError(code) {
      if (code !== 'bootstrap_failed') {
        return;
      }

      markTerminal({ phase: 'error', code });
    },
    dispose() {
      if (state.phase === 'disposed') {
        return;
      }

      state = { phase: 'disposed' };
      environment.window.removeEventListener('message', onMessage);
    },
  };
}
