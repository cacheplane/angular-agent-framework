// SPDX-License-Identifier: MIT
import * as ed from '@noble/ed25519';
import { signLicense } from './sign-license.js';
import { verifyLicense } from './verify-license.js';
import type { LicenseClaims } from './license-token.js';

describe('signLicense', () => {
  it('produces a token that verifyLicense accepts with the matching public key', async () => {
    const privateKey = ed.utils.randomPrivateKey();
    const publicKey = await ed.getPublicKeyAsync(privateKey);
    const claims: LicenseClaims = {
      sub: 'cus_test_123',
      tier: 'developer-seat',
      iat: 1_700_000_000,
      exp: 1_800_000_000,
      seats: 5,
    };

    const token = await signLicense(claims, privateKey);
    const result = await verifyLicense(token, publicKey);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.claims).toEqual(claims);
    }
  });

  it('produces a token with two base64url segments separated by a dot', async () => {
    const privateKey = ed.utils.randomPrivateKey();
    const claims: LicenseClaims = {
      sub: 'cus_abc',
      tier: 'app-deployment',
      iat: 1_700_000_000,
      exp: 1_800_000_000,
      seats: 1,
    };

    const token = await signLicense(claims, privateKey);
    const parts = token.split('.');

    expect(parts).toHaveLength(2);
    expect(parts[0]).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(parts[1]).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('tokens signed with different keys fail verification against the wrong key', async () => {
    const sk1 = ed.utils.randomPrivateKey();
    const sk2 = ed.utils.randomPrivateKey();
    const pk2 = await ed.getPublicKeyAsync(sk2);
    const claims: LicenseClaims = {
      sub: 'cus_x',
      tier: 'developer-seat',
      iat: 1_700_000_000,
      exp: 1_800_000_000,
      seats: 1,
    };

    const token = await signLicense(claims, sk1);
    const result = await verifyLicense(token, pk2);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('tampered');
  });
});
