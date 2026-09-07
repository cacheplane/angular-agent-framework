import 'server-only';

// The website consumes Growth through its internal boundary.
// eslint-disable-next-line @nx/enforce-module-boundaries
import { parseEmailHmacKeyring } from '@threadplane-internal/growth';

export function loadEmailHmacKeyring(
  environment: Readonly<Record<string, string | undefined>> = process.env
) {
  return parseEmailHmacKeyring(environment);
}
