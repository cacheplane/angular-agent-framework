import { randomUUID } from 'node:crypto';

let cached: string | null = null;

export function getAnonId(): string {
  if (!cached) cached = `anon_${randomUUID()}`;
  return cached;
}

// @internal — for tests only
export function _resetAnonIdForTesting(): void {
  cached = null;
}
