// SPDX-License-Identifier: MIT
let cached: string | null = null;

export function getCockpitSessionId(): string {
  if (!cached) cached = `cockpit_${crypto.randomUUID()}`;
  return cached;
}

// @internal — for tests only
export function _resetCockpitSessionIdForTesting(): void {
  cached = null;
}
