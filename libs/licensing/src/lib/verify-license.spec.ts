// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { beforeAll, describe, it, expect } from 'vitest';
import { verifyLicense } from './verify-license';
import { generateKeyPair, signLicense, type DevKeyPair } from './testing/keypair';
import type { LicenseClaims } from './license-token';

const BASE_CLAIMS: LicenseClaims = {
  sub: 'cus_123',
  tier: 'developer-seat',
  iat: 1_700_000_000,
  exp: 1_800_000_000,
  seats: 5,
};

describe('verifyLicense', () => {
  let kp: DevKeyPair;
  let otherKp: DevKeyPair;
  let validToken: string;

  beforeAll(async () => {
    kp = await generateKeyPair();
    otherKp = await generateKeyPair();
    validToken = await signLicense(BASE_CLAIMS, kp.privateKey);
  });

  it('accepts a valid token signed with the matching key', async () => {
    const result = await verifyLicense(validToken, kp.publicKey);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.claims).toEqual(BASE_CLAIMS);
  });

  it('rejects a token signed with a different key as tampered', async () => {
    const badToken = await signLicense(BASE_CLAIMS, otherKp.privateKey);
    const result = await verifyLicense(badToken, kp.publicKey);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected err');
    expect(result.reason).toBe('tampered');
  });

  it('rejects a token whose payload has been mutated as tampered', async () => {
    const [payload, sig] = validToken.split('.');
    // Flip one byte of the payload to invalidate the signature while
    // keeping the shape valid.
    const mutated = Buffer.from(payload + 'A', 'base64url');
    const tamperedToken = `${Buffer.from(mutated).toString('base64url')}.${sig}`;
    const result = await verifyLicense(tamperedToken, kp.publicKey);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected err');
    // Could either fail as malformed (JSON parse) or tampered (sig check).
    expect(['malformed', 'tampered']).toContain(result.reason);
  });

  it('rejects a malformed token', async () => {
    const result = await verifyLicense('not-a-token', kp.publicKey);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected err');
    expect(result.reason).toBe('malformed');
  });
});
