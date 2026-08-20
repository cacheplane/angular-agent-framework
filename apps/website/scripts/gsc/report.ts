// SPDX-License-Identifier: MIT
import fs from 'node:fs';
import path from 'node:path';
import type { InspectionResult, SearchAnalyticsRow } from './api';
import {
  capList,
  describeInspectionCoverage,
  findCanonicalMismatches,
  findStrikingDistance,
  findUnindexed,
  findWeakCtr,
  findZeroImpressionPages,
} from './analysis';

const DIR = path.join(process.cwd(), 'apps', 'website', '.gsc');

/** A URL Inspection call that failed during the pull, as recorded by pull.ts. */
interface InspectionFailure {
  url: string;
  error: string;
}

function read<T>(name: string): T {
  return JSON.parse(fs.readFileSync(path.join(DIR, name), 'utf8')) as T;
}

/** Like `read`, for a file the pull only writes on a partial sweep. Absent is null; nothing else is swallowed. */
function readOptional<T>(name: string): T | null {
  try {
    return read<T>(name);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

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

function main(): void {
  const meta = read<{ startDate: string; endDate: string }>('meta.json');
  const queries = read<SearchAnalyticsRow[]>('queries.json');
  const pages = read<SearchAnalyticsRow[]>('pages.json');
  const inspections = read<InspectionResult[]>('inspections.json');
  const failures = readOptional<InspectionFailure[]>('inspection-errors.json') ?? [];
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
  const failed = capList(
    failures.map((failure) => `${failure.url} — ${failure.error}`),
    20,
  );

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
    ...(failures.length > 0
      ? [
          `### Failed inspections`,
          ``,
          failed.shown.map((line) => `- ${line}`).join('\n'),
          ...(failed.remaining > 0 ? [``, `_…and ${failed.remaining} more._`] : []),
          ``,
        ]
      : []),
    `### Not indexed`,
    ``,
    unindexed.length ? unindexed.map((i) => `- ${i.url} — ${i.coverageState}`).join('\n') : '_none_',
    ``,
    `### Canonical mismatches`,
    ``,
    mismatches.length
      ? mismatches.map((i) => `- ${i.url} → Google chose ${i.googleCanonical}`).join('\n')
      : '_none_',
    ``,
    `### Zero-impression pages`,
    ``,
    orphans.length ? orphans.map((url) => `- ${url}`).join('\n') : '_none_',
    ``,
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
    `Title/description rewrite candidates.`,
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
    table(pages.slice(0, 30), ['Page', 'Clicks', 'Impr', 'CTR', 'Pos']),
    ``,
  ].join('\n');

  fs.writeFileSync(path.join(DIR, 'report.md'), report);
  console.log('wrote .gsc/report.md');
}

main();
