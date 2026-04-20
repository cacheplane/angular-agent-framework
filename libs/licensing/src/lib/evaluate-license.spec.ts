// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import { evaluateLicense } from './evaluate-license';
import type { LicenseClaims } from './license-token';

const CLAIMS: LicenseClaims = {
  sub: 'cus_123',
  tier: 'developer-seat',
  iat: 1_700_000_000,
  exp: 2_000_000_000, // far future
  seats: 5,
};

const DAY = 86_400;

describe('evaluateLicense', () => {
  it('returns licensed when verify ok and not expired', () => {
    const result = evaluateLicense(
      { ok: true, claims: CLAIMS },
      { nowSec: 1_900_000_000 },
    );
    expect(result.status).toBe('licensed');
    expect(result.claims).toEqual(CLAIMS);
  });

  it('returns grace within 14 days after expiry', () => {
    const expired = { ...CLAIMS, exp: 1_900_000_000 };
    const result = evaluateLicense(
      { ok: true, claims: expired },
      { nowSec: 1_900_000_000 + 10 * DAY },
    );
    expect(result.status).toBe('grace');
    expect(result.claims).toEqual(expired);
  });

  it('returns expired past the 14 day grace window', () => {
    const expired = { ...CLAIMS, exp: 1_900_000_000 };
    const result = evaluateLicense(
      { ok: true, claims: expired },
      { nowSec: 1_900_000_000 + 15 * DAY },
    );
    expect(result.status).toBe('expired');
  });

  it('returns tampered when verify failed with bad signature', () => {
    const result = evaluateLicense(
      { ok: false, reason: 'tampered' },
      { nowSec: 1_900_000_000 },
    );
    expect(result.status).toBe('tampered');
  });

  it('returns missing when no token was supplied', () => {
    const result = evaluateLicense(undefined, { nowSec: 1_900_000_000 });
    expect(result.status).toBe('missing');
  });

  it('returns noncommercial when no token and dev env is hinted', () => {
    const result = evaluateLicense(undefined, {
      nowSec: 1_900_000_000,
      isNoncommercial: true,
    });
    expect(result.status).toBe('noncommercial');
  });

  it('still returns licensed in noncommercial env when a valid token is present', () => {
    const result = evaluateLicense(
      { ok: true, claims: CLAIMS },
      { nowSec: 1_900_000_000, isNoncommercial: true },
    );
    expect(result.status).toBe('licensed');
  });
});
