// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import * as ed from '@noble/ed25519';
import type { LicenseClaims } from './license-token.js';

function bytesToBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Sign license claims with an Ed25519 private key.
 * Returns a compact token of the form `<base64url(payload-json)>.<base64url(signature)>`,
 * compatible with {@link parseLicenseToken} and {@link verifyLicense}.
 */
export async function signLicense(
  claims: LicenseClaims,
  privateKey: Uint8Array,
): Promise<string> {
  const payloadJson = JSON.stringify(claims);
  const payloadBytes = new TextEncoder().encode(payloadJson);
  const signature = await ed.signAsync(payloadBytes, privateKey);
  return `${bytesToBase64Url(payloadBytes)}.${bytesToBase64Url(signature)}`;
}
