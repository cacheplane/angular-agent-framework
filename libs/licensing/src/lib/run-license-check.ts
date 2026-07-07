// SPDX-License-Identifier: MIT
import { verifyLicense } from './verify-license.js';
import { evaluateLicense, type LicenseStatus } from './evaluate-license.js';
import { emitNag } from './nag.js';

export interface RunLicenseCheckOptions {
  /** Fully-qualified host package name. */
  package: string;
  /** User-supplied license token, or undefined. */
  token?: string;
  /** Ed25519 public key to verify against. */
  publicKey: Uint8Array;
  /** Current time in epoch seconds. Defaults to now. Injected for testability. */
  nowSec?: number;
  /** Hint that the environment is noncommercial (e.g. NODE_ENV !== 'production'). */
  isNoncommercial?: boolean;
  /** Injected warn channel, defaults to console.warn. */
  warn?: (message: string) => void;
}

const done = new Map<string, LicenseStatus>();

/**
 * Run the full package license check.
 *
 * The helper verifies an optional token, evaluates the status, emits the
 * package nag warning when appropriate, and memoizes identical package/token
 * pairs so repeated provider initialization stays quiet.
 */
export async function runLicenseCheck(
  options: RunLicenseCheckOptions,
): Promise<LicenseStatus> {
  const key = `${options.package}|${options.token ?? ''}`;
  const cached = done.get(key);
  if (cached !== undefined) {
    // Idempotent: re-running with identical inputs returns the same status
    // that was computed on the first call (not a hard-coded 'licensed').
    return cached;
  }

  const nowSec = options.nowSec ?? Math.floor(Date.now() / 1000);
  const verify = options.token
    ? await verifyLicense(options.token, options.publicKey)
    : undefined;
  const evaluated = evaluateLicense(verify, {
    nowSec,
    isNoncommercial: options.isNoncommercial,
  });

  emitNag(evaluated, { package: options.package, warn: options.warn });

  done.set(key, evaluated.status);
  return evaluated.status;
}

/** @internal testing hook only. */
export function __resetRunLicenseCheckStateForTests(): void {
  done.clear();
}
