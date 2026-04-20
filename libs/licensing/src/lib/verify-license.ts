// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import * as ed from '@noble/ed25519';
import { parseLicenseToken, type LicenseClaims } from './license-token';

export type VerifyReason = 'malformed' | 'tampered';

export type VerifyResult =
  | { ok: true; claims: LicenseClaims }
  | { ok: false; reason: VerifyReason };

/**
 * Offline-verify a license token against a raw Ed25519 public key.
 * No network calls, no time-based checks — see {@link evaluateLicense}
 * for grace-period / expiry logic.
 */
export async function verifyLicense(
  token: string,
  publicKey: Uint8Array,
): Promise<VerifyResult> {
  const parsed = parseLicenseToken(token);
  if (!parsed.ok) return { ok: false, reason: 'malformed' };

  let valid = false;
  try {
    valid = await ed.verifyAsync(parsed.signature, parsed.signedMessage, publicKey);
  } catch {
    valid = false;
  }

  if (!valid) return { ok: false, reason: 'tampered' };
  return { ok: true, claims: parsed.claims };
}
