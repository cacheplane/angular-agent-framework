/**
 * Query tokenisation, shared by the client-side instant matcher and the
 * server search route.
 *
 * It lives here rather than in the component because both sides must agree on
 * what a query means. Two copies would drift the first time a stop word is
 * added, and the symptom — the same query behaving differently in the instant
 * results than in the server results — is very hard to read.
 */
export const SEARCH_STOP_WORDS = new Set([
  'a', 'an', 'and', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'with',
]);

export function searchTokens(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9@.-]+/)
    .filter((token) => token.length > 0 && !SEARCH_STOP_WORDS.has(token));
}
