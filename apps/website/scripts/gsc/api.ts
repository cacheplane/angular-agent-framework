// SPDX-License-Identifier: MIT
import { getAccessToken } from './auth';

const BASE = 'https://www.googleapis.com/webmasters/v3';
const INSPECT_URL = 'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect';

export type Dimension = 'query' | 'page' | 'country' | 'device' | 'date' | 'searchAppearance';

export interface SearchAnalyticsRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export function getSiteUrl(): string {
  return process.env['GSC_SITE_URL'] ?? 'sc-domain:threadplane.ai';
}

async function authedFetch(url: string, init: RequestInit & { token: string }): Promise<unknown> {
  const { token, ...rest } = init;
  const response = await fetch(url, {
    ...rest,
    headers: { ...(rest.headers ?? {}), authorization: `Bearer ${token}`, 'content-type': 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`${url} → ${response.status} ${await response.text()}`);
  }
  return response.json();
}

/**
 * Search Analytics. NOTE: `type` accepts only web|image|video|news|discover|
 * googleNews. There is no AI Overviews / AI Mode type as of 2026-08.
 */
export async function querySearchAnalytics(options: {
  startDate: string;
  endDate: string;
  dimensions: Dimension[];
  rowLimit?: number;
  startRow?: number;
  type?: 'web' | 'image' | 'video' | 'news' | 'discover' | 'googleNews';
}): Promise<SearchAnalyticsRow[]> {
  const token = await getAccessToken();
  const site = encodeURIComponent(getSiteUrl());
  const rows: SearchAnalyticsRow[] = [];
  let startRow = options.startRow ?? 0;
  const rowLimit = options.rowLimit ?? 25000;

  for (;;) {
    const page = (await authedFetch(`${BASE}/sites/${site}/searchAnalytics/query`, {
      token,
      method: 'POST',
      body: JSON.stringify({
        startDate: options.startDate,
        endDate: options.endDate,
        dimensions: options.dimensions,
        type: options.type ?? 'web',
        rowLimit,
        startRow,
        dataState: 'all',
      }),
    })) as { rows?: SearchAnalyticsRow[] };
    const batch = page.rows ?? [];
    rows.push(...batch);
    if (batch.length < rowLimit) break;
    startRow += rowLimit;
  }
  return rows;
}

export async function listSitemaps(): Promise<unknown> {
  const token = await getAccessToken();
  return authedFetch(`${BASE}/sites/${encodeURIComponent(getSiteUrl())}/sitemaps`, {
    token,
    method: 'GET',
  });
}

export interface InspectionResult {
  url: string;
  verdict: string;
  coverageState: string;
  lastCrawlTime: string | null;
  robotsTxtState: string;
  indexingState: string;
  googleCanonical: string | null;
  userCanonical: string | null;
}

/**
 * A URL Inspection call that failed during a pull. Serialization contract:
 * `pull.ts` writes these to `.gsc/inspection-errors.json`, `report.ts` reads
 * them back — so the shape lives here, next to InspectionResult, rather than
 * being restated at each end.
 */
export interface InspectionFailure {
  url: string;
  error: string;
}

export async function inspectUrl(inspectionUrl: string): Promise<InspectionResult> {
  const token = await getAccessToken();
  const raw = (await authedFetch(INSPECT_URL, {
    token,
    method: 'POST',
    body: JSON.stringify({ inspectionUrl, siteUrl: getSiteUrl(), languageCode: 'en-US' }),
  })) as {
    inspectionResult?: {
      indexStatusResult?: Record<string, string | undefined>;
    };
  };
  const status = raw.inspectionResult?.indexStatusResult ?? {};
  return {
    url: inspectionUrl,
    verdict: status['verdict'] ?? 'UNKNOWN',
    coverageState: status['coverageState'] ?? 'UNKNOWN',
    lastCrawlTime: status['lastCrawlTime'] ?? null,
    robotsTxtState: status['robotsTxtState'] ?? 'UNKNOWN',
    indexingState: status['indexingState'] ?? 'UNKNOWN',
    googleCanonical: status['googleCanonical'] ?? null,
    userCanonical: status['userCanonical'] ?? null,
  };
}
