import fs from 'node:fs';
import path from 'node:path';
import type { InspectionFailure, InspectionResult, SearchAnalyticsRow } from './api';
import {
  capList,
  describeInspectionCoverage,
  findCanonicalMismatches,
  findStrikingDistance,
  findUnindexed,
  findWeakCtr,
  findZeroImpressionPages,
} from './analysis';
import { read, readOptional } from './snapshots';

const DIR = path.join(process.cwd(), 'apps', 'website', '.gsc');

/** Longest any bullet list in the report gets before it is trimmed with a count. */
const LIST_LIMIT = 20;

function table(rows: SearchAnalyticsRow[], headers: string[], limit = 30): string {
  const head = `| ${headers.join(' | ')} |\n| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows
    .slice(0, limit)
    .map(
      (row) =>
        `| ${row.keys.join(' | ')} | ${row.clicks} | ${row.impressions} | ${(row.ctr * 100).toFixed(1)}% | ${row.position.toFixed(1)} |`,
    )
    .join('\n');
  return `${head}\n${body}`;
}

/** A `###` heading over a capped bullet list, or `_none_` when there is nothing to say. */
function bulletSection(heading: string, items: string[]): string[] {
  if (items.length === 0) {
    return [`### ${heading}`, ``, `_none_`, ``];
  }
  const { shown, remaining } = capList(items, LIST_LIMIT);
  return [
    `### ${heading}`,
    ``,
    shown.map((item) => `- ${item}`).join('\n'),
    ...(remaining > 0 ? [``, `_…and ${remaining} more._`] : []),
    ``,
  ];
}

function main(): void {
  const meta = read<{ startDate: string; endDate: string }>(DIR, 'meta.json');
  const queries = read<SearchAnalyticsRow[]>(DIR, 'queries.json');
  const pages = read<SearchAnalyticsRow[]>(DIR, 'pages.json');
  const inspections = read<InspectionResult[]>(DIR, 'inspections.json');
  const failures = readOptional<InspectionFailure[]>(DIR, 'inspection-errors.json') ?? [];
  // Sitemap inventory = URLs we inspected PLUS URLs we failed to inspect, so a
  // failed URL still reaches the zero-impression analysis instead of vanishing.
  const sitemapUrls = [...inspections.map((i) => i.url), ...failures.map((f) => f.url)];

  const totals = queries.reduce(
    (acc, row) => ({
      clicks: acc.clicks + row.clicks,
      impressions: acc.impressions + row.impressions,
    }),
    { clicks: 0, impressions: 0 },
  );

  const unindexed = findUnindexed(inspections);
  const mismatches = findCanonicalMismatches(inspections);
  const orphans = findZeroImpressionPages(sitemapUrls, pages);

  const report = [
    `# threadplane.ai — Search Console report`,
    ``,
    `Window: ${meta.startDate} → ${meta.endDate}. Total clicks ${totals.clicks}, impressions ${totals.impressions}.`,
    ``,
    `> Google's AI Overviews / AI Mode impressions are NOT included — that report is UI-only.`,
    `> See docs/gtm/ai-search-measurement.md.`,
    ``,
    `## Index health`,
    ``,
    describeInspectionCoverage({ inspected: inspections.length, failed: failures.length }),
    ``,
    `- Sitemap URLs inspected: ${inspections.length}`,
    `- Inspections that failed: ${failures.length}`,
    `- Not cleanly indexed: ${unindexed.length}`,
    `- Google canonical ≠ our canonical: ${mismatches.length}`,
    `- Zero-impression pages in window: ${orphans.length}`,
    ``,
    // Only rendered on a partial sweep; a clean run should not carry an empty section.
    ...(failures.length > 0
      ? bulletSection(
          'Failed inspections',
          failures.map((failure) => `${failure.url} — ${failure.error}`),
        )
      : []),
    ...bulletSection(
      'Not indexed',
      unindexed.map((i) => `${i.url} — ${i.coverageState}`),
    ),
    ...bulletSection(
      'Canonical mismatches',
      mismatches.map((i) => `${i.url} → Google chose ${i.googleCanonical}`),
    ),
    ...bulletSection('Zero-impression pages', orphans),
    `## Striking distance (position 5–20, ≥50 impressions)`,
    ``,
    table(findStrikingDistance(queries, { minImpressions: 50 }), [
      'Query',
      'Clicks',
      'Impr',
      'CTR',
      'Pos',
    ]),
    ``,
    `## Weak CTR on page one (≥100 impressions, CTR < 2%)`,
    ``,
    `Title/description rewrite candidates. The threshold is flat across positions 1–10 — read the Pos column before acting.`,
    ``,
    table(findWeakCtr(queries, { minImpressions: 100, maxCtr: 0.02 }), [
      'Query',
      'Clicks',
      'Impr',
      'CTR',
      'Pos',
    ]),
    ``,
    `## Top pages`,
    ``,
    table(pages, ['Page', 'Clicks', 'Impr', 'CTR', 'Pos']),
    ``,
  ].join('\n');

  fs.writeFileSync(path.join(DIR, 'report.md'), report);
  console.log('wrote .gsc/report.md');
}

try {
  main();
} catch (error) {
  // The likely failures here are "you have not run the pull yet" and "a snapshot
  // is corrupt", both of which read better as one line than as a stack trace.
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
