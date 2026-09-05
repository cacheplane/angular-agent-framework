import { createHash, createHmac } from 'node:crypto';
import {
  createEmailLookupCandidates,
  type EmailHmacKeyring,
} from '../crypto.ts';
import { ObservationError } from './contracts.ts';

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value))
    return '[' + value.map(canonicalJson).join(',') + ']';
  if (value !== null && typeof value === 'object') {
    return (
      '{' +
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, item]) => JSON.stringify(key) + ':' + canonicalJson(item))
        .join(',') +
      '}'
    );
  }
  const result = JSON.stringify(value);
  if (result === undefined) throw new ObservationError('invalid_payload');
  return result;
}
export function publicDigest(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}
export function identityDigest(
  value: unknown,
  keyring: EmailHmacKeyring,
  version = keyring.active.version
): string {
  createEmailLookupCandidates('key-check@example.invalid', keyring);
  const key = [keyring.active, ...(keyring.previous ?? [])].find(
    (k) => k.version === version
  );
  if (!key) throw new ObservationError('identity_key_unavailable');
  return createHmac('sha256', key.secret)
    .update('growth-observation-identity-v1\0')
    .update(canonicalJson(value))
    .digest('hex');
}
