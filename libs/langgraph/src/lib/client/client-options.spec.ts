import { describe, it, expect } from 'vitest';
import { resolveClientOptions } from './client-options';

describe('resolveClientOptions', () => {
  it('returns undefined when every layer is undefined/null', () => {
    expect(resolveClientOptions(undefined, null, undefined)).toBeUndefined();
    expect(resolveClientOptions()).toBeUndefined();
  });

  it('returns the first defined layer (highest precedence first)', () => {
    expect(resolveClientOptions({ maxRetries: 0 }, { maxRetries: 4 })).toEqual({ maxRetries: 0 });
  });

  it('falls through to a later layer when earlier layers are absent', () => {
    expect(resolveClientOptions(undefined, undefined, { maxRetries: 2 })).toEqual({ maxRetries: 2 });
  });

  it('treats only undefined/null as absent (an empty object is a real layer)', () => {
    expect(resolveClientOptions({}, { maxRetries: 4 })).toEqual({});
  });

  it('preserves whole-object precedence for apiKey instead of merging layers', () => {
    const callSite = { apiKey: 'test-key-redact-me' };
    const provider = { apiKey: 'provider-key', maxRetries: 4 };

    expect(resolveClientOptions(callSite, provider)).toBe(callSite);
    expect(resolveClientOptions({}, provider)).toEqual({});
  });
});
