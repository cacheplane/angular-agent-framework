// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { EvaluateResult } from './evaluate-license.js';

export interface EmitNagOptions {
  /** Fully-qualified npm package name, e.g. "@cacheplane/angular". */
  package: string;
  /** Injected warn channel; defaults to `console.warn`. */
  warn?: (message: string) => void;
}

const seen = new Set<string>();

const MESSAGES: Record<string, string> = {
  missing:
    'no license key detected. The library will keep running, but please get a license at https://cacheplane.dev/pricing',
  grace:
    'license is expired and within the 14-day grace window. Renew at https://cacheplane.dev/pricing',
  expired:
    'license is expired. The library will keep running, but please renew at https://cacheplane.dev/pricing',
  tampered:
    'license signature is invalid or malformed. Download a fresh key from https://cacheplane.dev/pricing',
};

export function emitNag(
  result: Pick<EvaluateResult, 'status'>,
  options: EmitNagOptions,
): void {
  const warn = options.warn ?? ((m: string) => console.warn(m));
  const { status } = result;
  if (status === 'licensed' || status === 'noncommercial') return;

  const key = `${options.package}|${status}`;
  if (seen.has(key)) return;
  seen.add(key);

  const body = MESSAGES[status] ?? 'license check failed.';
  warn(`[cacheplane] ${options.package}: ${body}`);
}

/** @internal testing hook only. */
export function __resetNagStateForTests(): void {
  seen.clear();
}
