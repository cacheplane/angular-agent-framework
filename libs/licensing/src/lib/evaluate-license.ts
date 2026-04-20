// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { LicenseClaims } from './license-token.js';
import type { VerifyResult } from './verify-license.js';

export type LicenseStatus =
  | 'licensed'       // valid signed token, not expired
  | 'grace'          // valid signed token, expired but within grace window
  | 'expired'        // valid signed token, past grace window
  | 'missing'        // no token and not noncommercial
  | 'tampered'       // token present, failed signature or malformed
  | 'noncommercial'; // no token, env looks noncommercial

export interface EvaluateOptions {
  /** Current time in epoch seconds. Injected for testability. */
  nowSec: number;
  /** Grace window in seconds after `exp`. Defaults to 14 days. */
  graceSec?: number;
  /** If true, missing token resolves to `noncommercial` instead of `missing`. */
  isNoncommercial?: boolean;
}

export interface EvaluateResult {
  status: LicenseStatus;
  /** Populated when the token was valid (licensed / grace / expired). */
  claims?: LicenseClaims;
}

const FOURTEEN_DAYS_SEC = 14 * 24 * 60 * 60;

export function evaluateLicense(
  verifyResult: VerifyResult | undefined,
  options: EvaluateOptions,
): EvaluateResult {
  const grace = options.graceSec ?? FOURTEEN_DAYS_SEC;

  if (!verifyResult) {
    return { status: options.isNoncommercial ? 'noncommercial' : 'missing' };
  }

  if (!verifyResult.ok) {
    return { status: 'tampered' };
  }

  const { claims } = verifyResult;
  if (options.nowSec <= claims.exp) return { status: 'licensed', claims };
  if (options.nowSec <= claims.exp + grace) return { status: 'grace', claims };
  return { status: 'expired', claims };
}
