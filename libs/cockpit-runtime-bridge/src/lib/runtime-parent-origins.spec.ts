import { describe, expect, it } from 'vitest';
import {
  isAllowedRuntimeParentOrigin,
  validateRuntimeParentOrigins,
} from './runtime-parent-origins';

describe('runtime parent origins', () => {
  it('accepts canonical exact HTTPS and loopback HTTP origins', () => {
    expect(
      validateRuntimeParentOrigins([
        'https://threadplane.ai',
        'https://preview-123.vercel.app',
        'http://localhost:3000',
        'http://127.0.0.1:4308',
        'http://[::1]:4308',
      ])
    ).toEqual([
      'https://threadplane.ai',
      'https://preview-123.vercel.app',
      'http://localhost:3000',
      'http://127.0.0.1:4308',
      'http://[::1]:4308',
    ]);
  });

  it.each([
    '*',
    'https://*.vercel.app',
    '.threadplane.ai',
    'https://threadplane.ai/path',
    'https://threadplane.ai/',
    'https://threadplane.ai?preview=true',
    'https://threadplane.ai#fragment',
    'https://user:secret@threadplane.ai',
    'http://threadplane.ai',
    'ftp://threadplane.ai',
    'HTTPS://threadplane.ai',
    'https://THREADPLANE.ai',
    '',
  ])('rejects non-exact or non-canonical origins: %s', (origin) => {
    expect(validateRuntimeParentOrigins([origin])).toBeNull();
  });

  it('rejects non-arrays, duplicates, non-strings, and oversized lists', () => {
    expect(validateRuntimeParentOrigins('https://threadplane.ai')).toBeNull();
    expect(
      validateRuntimeParentOrigins([
        'https://threadplane.ai',
        'https://threadplane.ai',
      ])
    ).toBeNull();
    expect(
      validateRuntimeParentOrigins(['https://threadplane.ai', 3])
    ).toBeNull();
    expect(
      validateRuntimeParentOrigins(
        Array.from(
          { length: 65 },
          (_, index) => `https://preview-${index}.vercel.app`
        )
      )
    ).toBeNull();
  });

  it('matches exact members only without suffix or wildcard behavior', () => {
    const allowed = [
      'https://threadplane.ai',
      'https://preview-123.vercel.app',
    ] as const;

    expect(
      isAllowedRuntimeParentOrigin('https://threadplane.ai', allowed)
    ).toBe(true);
    expect(
      isAllowedRuntimeParentOrigin('https://evil.threadplane.ai', allowed)
    ).toBe(false);
    expect(
      isAllowedRuntimeParentOrigin(
        'https://preview-123.vercel.app.evil.example',
        allowed
      )
    ).toBe(false);
  });
});
