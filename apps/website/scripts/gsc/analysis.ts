// SPDX-License-Identifier: MIT
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

/** Sitemap URLs Google never showed for anything in the window. */
export function findZeroImpressionPages(
  sitemapUrls: string[],
  pageRows: SearchAnalyticsRow[],
): string[] {
  const seen = new Set(pageRows.map((row) => row.keys[0].replace(/\/$/, '')));
  return sitemapUrls.filter((url) => !seen.has(url.replace(/\/$/, '')));
}

/** Inspections that are not cleanly indexed. */
export function findUnindexed(inspections: InspectionResult[]): InspectionResult[] {
  return inspections.filter((inspection) => inspection.verdict !== 'PASS');
}

/** Pages Google canonicalized somewhere other than where we asked — duplicate-content smell. */
export function findCanonicalMismatches(inspections: InspectionResult[]): InspectionResult[] {
  return inspections.filter(
    (inspection) =>
      inspection.googleCanonical !== null &&
      inspection.userCanonical !== null &&
      inspection.googleCanonical !== inspection.userCanonical,
  );
}

/** Queries with strong impressions but a CTR well below the position-typical rate. */
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
