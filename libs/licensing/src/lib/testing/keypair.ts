// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// TEST-ONLY utility: do not export from the package's public index.
import * as ed from '@noble/ed25519';
import type { LicenseClaims } from '../license-token';

export interface DevKeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

export async function generateKeyPair(): Promise<DevKeyPair> {
  const privateKey = ed.utils.randomPrivateKey();
  const publicKey = await ed.getPublicKeyAsync(privateKey);
  return { publicKey, privateKey };
}

function b64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64url');
}

/**
 * Sign claims with the given private key and return a compact token
 * `<b64url(payload)>.<b64url(sig)>`. Used by tests and by the
 * dev-fixture generator; NOT used at runtime by the package.
 */
export async function signLicense(
  claims: LicenseClaims,
  privateKey: Uint8Array,
): Promise<string> {
  const payload = new TextEncoder().encode(JSON.stringify(claims));
  const sig = await ed.signAsync(payload, privateKey);
  return `${b64url(payload)}.${b64url(sig)}`;
}
