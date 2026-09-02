import { timingSafeEqual } from 'node:crypto';

export function hasExactBearerToken(
  authorization: string | undefined,
  secret: string | undefined
): boolean {
  if (!authorization || !secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`, 'utf8');
  const actual = Buffer.from(authorization, 'utf8');
  return (
    expected.byteLength === actual.byteLength &&
    timingSafeEqual(expected, actual)
  );
}
