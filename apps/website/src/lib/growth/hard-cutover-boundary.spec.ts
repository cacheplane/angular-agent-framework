import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));

const ROUTES = [
  'whitepaper-signup',
  'newsletter',
  'leads',
] as const;

const FORBIDDEN: ReadonlyArray<readonly [string, RegExp]> = [
  ['filesystem persistence', /from ['"](?:node:)?fs['"]/u],
  ['Loops', /lib\/loops/u],
  ['legacy Resend transport', /lib\/resend/u],
  ['legacy drip scheduler', /lib\/drip/u],
  ['whitepaper drip scheduling', /scheduleWhitepaperDrip/u],
  ['Resend audience upsert', /addToAudience/u],
  ['direct request-time sending', /sendEmail\(/u],
  ['NDJSON lead storage', /\.ndjson/u],
  ['legacy handler', /legacyPost/u],
];

function routeSource(route: string): string {
  return readFileSync(
    join(HERE, '..', '..', 'app', 'api', route, 'route.ts'),
    'utf8'
  );
}

describe('hard-cutover form boundary', () => {
  it.each(ROUTES)(
    '/api/%s accepts submissions through Neon only',
    (route) => {
      const source = routeSource(route);

      for (const [label, pattern] of FORBIDDEN) {
        expect(
          pattern.test(source),
          `/api/${route} must not reference ${label}`
        ).toBe(false);
      }
    }
  );

  it.each(ROUTES)(
    '/api/%s commits through the growth form route seam',
    (route) => {
      const source = routeSource(route);

      expect(source).toContain('lib/growth/form-route');
      expect(source).toContain('dependencies.accept(');
      expect(source).toContain('dependencies.nudge(');
    }
  );
});
