// SPDX-License-Identifier: MIT

/**
 * What the public surfaces of this site may and may not say.
 *
 * One definition, consumed by both the source scan (`public-copy.spec.ts`) and
 * the production crawl (`e2e/public-copy.spec.ts`). Two lists would drift, and
 * the drift would land on the side that is harder to notice: the deployed one.
 */

/**
 * Claims this site does not make.
 *
 * Each asserts something absolute about behavior that nothing keeps true. A
 * published guarantee that quietly stops holding is worse than no guarantee,
 * so `/privacy` describes categories and purposes instead.
 */
export const BANNED_CLAIMS: ReadonlyArray<readonly [string, RegExp]> = [
  ['phone-home claim', /phon(?:e|ing) home/iu],
  ['installation inertness claim', /installation is inert/iu],
  ['off-by-default claim', /off by default/iu],
  ['what-we-wont-do positioning', /what we (?:won'|won’|will not )t? ?do/iu],
  ['nothing-emitted guarantee', /no telemetry is emitted/iu],
  ['never-collected list', /we (?:never|do not) collect/iu],
];

/**
 * Narrative uses of the word, as distinct from the identifier.
 *
 * `telemetry` is the real name of a public config field on `provideAgent()`,
 * `toAgent()`, and both `AgentConfig` types. Banning the word outright would
 * force the API tables to either lie or omit a shipped option, so what is
 * barred is the prose that markets it — not the field itself.
 */
export const NARRATIVE_MENTIONS: ReadonlyArray<readonly [string, RegExp]> = [
  ['opt-in telemetry positioning', /telemetry is opt-in/iu],
  ['browser-telemetry positioning', /browser telemetry/iu],
  ['debugging-and-telemetry aside', /for debugging and telemetry/iu],
  ['we-have-telemetry framing', /we have telemetry/iu],
  ['telemetry hooks aside', /telemetry hooks/iu],
];

/** Routes retired in favour of the canonical policy. */
export const RETIRED_ROUTE_PATTERN = /\/docs\/telemetry|\/api\/markdown\/telemetry/u;

/**
 * Public routes that are intentionally absent from the sitemap.
 *
 * The crawl walks the sitemap, so anything not indexed is invisible to it. A
 * new public route — `/connect`, say — belongs here in the same change that
 * creates it, or it ships unchecked.
 */
export const NON_INDEXED_PUBLIC_ROUTES: readonly string[] = [
  '/AGENTS.md',
  '/CLAUDE.md',
  '/llms.txt',
  '/llms-full.txt',
  '/robots.txt',
  '/api/markdown/langgraph/getting-started/introduction',
  '/api/markdown/ag-ui/concepts/architecture',
];

/** Every barred pattern, for callers that do not care which list a hit came from. */
export function allBarredPatterns(): ReadonlyArray<readonly [string, RegExp]> {
  return [...BANNED_CLAIMS, ...NARRATIVE_MENTIONS];
}

/** Report each barred phrase found in `source`, with its line number. */
export function findBarredCopy(
  source: string,
  patterns: ReadonlyArray<readonly [string, RegExp]> = allBarredPatterns()
): string[] {
  const hits: string[] = [];
  source.split('\n').forEach((line, index) => {
    for (const [label, pattern] of patterns) {
      if (pattern.test(line)) hits.push(`line ${index + 1}: ${label}`);
    }
  });
  return hits;
}
