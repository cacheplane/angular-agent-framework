// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { signLicense, type LicenseClaims } from '@cacheplane/licensing';
import type { MintableTier } from './tier.js';

export interface MintInput {
  stripeCustomerId: string;
  tier: MintableTier;
  seats: number;
  expiresAt: Date;
}

/**
 * Mint a signed license token. `privateKeyHex` is a 64-char hex string
 * encoding a 32-byte Ed25519 private key.
 */
export async function mintToken(input: MintInput, privateKeyHex: string): Promise<string> {
  const privateKey = hexToBytes(privateKeyHex);
  const now = Math.floor(Date.now() / 1000);
  const claims: LicenseClaims = {
    sub: input.stripeCustomerId,
    tier: input.tier,
    iat: now,
    exp: Math.floor(input.expiresAt.getTime() / 1000),
    seats: input.seats,
  };
  return signLicense(claims, privateKey);
}

function hexToBytes(hex: string): Uint8Array {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2 !== 0) {
    throw new Error('mintToken: privateKeyHex must be an even-length hex string');
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}
