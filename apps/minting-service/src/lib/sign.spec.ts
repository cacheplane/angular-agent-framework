// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import * as ed from '@noble/ed25519';
import { verifyLicense } from '@cacheplane/licensing';
import { mintToken } from './sign.js';

async function makeKeypair() {
  const sk = ed.utils.randomPrivateKey();
  const pk = await ed.getPublicKeyAsync(sk);
  return {
    skHex: Buffer.from(sk).toString('hex'),
    pk,
  };
}

describe('mintToken', () => {
  it('returns a token verifiable with the matching public key', async () => {
    const { skHex, pk } = await makeKeypair();

    const token = await mintToken(
      {
        stripeCustomerId: 'cus_abc',
        tier: 'developer-seat',
        seats: 3,
        expiresAt: new Date('2027-01-01T00:00:00Z'),
      },
      skHex,
    );

    const result = await verifyLicense(token, pk);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.claims.sub).toBe('cus_abc');
      expect(result.claims.tier).toBe('developer-seat');
      expect(result.claims.seats).toBe(3);
      expect(result.claims.exp).toBe(Math.floor(new Date('2027-01-01T00:00:00Z').getTime() / 1000));
      expect(result.claims.iat).toBeGreaterThan(0);
    }
  });

  it('throws if the private key hex is malformed', async () => {
    await expect(
      mintToken(
        {
          stripeCustomerId: 'cus_x',
          tier: 'app-deployment',
          seats: 1,
          expiresAt: new Date('2027-01-01T00:00:00Z'),
        },
        'not-hex',
      ),
    ).rejects.toThrow();
  });
});
