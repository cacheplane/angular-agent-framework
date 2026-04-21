// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import { parseLicenseToken } from './license-token';

const CLAIMS = {
  sub: 'cus_123',
  tier: 'developer-seat',
  iat: 1_700_000_000,
  exp: 1_800_000_000,
  seats: 5,
};

function b64url(bytes: Uint8Array | string): string {
  const input = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes;
  // Node's Buffer is available in vitest `environment: 'node'`.
  return Buffer.from(input).toString('base64url');
}

describe('parseLicenseToken', () => {
  it('splits a valid token into claims + signature bytes', () => {
    const payloadJson = JSON.stringify(CLAIMS);
    const signatureBytes = new Uint8Array(64).fill(7);
    const token = `${b64url(payloadJson)}.${b64url(signatureBytes)}`;

    const result = parseLicenseToken(token);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.claims).toEqual(CLAIMS);
    expect(result.signature).toEqual(signatureBytes);
    expect(result.signedMessage).toEqual(new TextEncoder().encode(payloadJson));
  });

  it('rejects a token with wrong number of segments', () => {
    const result = parseLicenseToken('only-one-segment');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected err');
    expect(result.reason).toBe('malformed');
  });

  it('rejects a token with non-JSON payload', () => {
    const token = `${b64url('not-json')}.${b64url(new Uint8Array(64))}`;
    const result = parseLicenseToken(token);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected err');
    expect(result.reason).toBe('malformed');
  });

  it('rejects a token missing required claims', () => {
    const payload = JSON.stringify({ sub: 'cus_123' });
    const token = `${b64url(payload)}.${b64url(new Uint8Array(64))}`;
    const result = parseLicenseToken(token);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected err');
    expect(result.reason).toBe('malformed');
  });
});
