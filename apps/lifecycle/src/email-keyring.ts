import { parseEmailHmacKeyring } from './growth.js';

// Load lazily so disabled activation does not require identity credentials.
export function loadEmailHmacKeyring(
  environment: Readonly<Record<string, string | undefined>> = process.env
) {
  return parseEmailHmacKeyring(environment);
}
