// SPDX-License-Identifier: MIT

/**
 * Claims that must not reach public output.
 *
 * Each asserts something absolute about behavior that nothing keeps true, and
 * a published guarantee that quietly stops holding is worse than none. They
 * are barred from generated docs for the same reason they are barred from
 * hand-authored copy — see `src/lib/public-copy.spec.ts`.
 *
 * Sentence-anchored so a whole claim is removed rather than leaving a fragment.
 * No trailing lookahead: in serialized JSON a sentence ends at a quote, not at
 * whitespace, and the backstop below has to match there too.
 */
export const BLOCKED_PUBLIC_CLAIMS: readonly RegExp[] = [
  /\s*\bNo telemetry is emitted[^.]*\./giu,
  /\s*\bInstallation is inert[^.]*\./giu,
  /\s*\b[^.]*\bphon(?:e|ing) home[^.]*\./giu,
  /\s*\b[^.]*\boff by default[^.]*\./giu,
  /\s*\bWe (?:never|do not) collect[^.]*\./giu,
];

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

function stripClaims(value: string): string {
  let result = value;
  for (const pattern of BLOCKED_PUBLIC_CLAIMS) {
    result = result.replace(new RegExp(pattern.source, pattern.flags), '');
  }
  return result.trim();
}

function project(value: JsonValue): JsonValue {
  if (typeof value === 'string') return stripClaims(value);
  if (Array.isArray(value)) return value.map(project);
  if (value !== null && typeof value === 'object') {
    const copy: { [key: string]: JsonValue } = {};
    for (const [key, entry] of Object.entries(value)) {
      copy[key] = project(entry);
    }
    return copy;
  }
  return value;
}

/**
 * Project generated TypeDoc entries into what the website may publish.
 *
 * Names, types, structure, and every other description survive verbatim: this
 * is a copy boundary, not an API boundary. Renaming `AgentRuntimeTelemetry*`,
 * a config field, or a package export would make the published docs disagree
 * with the shipped types, which is a worse failure than an unwanted sentence.
 *
 * Pure — the input is never mutated.
 */
export function projectPublicDocEntries<Entry>(entries: readonly Entry[]): Entry[] {
  return project(
    JSON.parse(JSON.stringify(entries)) as JsonValue
  ) as unknown as Entry[];
}

/**
 * Fail the generator rather than write output carrying a barred claim.
 *
 * The projection above is the intended path; this is the backstop for a claim
 * phrased in a way the patterns above only partially match, so the failure
 * lands at generation time instead of on the published site.
 */
export function assertPublicDocOutput(label: string, serialized: string): void {
  for (const pattern of BLOCKED_PUBLIC_CLAIMS) {
    const match = serialized.match(new RegExp(pattern.source, pattern.flags));
    if (match) {
      throw new Error(
        `${label}: generated public docs contain a barred claim: ${match[0].trim()}`
      );
    }
  }
}
