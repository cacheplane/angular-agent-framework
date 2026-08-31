import { describe, expect, it } from 'vitest';
import {
  parseRuntimeCheckMessage,
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
  ])('rejects runtime check messages with wrong primitive field types: %j', (message) => {
    expect(parseRuntimeCheckMessage(message)).toBeNull();
  });

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
  ])('rejects runtime response messages with wrong primitive field types: %j', (message) => {
    expect(parseRuntimeResponseMessage(message)).toBeNull();
  });

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
