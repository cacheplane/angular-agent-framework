// SPDX-License-Identifier: MIT
import fs from 'node:fs';
import path from 'node:path';
import {
  inspectUrl,
  listSitemaps,
  querySearchAnalytics,
  type InspectionFailure,
  type InspectionResult,
} from './api';

const OUT_DIR = path.join(process.cwd(), 'apps', 'website', '.gsc');

function isoDaysAgo(days: number): string {
  const date = new Date(Date.now() - days * 86_400_000);
  return date.toISOString().slice(0, 10);
}

function write(name: string, value: unknown): void {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, name), JSON.stringify(value, null, 2));
  console.log(`wrote .gsc/${name}`);
}

async function sitemapUrls(): Promise<string[]> {
  const response = await fetch('https://threadplane.ai/sitemap.xml');
  if (!response.ok) {
    throw new Error(`sitemap fetch failed: ${response.status} ${response.statusText}`);
  }
  const xml = await response.text();
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  if (urls.length === 0) {
    throw new Error('sitemap.xml matched zero <loc> entries; treating as a broken fetch, not empty inventory.');
  }
  return urls;
}

async function main(): Promise<void> {
  // Search Analytics data lags ~2 days; end 3 days back for a stable window.
  const endDate = isoDaysAgo(3);
  const startDate = isoDaysAgo(93);

  write('meta.json', { startDate, endDate, pulledAt: new Date().toISOString() });
  write('queries.json', await querySearchAnalytics({ startDate, endDate, dimensions: ['query'] }));
  write('pages.json', await querySearchAnalytics({ startDate, endDate, dimensions: ['page'] }));
  write(
    'query-page.json',
    await querySearchAnalytics({ startDate, endDate, dimensions: ['query', 'page'] }),
  );
  write('dates.json', await querySearchAnalytics({ startDate, endDate, dimensions: ['date'] }));
  write(
    'discover.json',
    await querySearchAnalytics({ startDate, endDate, dimensions: ['page'], type: 'discover' }),
  );
  write('sitemaps.json', await listSitemaps());

  // URL Inspection is quota-limited (2000/day, 600/min). Serialize with a small delay.
  // Failures are collected separately rather than dropped or faked, so a partial
  // sweep still yields a usable inspections.json plus a visible error trail.
  const urls = await sitemapUrls();
  const inspections: InspectionResult[] = [];
  const failures: InspectionFailure[] = [];
  for (const [index, url] of urls.entries()) {
    try {
      inspections.push(await inspectUrl(url));
    } catch (error) {
      failures.push({ url, error: error instanceof Error ? error.message : String(error) });
    }
    const done = index + 1;
    if (done % 25 === 0 || done === urls.length) {
      console.log(`inspected ${done}/${urls.length} urls`);
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  write('inspections.json', inspections);
  if (failures.length > 0) {
    write('inspection-errors.json', failures);
  }
  console.log(
    `inspected ${inspections.length}/${urls.length} urls, ${failures.length} failed` +
      (failures.length > 0 ? ' (see .gsc/inspection-errors.json)' : ''),
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
