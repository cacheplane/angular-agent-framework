import { describe, expect, it, vi } from 'vitest';
import {
  parseRuntimeChildReadyMessage,
  parseRuntimeCheckMessage,
  parseRuntimeConfigurationFailedMessage,
  parseRuntimeConfigureMessage,
  parseRuntimeConfiguredMessage,
  parseRuntimeOperationFailedMessage,
  parseRuntimeResponseMessage,
} from './protocol';

describe('runtime bridge protocol', () => {
  it('parses a valid runtime check message', () => {
    const message = {
      type: 'tplane:runtime-check',
      version: 1,
      nonce: ' check-1 ',
      capability: ' streaming ',
    };

    expect(parseRuntimeCheckMessage(message)).toEqual(message);
  });

  it('parses a valid runtime ready message', () => {
    const message = {
      type: 'tplane:runtime-ready',
      version: 1,
      nonce: ' check-1 ',
    };

    expect(parseRuntimeResponseMessage(message)).toEqual(message);
  });

  it('parses a valid runtime bootstrap failure message', () => {
    const message = {
      type: 'tplane:runtime-error',
      version: 1,
      nonce: 'check-1',
      code: 'bootstrap_failed',
    };

    expect(parseRuntimeResponseMessage(message)).toEqual(message);
  });

  it('rejects non-record objects even when they carry valid check fields', () => {
    const message = Object.assign(new Date(), {
      type: 'tplane:runtime-check',
      version: 1,
      nonce: 'check-1',
      capability: 'streaming',
    });

    expect(parseRuntimeCheckMessage(message)).toBeNull();
  });

  it('rejects class instances carrying otherwise valid check fields', () => {
    class RuntimeCheck {
      type = 'tplane:runtime-check';
      version = 1;
      nonce = 'check-1';
      capability = 'streaming';
    }

    expect(parseRuntimeCheckMessage(new RuntimeCheck())).toBeNull();
  });

  it('returns null when a Symbol.toStringTag getter throws', () => {
    const message = {
      type: 'tplane:runtime-check',
      version: 1,
      nonce: 'check-1',
      capability: 'streaming',
    };

    Object.defineProperty(message, Symbol.toStringTag, {
      get() {
        throw new Error('unexpected tag access');
      },
    });

    expect(parseRuntimeCheckMessage(message)).toBeNull();
  });

  it('returns null when reflection on a proxy throws', () => {
    const message = new Proxy(
      {
        type: 'tplane:runtime-check',
        version: 1,
        nonce: 'check-1',
        capability: 'streaming',
      },
      {
        ownKeys() {
          throw new Error('unexpected reflection');
        },
      }
    );

    expect(parseRuntimeCheckMessage(message)).toBeNull();
  });

  it('returns null when an expected field getter throws', () => {
    const message = {
      type: 'tplane:runtime-check',
      version: 1,
      capability: 'streaming',
    };

    Object.defineProperty(message, 'nonce', {
      enumerable: true,
      get() {
        throw new Error('unexpected nonce access');
      },
    });

    expect(parseRuntimeCheckMessage(message)).toBeNull();
  });

  it('rejects valid-shaped objects with an extra symbol key', () => {
    const message = {
      type: 'tplane:runtime-check',
      version: 1,
      nonce: 'check-1',
      capability: 'streaming',
      [Symbol('extra')]: true,
    };

    expect(parseRuntimeCheckMessage(message)).toBeNull();
  });

  it.each([
    {
      type: true,
      version: 1,
      nonce: 'check-1',
      capability: 'streaming',
    },
    {
      type: 'tplane:runtime-check',
      version: '1',
      nonce: 'check-1',
      capability: 'streaming',
    },
    {
      type: 'tplane:runtime-check',
      version: 1,
      nonce: 1,
      capability: 'streaming',
    },
    {
      type: 'tplane:runtime-check',
      version: 1,
      nonce: 'check-1',
      capability: false,
    },
  ])(
    'rejects runtime check messages with wrong primitive field types: %j',
    (message) => {
      expect(parseRuntimeCheckMessage(message)).toBeNull();
    }
  );

  it.each([
    {
      type: 'tplane:runtime-ready',
      version: '1',
      nonce: 'check-1',
    },
    {
      type: 'tplane:runtime-error',
      version: 1,
      nonce: 1,
      code: 'bootstrap_failed',
    },
    {
      type: 'tplane:runtime-error',
      version: 1,
      nonce: 'check-1',
      code: false,
    },
  ])(
    'rejects runtime response messages with wrong primitive field types: %j',
    (message) => {
      expect(parseRuntimeResponseMessage(message)).toBeNull();
    }
  );

  it.each([
    null,
    'runtime-check',
    1,
    true,
    [],
    {},
    {
      type: 'tplane:runtime-check',
      version: 1,
      nonce: 'check-1',
      capability: 'streaming',
      extra: true,
    },
    {
      type: 'tplane:runtime-check',
      version: 2,
      nonce: 'check-1',
      capability: 'streaming',
    },
    {
      type: 'tplane:runtime-check',
      version: 1,
      nonce: '',
      capability: 'streaming',
    },
    {
      type: 'tplane:runtime-check',
      version: 1,
      nonce: '   ',
      capability: 'streaming',
    },
    {
      type: 'tplane:runtime-check',
      version: 1,
      nonce: 'check-1',
      capability: '',
    },
    {
      type: 'tplane:runtime-check',
      version: 1,
      nonce: 'check-1',
      capability: '   ',
    },
    {
      type: 'tplane:unknown',
      version: 1,
      nonce: 'check-1',
      capability: 'streaming',
    },
  ])('rejects malformed runtime check messages: %j', (message) => {
    expect(parseRuntimeCheckMessage(message)).toBeNull();
  });

  it.each([
    null,
    'runtime-response',
    1,
    true,
    [],
    {},
    {
      type: 'tplane:runtime-ready',
      version: 1,
      nonce: 'check-1',
      extra: true,
    },
    {
      type: 'tplane:runtime-ready',
      version: 2,
      nonce: 'check-1',
    },
    {
      type: 'tplane:runtime-ready',
      version: 1,
      nonce: '',
    },
    {
      type: 'tplane:runtime-ready',
      version: 1,
      nonce: '   ',
    },
    {
      type: 'tplane:runtime-ready',
      version: 1,
      nonce: 'check-1',
      code: 'bootstrap_failed',
    },
    {
      type: 'tplane:runtime-error',
      version: 1,
      nonce: 'check-1',
      code: 'unknown',
    },
    {
      type: 'tplane:runtime-error',
      version: 1,
      nonce: '',
      code: 'bootstrap_failed',
    },
    {
      type: 'tplane:runtime-error',
      version: 1,
      nonce: 'check-1',
      code: 'bootstrap_failed',
      extra: true,
    },
    {
      type: 'tplane:unknown',
      version: 1,
      nonce: 'check-1',
    },
  ])('rejects malformed runtime response messages: %j', (message) => {
    expect(parseRuntimeResponseMessage(message)).toBeNull();
  });
});

describe('runtime bridge configuration protocol v2', () => {
  const nonce = 'configuration-nonce';

  const messages = {
    childReady: {
      type: 'tplane:runtime-child-ready',
      version: 2,
      nonce,
    },
    configure: {
      type: 'tplane:runtime-configure',
      version: 2,
      nonce,
      generation: 7,
      target: { kind: 'ag-ui', endpoint: 'https://agent.example/run/' },
    },
    configured: {
      type: 'tplane:runtime-configured',
      version: 2,
      nonce,
      generation: 7,
    },
    configurationFailed: {
      type: 'tplane:runtime-configuration-failed',
      version: 2,
      nonce,
      generation: 7,
      code: 'incompatible_bridge',
    },
    operationFailed: {
      type: 'tplane:runtime-operation-failed',
      version: 2,
      nonce,
      generation: 7,
      code: 'unauthorized',
    },
  } as const;

  it('parses every exact v2 message shape', () => {
    expect(parseRuntimeChildReadyMessage(messages.childReady)).toEqual(
      messages.childReady
    );
    expect(parseRuntimeConfigureMessage(messages.configure)).toEqual(
      messages.configure
    );
    expect(parseRuntimeConfiguredMessage(messages.configured)).toEqual(
      messages.configured
    );
    expect(
      parseRuntimeConfigurationFailedMessage(messages.configurationFailed)
    ).toEqual(messages.configurationFailed);
    expect(
      parseRuntimeOperationFailedMessage(messages.operationFailed)
    ).toEqual(messages.operationFailed);
  });

  it('accepts ordinary and null-prototype records, including nested targets', () => {
    const childReady = Object.assign(Object.create(null), messages.childReady);
    const target = Object.assign(Object.create(null), {
      kind: 'langsmith',
      apiUrl: 'https://api.example/v1',
      apiKey: 'test-key-redact-me',
    });
    const configure = Object.assign(Object.create(null), {
      type: 'tplane:runtime-configure',
      version: 2,
      nonce,
      generation: 9,
      target,
    });

    expect(parseRuntimeChildReadyMessage(childReady)).toEqual(
      messages.childReady
    );
    expect(parseRuntimeConfigureMessage(configure)).toEqual({
      type: 'tplane:runtime-configure',
      version: 2,
      nonce,
      generation: 9,
      target: {
        kind: 'langsmith',
        apiUrl: 'https://api.example/v1',
        apiKey: 'test-key-redact-me',
      },
    });
  });

  it.each([
    { kind: 'shared' },
    { kind: 'ag-ui', endpoint: 'https://agent.example' },
    {
      kind: 'langsmith',
      apiUrl: 'https://api.example/v1/',
      apiKey: 'test-key-redact-me',
    },
  ])('parses the exact target shape $kind', (target) => {
    expect(
      parseRuntimeConfigureMessage({
        type: 'tplane:runtime-configure',
        version: 2,
        nonce,
        generation: 0,
        target,
      })
    ).toEqual({
      type: 'tplane:runtime-configure',
      version: 2,
      nonce,
      generation: 0,
      target,
    });
  });

  it.each(['', '   ', 'n'.repeat(129)])(
    'rejects invalid bounded nonces',
    (invalidNonce) => {
      expect(
        parseRuntimeChildReadyMessage({
          ...messages.childReady,
          nonce: invalidNonce,
        })
      ).toBeNull();
    }
  );

  it.each([
    -1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.MAX_SAFE_INTEGER + 1,
  ])('rejects unsafe generations: %s', (generation) => {
    expect(
      parseRuntimeConfigureMessage({
        ...messages.configure,
        generation,
      })
    ).toBeNull();
    expect(
      parseRuntimeConfiguredMessage({
        ...messages.configured,
        generation,
      })
    ).toBeNull();
  });

  it.each([
    'relative/path',
    'ftp://agent.example/run',
    'http://agent.example/run',
    'https://user:secret@agent.example/run',
    'https://agent.example/run?key=value',
    'https://agent.example/run#fragment',
    `https://agent.example/${String.fromCharCode(1)}`,
    `https://agent.example/${'x'.repeat(2049)}`,
  ])('rejects malformed target URLs without echoing them: %s', (endpoint) => {
    expect(
      parseRuntimeConfigureMessage({
        ...messages.configure,
        target: { kind: 'ag-ui', endpoint },
      })
    ).toBeNull();
  });

  it.each([
    'https://agent.example/a/../run',
    'https://agent.example/a/./run',
    'https://agent.example/a/%2e%2e/run',
    'https://agent.example/a/%2E./run',
    'https://agent.example/a/.%2e/run',
  ])('rejects URL paths rewritten during parsing: %s', (url) => {
    expect(
      parseRuntimeConfigureMessage({
        ...messages.configure,
        target: { kind: 'ag-ui', endpoint: url },
      })
    ).toBeNull();
    expect(
      parseRuntimeConfigureMessage({
        ...messages.configure,
        target: {
          kind: 'langsmith',
          apiUrl: url,
          apiKey: 'test-key-redact-me',
        },
      })
    ).toBeNull();
  });

  it.each([null, 42, '', '   ', 'k'.repeat(8193)])(
    'rejects invalid LangSmith keys',
    (apiKey) => {
      expect(
        parseRuntimeConfigureMessage({
          ...messages.configure,
          target: {
            kind: 'langsmith',
            apiUrl: 'https://api.example',
            apiKey,
          },
        })
      ).toBeNull();
    }
  );

  it('rejects class and custom-prototype records at every level', () => {
    class ChildReady {
      type = 'tplane:runtime-child-ready';
      version = 2;
      nonce = 'configuration-nonce';
    }
    const customPrototype = Object.create({ inherited: true });
    Object.assign(customPrototype, messages.configured);
    const customTarget = Object.create({ inherited: true });
    Object.assign(customTarget, messages.configure.target);

    expect(parseRuntimeChildReadyMessage(new ChildReady())).toBeNull();
    expect(parseRuntimeConfiguredMessage(customPrototype)).toBeNull();
    expect(
      parseRuntimeConfigureMessage({
        ...messages.configure,
        target: customTarget,
      })
    ).toBeNull();
  });

  it('rejects missing, extra, and symbol keys', () => {
    const missingNonce = {
      type: messages.childReady.type,
      version: messages.childReady.version,
    };
    expect(parseRuntimeChildReadyMessage(missingNonce)).toBeNull();
    expect(
      parseRuntimeChildReadyMessage({ ...messages.childReady, extra: true })
    ).toBeNull();
    expect(
      parseRuntimeChildReadyMessage({
        ...messages.childReady,
        [Symbol('extra')]: true,
      })
    ).toBeNull();
    expect(
      parseRuntimeConfigureMessage({
        ...messages.configure,
        target: { ...messages.configure.target, extra: true },
      })
    ).toBeNull();
  });

  it('returns null for hostile getters and proxies without stringifying rejected data', () => {
    const toJson = vi.fn(() => {
      throw new Error('must not stringify');
    });
    const hostileGetter = {
      type: 'tplane:runtime-child-ready',
      version: 2,
      toJSON: toJson,
    };
    Object.defineProperty(hostileGetter, 'nonce', {
      enumerable: true,
      get() {
        throw new Error('hostile nonce');
      },
    });
    const hostileProxy = new Proxy(messages.configure, {
      ownKeys() {
        throw new Error('hostile ownKeys');
      },
    });

    expect(parseRuntimeChildReadyMessage(hostileGetter)).toBeNull();
    expect(parseRuntimeConfigureMessage(hostileProxy)).toBeNull();
    expect(toJson).not.toHaveBeenCalled();
  });

  it('rejects accessor fields instead of validating one value and retaining another', () => {
    let endpointReads = 0;
    const target = { kind: 'ag-ui' } as Record<string, unknown>;
    Object.defineProperty(target, 'endpoint', {
      enumerable: true,
      get() {
        endpointReads += 1;
        return endpointReads === 1
          ? 'https://agent.example/run'
          : 'https://user:secret@evil.example/run';
      },
    });

    expect(
      parseRuntimeConfigureMessage({
        ...messages.configure,
        target,
      })
    ).toBeNull();
    expect(endpointReads).toBe(0);
  });

  it('returns a frozen copy of the authoritative target', () => {
    const rawTarget = {
      kind: 'langsmith',
      apiUrl: 'https://api.example/v1',
      apiKey: 'test-key-redact-me',
    };
    const parsed = parseRuntimeConfigureMessage({
      ...messages.configure,
      target: rawTarget,
    });

    expect(parsed).not.toBeNull();
    expect(parsed?.target).not.toBe(rawTarget);
    expect(Object.isFrozen(parsed?.target)).toBe(true);
    expect(() => {
      (parsed?.target as { apiKey?: string }).apiKey = 'mutated-key';
    }).toThrow(TypeError);
    expect(parsed?.target).toEqual(rawTarget);
  });

  it('rejects unknown failure codes and protocol-version confusion', () => {
    expect(
      parseRuntimeConfigurationFailedMessage({
        ...messages.configurationFailed,
        code: 'unauthorized',
      })
    ).toBeNull();
    expect(
      parseRuntimeOperationFailedMessage({
        ...messages.operationFailed,
        code: 'incompatible_bridge',
      })
    ).toBeNull();
    expect(
      parseRuntimeChildReadyMessage({ ...messages.childReady, version: 1 })
    ).toBeNull();
    expect(
      parseRuntimeResponseMessage({
        type: 'tplane:runtime-ready',
        version: 2,
        nonce,
      })
    ).toBeNull();
  });
});
