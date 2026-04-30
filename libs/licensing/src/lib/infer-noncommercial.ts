// SPDX-License-Identifier: MIT

/**
 * Heuristic default for the `isNoncommercial` flag in `runLicenseCheck`.
 *
 * Returns `true` when `process.env.NODE_ENV` is anything other than
 * `"production"` — treating dev/test/CI builds as noncommercial so the
 * license nag stays quiet. Returns `false` when there is no `process`
 * global (browser-like environments without a dev shim), which is the
 * safe default for production bundles.
 *
 * Callers can always override via the `isNoncommercial` option on
 * `runLicenseCheck`; this is only the fallback.
 */
export function inferNoncommercial(): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proc = (globalThis as any)['process'];
  if (proc && proc.env) {
    return proc.env['NODE_ENV'] !== 'production';
  }
  return false;
}
