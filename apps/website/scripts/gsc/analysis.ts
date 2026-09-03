import type { InspectionResult, SearchAnalyticsRow } from './api';

/** Queries ranking just off page one — the cheapest ranking wins available. */
export function findStrikingDistance(
  rows: SearchAnalyticsRow[],
  options: { minImpressions: number },
): SearchAnalyticsRow[] {
  return rows
    .filter(
      (row) =>
        row.position >= 5 && row.position <= 20 && row.impressions >= options.minImpressions,
    )
    .sort((a, b) => b.impressions - a.impressions);
}

/**
 * Reduce a URL to the identity we compare on: no protocol, no `www.`, lowercased
 * host, no trailing slash, no fragment, and NO QUERY STRING.
 *
 * Dropping the query string is a judgement call. Search Console's `page`
 * dimension reports campaign- and referral-tagged URLs (`/blog/foo?ref=x`)
 * that never appear in sitemap `<loc>` entries, and treating those as separate
 * pages would report a page with real impressions as invisible. The cost is
 * that a site where the query string genuinely selects content (`?page=2`,
 * `?id=`) would collapse distinct pages together; threadplane.ai has no such
 * routes. Total function — unparseable input falls back to a textual cleanup
 * rather than throwing, since a single odd row must not kill the report.
 */
export function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  try {
    const url = new URL(trimmed);
    return `${url.hostname.toLowerCase().replace(/^www\./, '')}${url.pathname.replace(/\/$/, '')}`;
  } catch {
    return trimmed
      .toLowerCase()
      .replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
      .replace(/^www\./, '')
      .replace(/[?#].*$/, '')
      .replace(/\/$/, '');
  }
}

/** Sitemap URLs Google never showed for anything in the window. */
export function findZeroImpressionPages(
  sitemapUrls: string[],
  pageRows: SearchAnalyticsRow[],
): string[] {
  const seen = new Set(pageRows.map((row) => normalizeUrl(row.keys[0])));
  return sitemapUrls.filter((url) => !seen.has(normalizeUrl(url)));
}

/** Inspections that are not cleanly indexed. */
export function findUnindexed(inspections: InspectionResult[]): InspectionResult[] {
  return inspections.filter((inspection) => inspection.verdict !== 'PASS');
}

/**
 * Pages Google canonicalized somewhere other than where we asked — duplicate-content smell.
 *
 * Policy: BOTH canonicals must be present. A page where Google reports a
 * canonical but `userCanonical` is null (i.e. we emitted no `<link rel=canonical>`)
 * is deliberately NOT flagged here — it is a finding in its own right, but a
 * different one, and folding it in would make "mismatch" mean two things. It is
 * still visible in the raw `.gsc/inspections.json` snapshot.
 */
export function findCanonicalMismatches(inspections: InspectionResult[]): InspectionResult[] {
  return inspections.filter(
    (inspection) =>
      inspection.googleCanonical !== null &&
      inspection.userCanonical !== null &&
      inspection.googleCanonical !== inspection.userCanonical,
  );
}

/**
 * Queries with strong impressions that sit on page one yet convert below one
 * flat CTR threshold.
 *
 * Limitation: the threshold does not vary with position, so a 1.9% CTR at
 * position 1 (alarming) is reported identically to 1.9% at position 10
 * (unremarkable). Read the Pos column before acting; ranking the output by
 * position-relative expected CTR would need a baseline curve we do not have.
 */
export function findWeakCtr(
  rows: SearchAnalyticsRow[],
  options: { minImpressions: number; maxCtr: number },
): SearchAnalyticsRow[] {
  return rows
    .filter(
      (row) =>
        row.impressions >= options.minImpressions &&
        row.position <= 10 &&
        row.ctr < options.maxCtr,
    )
    .sort((a, b) => b.impressions - a.impressions);
}

/**
 * How complete an inspection sweep was. `pull.ts` records every URL Inspection
 * failure in `inspection-errors.json`, so a sweep can cover fewer URLs than the
 * sitemap lists — in which case every index-health count is a lower bound and
 * the report has to say so rather than imply a clean bill of health.
 */
export function describeInspectionCoverage(counts: { inspected: number; failed: number }): string {
  const total = counts.inspected + counts.failed;
  if (counts.failed === 0) {
    return `Coverage: complete — all ${total} sitemap URLs inspected.`;
  }
  return (
    `Coverage: PARTIAL — ${counts.failed} of ${total} sitemap URLs could not be inspected. ` +
    `Every count below is a lower bound: an uninspected page may also be unindexed or canonicalized elsewhere.`
  );
}

/** Trim a list for display, reporting how much was withheld. */
export function capList(items: string[], limit: number): { shown: string[]; remaining: number } {
  return { shown: items.slice(0, limit), remaining: Math.max(0, items.length - limit) };
}
