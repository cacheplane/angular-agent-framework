// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

/** The tier a license grants. */
export type LicenseTier = 'developer-seat' | 'app-deployment' | 'enterprise';

/** Claims carried inside a signed license token. */
export interface LicenseClaims {
  /** Customer id (Stripe customer). */
  sub: string;
  /** Tier the license grants. */
  tier: LicenseTier;
  /** Issued-at, epoch seconds. */
  iat: number;
  /** Expires-at, epoch seconds. */
  exp: number;
  /** Seat count (>=1). */
  seats: number;
}

export type ParseLicenseTokenResult =
  | {
      ok: true;
      claims: LicenseClaims;
      /** Raw bytes that were signed (UTF-8 of the payload segment). */
      signedMessage: Uint8Array;
      signature: Uint8Array;
    }
  | { ok: false; reason: 'malformed' };

function base64UrlToBytes(s: string): Uint8Array | null {
  try {
    // base64url -> base64
    const pad = '='.repeat((4 - (s.length % 4)) % 4);
    const b64 = (s + pad).replace(/-/g, '+').replace(/_/g, '/');
    return Uint8Array.from(Buffer.from(b64, 'base64'));
  } catch {
    return null;
  }
}

function isLicenseClaims(value: unknown): value is LicenseClaims {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.sub === 'string' &&
    (v.tier === 'developer-seat' ||
      v.tier === 'app-deployment' ||
      v.tier === 'enterprise') &&
    typeof v.iat === 'number' &&
    typeof v.exp === 'number' &&
    typeof v.seats === 'number' &&
    v.seats >= 1
  );
}

/**
 * Parse a compact license token of the form `<base64url(payload-json)>.<base64url(ed25519-sig)>`.
 * Does NOT verify the signature — see {@link verifyLicense}.
 */
export function parseLicenseToken(token: string): ParseLicenseTokenResult {
  const parts = token.split('.');
  if (parts.length !== 2) return { ok: false, reason: 'malformed' };
  const [payloadSeg, signatureSeg] = parts;

  const payloadBytes = base64UrlToBytes(payloadSeg);
  const signature = base64UrlToBytes(signatureSeg);
  if (!payloadBytes || !signature) return { ok: false, reason: 'malformed' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(payloadBytes));
  } catch {
    return { ok: false, reason: 'malformed' };
  }

  if (!isLicenseClaims(parsed)) return { ok: false, reason: 'malformed' };

  return { ok: true, claims: parsed, signedMessage: payloadBytes, signature };
}
