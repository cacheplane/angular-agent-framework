// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { verifyLicense } from './verify-license';
import { evaluateLicense, type LicenseStatus } from './evaluate-license';
import { emitNag } from './nag';
import { createTelemetryClient } from './telemetry';

export interface RunLicenseCheckOptions {
  /** Fully-qualified host package name. */
  package: string;
  /** Host package version (e.g., "1.0.0"). */
  version: string;
  /** User-supplied license token, or undefined. */
  token?: string;
  /** Ed25519 public key to verify against. */
  publicKey: Uint8Array;
  /** Telemetry endpoint URL. */
  telemetryEndpoint: string;
  /** Current time in epoch seconds. Defaults to now. Injected for testability. */
  nowSec?: number;
  /** Hint that the environment is noncommercial (e.g. NODE_ENV !== 'production'). */
  isNoncommercial?: boolean;
  /** Injected warn channel, defaults to console.warn. */
  warn?: (message: string) => void;
  /** Injected fetch, defaults to globalThis.fetch. */
  fetch?: typeof fetch;
}

const done = new Set<string>();

export async function runLicenseCheck(
  options: RunLicenseCheckOptions,
): Promise<LicenseStatus> {
  const key = `${options.package}|${options.token ?? ''}`;
  if (done.has(key)) {
    // Idempotent: re-running with identical inputs is a no-op.
    return 'licensed';
  }
  done.add(key);

  const nowSec = options.nowSec ?? Math.floor(Date.now() / 1000);
  const verify = options.token
    ? await verifyLicense(options.token, options.publicKey)
    : undefined;
  const evaluated = evaluateLicense(verify, {
    nowSec,
    isNoncommercial: options.isNoncommercial,
  });

  emitNag(evaluated, { package: options.package, warn: options.warn });

  const telemetry = createTelemetryClient({
    endpoint: options.telemetryEndpoint,
    fetch: options.fetch,
  });
  // Fire-and-forget; do not await the host's init on it.
  void telemetry.send({
    package: options.package,
    version: options.version,
    licenseId: evaluated.claims?.sub,
  });

  return evaluated.status;
}

/** @internal testing hook only. */
export function __resetRunLicenseCheckStateForTests(): void {
  done.clear();
}
