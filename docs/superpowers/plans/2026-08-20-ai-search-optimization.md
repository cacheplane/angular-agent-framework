# AI Search Optimization (threadplane.ai) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make threadplane.ai maximally eligible for, and measurable in, Google's generative AI search surfaces (AI Overviews, AI Mode, Discover) plus third-party AI answer engines — by fixing the technical-structure gaps Google's AI optimization guide actually calls out, and by standing up a Search Console API analysis harness for ongoing diagnosis.

**Architecture:** Four phases. Phase 1 builds a dependency-free Google Search Console API harness (service-account JWT via `node:crypto` + `fetch`) that pulls Search Analytics, Sitemaps, and URL Inspection data into committed JSON snapshots plus a derived report. Phase 2 fixes the technical-structure gaps found in the audit (no JSON-LD anywhere, no sitemap `lastmod`, no article dates/authors in metadata, one shared OG image, brand-name inconsistency, heading text polluted by anchor glyphs, agent-hostile markup). Phase 3 closes content and E-E-A-T gaps. Phase 4 wires ongoing measurement (AI-crawler and AI-referral tracking through the existing PostHog server client, plus a documented manual export for the Search Console Generative AI report, which is **not** in any API as of 2026-08).

**Tech Stack:** Next.js App Router (`apps/website`), TypeScript, vitest (`apps/website/vite.config.mts`), `tsx` for scripts (already a root devDependency), `posthog-node` (already an `apps/website` dependency), Google Search Console API v3 over raw `fetch`. **No new npm dependencies** — deliberately, because regenerating `package-lock.json` on macOS drops the Linux `@next/swc-*` bindings and breaks CI.

---

## Background: What the audit found

Evidence gathered 2026-08-20 against the live site and `apps/website` on this branch.

**Already good — do not "fix" these:**
- `robots.txt` is fully permissive (`User-agent: * / Allow: /`) and points at the sitemap. All AI crawlers (Google-Extended, GPTBot, ClaudeBot, PerplexityBot) are therefore allowed. Correct posture for AI visibility.
- Sitemap is generated from real route data: 140 URLs (11 static, 3 solutions, ~117 docs, 9 blog).
- Pages are server-rendered with full content in the HTML (home 1,675 words / docs installation 1,985 / blog tutorial 3,103). No JS-SEO problem.
- Canonicals are emitted on every page that goes through `createPageMetadata`.
- Newer blog posts already use question-form H2s (`How do we bind Angular to it?`) — exactly the shape RAG systems extract well.
- All 21 homepage `<img>` tags have `alt`.
- `llms.txt` / `llms-full.txt` exist. Google explicitly says these do **nothing** for Google Search — keep them anyway for non-Google engines, but do not invest further there.

**Gaps this plan fixes:**

| # | Gap | Evidence |
|---|-----|----------|
| G1 | Zero structured data sitewide | `grep -rl "application/ld+json" src lib` → no matches; live HTML `ld+json` count = 0 on home, docs, and blog |
| G2 | Sitemap has no `lastmod` | `src/app/sitemap.ts` emits only `changeFrequency`/`priority` — the two signals Google ignores, and omits the one it uses |
| G3 | Blog metadata has no `publishedTime`, `modifiedTime`, `authors`, or `tags` | `createPageMetadata` in `src/lib/site-metadata.ts` has no article fields |
| G4 | Every page shares one OG image (`/opengraph-image`) | `DEFAULT_SOCIAL_IMAGE` is the only value passed |
| G5 | Brand name inconsistency in titles | blog titles use `— ThreadPlane`, docs use `- Threadplane`, root uses `Threadplane` |
| G6 | Heading text is polluted by the anchor glyph | live docs H2s extract as `#Prerequisites`; `MdxRenderer.tsx:37,43` renders a literal `#` text node *before* the heading text |
| G7 | Blog posts contain zero images/diagrams | live blog HTML: `img` count = 0. Google's guide explicitly asks for high-quality images/video |
| G8 | No author/about surface for E-E-A-T | `blogAuthors` has a bio string but there is no `/about` page and no `Person` entity anywhere |
| G9 | No visibility measurement for AI surfaces | no crawler logging, no AI-referral tracking, no GSC harness |
| G10 | 3 `solutions/*` pages are programmatic and thin | `src/lib/solutions-data.ts` is 9.4 KB total for 3 pages — scaled-content-abuse adjacent if expanded |

**What Google's guide says NOT to do (do not let scope creep add these):**
- No `llms.txt`-style AI-specific files as a *Search* tactic.
- No content "chunking" for retrieval — multi-topic pages are understood fine.
- No AI-specific keyword rewrites; write naturally.
- No pursuit of inauthentic mentions.
- Structured data is *optional* for AI features (it gates rich results). We add it in Phase 2 because it is cheap, it is a rich-result and entity-clarity win, and it costs nothing at runtime — not because it unlocks AI Overviews.

**Deliberately out of scope:** the guide's third pillar — Merchant Center product feeds, Google Business Profile, and the Business Agent / Universal Commerce Protocol surfaces — is aimed at retail and local businesses. Threadplane sells developer licenses through Stripe with no physical location and no product catalog, so none of it applies. This is a scope decision, not an oversight.

**Critical constraint on measurement:** as of 2026-08-11, the Search Console **Generative AI performance report is UI-only**. `searchanalytics.query`'s `type` field still accepts only `web|image|video|news|discover|googleNews`; there is no `aiMode`/`aiOverview` type, no `searchAppearance` value for AI features, and no BigQuery export. Any plan or tool that claims to pull AI Overview impressions programmatically is wrong. Phase 1 therefore uses the API for everything it *can* answer (query/page performance, striking-distance, index coverage), and Phase 4 documents a manual CSV export for the AI report.

---

## File Structure

**Phase 1 — GSC harness (new, self-contained):**
- `apps/website/scripts/gsc/auth.ts` — service-account JWT → access token. Only file that touches crypto.
- `apps/website/scripts/gsc/api.ts` — thin typed wrappers over the four GSC endpoints.
- `apps/website/scripts/gsc/pull.ts` — CLI entrypoint: writes raw snapshots to `apps/website/.gsc/`.
- `apps/website/scripts/gsc/report.ts` — CLI entrypoint: reads snapshots, writes a markdown report. Pure functions, unit-testable.
- `apps/website/scripts/gsc/analysis.ts` — pure analysis functions (no I/O) consumed by `report.ts`.
- `apps/website/scripts/gsc/analysis.spec.ts` — vitest coverage of the analysis functions.
- `apps/website/scripts/gsc/README.md` — service-account setup runbook.

**Phase 2 — site metadata and structured data:**
- `apps/website/src/lib/structured-data.ts` (new) — JSON-LD builders, pure functions.
- `apps/website/src/lib/structured-data.spec.ts` (new).
- `apps/website/src/components/shared/JsonLd.tsx` (new) — one render component.
- `apps/website/src/lib/site-metadata.ts` (modify) — article fields, brand constant, `getSitemapEntries`.
- `apps/website/src/app/sitemap.ts` (modify) — emit `lastModified`.
- `apps/website/src/app/layout.tsx` (modify) — Organization + WebSite JSON-LD.
- `apps/website/src/app/blog/[slug]/page.tsx` (modify) — article metadata + Article/Breadcrumb JSON-LD.
- `apps/website/src/app/blog/[slug]/opengraph-image.tsx` (new) — per-post OG image.
- `apps/website/src/app/docs/[library]/[section]/[slug]/page.tsx` (modify) — TechArticle/Breadcrumb JSON-LD.
- `apps/website/src/components/docs/MdxRenderer.tsx` (modify) — anchor glyph out of heading text.

**Phase 3 — content:**
- `apps/website/src/app/about/page.tsx` (new).
- `apps/website/content/blog/*.mdx` (modify — add diagrams).

**Phase 4 — measurement:**
- `apps/website/src/middleware.ts` (new) — AI crawler + AI referral capture.
- `apps/website/src/lib/analytics/ai-traffic.ts` (new) — pure UA/referrer classification.
- `apps/website/src/lib/analytics/ai-traffic.spec.ts` (new).
- `apps/website/src/lib/analytics/events.ts` (modify) — register the two new events.
- `docs/gtm/ai-search-measurement.md` (new) — the manual GSC AI-report runbook.

---

## Phase 1 — Search Console API analysis harness

### Task 1: Service-account auth

**Files:**
- Create: `apps/website/scripts/gsc/auth.ts`
- Create: `apps/website/scripts/gsc/README.md`

- [ ] **Step 1: Write the setup runbook**

Create `apps/website/scripts/gsc/README.md`:

```markdown
# Search Console API harness

## One-time setup

1. In Google Cloud console, create (or reuse) a project and enable the
   **Google Search Console API** (`searchconsole.googleapis.com`).
2. Create a service account. No project-level IAM roles are needed.
3. Create a JSON key for that service account and download it.
4. In Search Console, open the `threadplane.ai` **Domain property** →
   Settings → Users and permissions → Add user → paste the service
   account's `client_email` → permission **Full** (required: the URL
   Inspection API rejects "Restricted" users).
5. Export the key for local use — do NOT commit it:

   export GSC_SERVICE_ACCOUNT_JSON="$(cat ~/secrets/threadplane-gsc.json)"
   export GSC_SITE_URL="sc-domain:threadplane.ai"

## Usage

    npx tsx apps/website/scripts/gsc/pull.ts        # writes apps/website/.gsc/*.json
    npx tsx apps/website/scripts/gsc/report.ts      # writes apps/website/.gsc/report.md

## What this CANNOT do

The Search Console **Generative AI performance report** (AI Overviews /
AI Mode impressions and clicks) is UI-only as of 2026-08. It is not in
`searchanalytics.query`, not in `searchAppearance`, and not in the
BigQuery bulk export. See `docs/gtm/ai-search-measurement.md` for the
manual export procedure.
```

- [ ] **Step 2: Write the auth module**

Create `apps/website/scripts/gsc/auth.ts`:

```ts
// SPDX-License-Identifier: MIT
import { createSign } from 'node:crypto';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
}

function base64url(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

export function readServiceAccountKey(): ServiceAccountKey {
  const raw = process.env['GSC_SERVICE_ACCOUNT_JSON'];
  if (!raw) {
    throw new Error(
      'GSC_SERVICE_ACCOUNT_JSON is not set. See apps/website/scripts/gsc/README.md.',
    );
  }
  const parsed = JSON.parse(raw) as Partial<ServiceAccountKey>;
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error('GSC_SERVICE_ACCOUNT_JSON is missing client_email or private_key.');
  }
  return { client_email: parsed.client_email, private_key: parsed.private_key };
}

export async function getAccessToken(nowSeconds = Math.floor(Date.now() / 1000)): Promise<string> {
  const key = readServiceAccountKey();
  const signingInput = [
    base64url({ alg: 'RS256', typ: 'JWT' }),
    base64url({
      iss: key.client_email,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: nowSeconds,
      exp: nowSeconds + 3600,
    }),
  ].join('.');
  const signature = createSign('RSA-SHA256')
    .update(signingInput)
    .sign(key.private_key, 'base64url');

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${signingInput}.${signature}`,
    }),
  });

  if (!response.ok) {
    throw new Error(`Token exchange failed: ${response.status} ${await response.text()}`);
  }
  const json = (await response.json()) as { access_token?: string };
  if (!json.access_token) throw new Error('Token exchange returned no access_token.');
  return json.access_token;
}
```

- [ ] **Step 3: Verify auth end to end**

Run (with the env vars from the README exported):

```bash
npx tsx -e "import('./apps/website/scripts/gsc/auth.ts').then(async m => console.log((await m.getAccessToken()).slice(0, 12) + '…'))"
```

Expected: a token prefix like `ya29.c.b49…`. If it returns `401 invalid_grant`, the key is wrong; if the later API calls return `403`, the service account was not added to the Search Console property.

- [ ] **Step 4: Ignore the snapshot directory**

Append to `apps/website/.gitignore` (create the file if absent):

```
.gsc/
```

- [ ] **Step 5: Commit**

```bash
git add apps/website/scripts/gsc/auth.ts apps/website/scripts/gsc/README.md apps/website/.gitignore
git commit -m "feat(website): search console api service-account auth"
```

---

### Task 2: Typed API wrappers

**Files:**
- Create: `apps/website/scripts/gsc/api.ts`

- [ ] **Step 1: Write the API module**

Create `apps/website/scripts/gsc/api.ts`:

```ts
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
```

- [ ] **Step 2: Verify against the live property**

```bash
npx tsx -e "import('./apps/website/scripts/gsc/api.ts').then(async m => console.log(JSON.stringify(await m.listSitemaps(), null, 2)))"
```

Expected: JSON listing `https://threadplane.ai/sitemap.xml` with `lastSubmitted` and `contents`. A `403 User does not have sufficient permission` means step 4 of the README was skipped.

- [ ] **Step 3: Commit**

```bash
git add apps/website/scripts/gsc/api.ts
git commit -m "feat(website): typed search console api wrappers"
```

---

### Task 3: Snapshot puller

**Files:**
- Create: `apps/website/scripts/gsc/pull.ts`

- [ ] **Step 1: Write the puller**

Create `apps/website/scripts/gsc/pull.ts`:

```ts
// SPDX-License-Identifier: MIT
import fs from 'node:fs';
import path from 'node:path';
import { inspectUrl, listSitemaps, querySearchAnalytics } from './api';

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
  const xml = await response.text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
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
  const urls = await sitemapUrls();
  const inspections = [];
  for (const url of urls) {
    inspections.push(await inspectUrl(url));
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  write('inspections.json', inspections);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
```

- [ ] **Step 2: Run the pull**

```bash
npx tsx apps/website/scripts/gsc/pull.ts
```

Expected: eight `wrote .gsc/*.json` lines. The inspection loop takes ~30s for 140 URLs. If `discover.json` comes back empty, that is normal — Discover only reports once the property has Discover impressions.

- [ ] **Step 3: Commit**

```bash
git add apps/website/scripts/gsc/pull.ts
git commit -m "feat(website): search console snapshot puller"
```

---

### Task 4: Analysis + report

**Files:**
- Create: `apps/website/scripts/gsc/analysis.ts`
- Create: `apps/website/scripts/gsc/analysis.spec.ts`
- Create: `apps/website/scripts/gsc/report.ts`
- Modify: `apps/website/vite.config.mts`

- [ ] **Step 1: Widen the vitest include so scripts are tested**

In `apps/website/vite.config.mts`, change:

```ts
    include: ['src/**/*.spec.ts', 'src/**/*.spec.tsx'],
```

to:

```ts
    include: ['src/**/*.spec.ts', 'src/**/*.spec.tsx', 'scripts/**/*.spec.ts'],
```

- [ ] **Step 2: Write the failing test**

Create `apps/website/scripts/gsc/analysis.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { findStrikingDistance, findUnindexed, findZeroImpressionPages } from './analysis';

const rows = [
  { keys: ['angular langgraph chat'], clicks: 0, impressions: 400, ctr: 0, position: 11.2 },
  { keys: ['threadplane'], clicks: 90, impressions: 100, ctr: 0.9, position: 1.1 },
  { keys: ['obscure long tail'], clicks: 0, impressions: 3, ctr: 0, position: 42 },
];

describe('findStrikingDistance', () => {
  it('returns rows ranking 5-20 with meaningful impressions, best opportunity first', () => {
    const result = findStrikingDistance(rows, { minImpressions: 50 });
    expect(result.map((r) => r.keys[0])).toEqual(['angular langgraph chat']);
  });
});

describe('findZeroImpressionPages', () => {
  it('lists sitemap URLs that earned no impressions in the window', () => {
    const result = findZeroImpressionPages(
      ['https://threadplane.ai/a', 'https://threadplane.ai/b'],
      [{ keys: ['https://threadplane.ai/a'], clicks: 1, impressions: 10, ctr: 0.1, position: 5 }],
    );
    expect(result).toEqual(['https://threadplane.ai/b']);
  });
});

describe('findUnindexed', () => {
  it('flags inspections whose verdict is not PASS', () => {
    const result = findUnindexed([
      { url: 'https://threadplane.ai/a', verdict: 'PASS', coverageState: 'Submitted and indexed', lastCrawlTime: null, robotsTxtState: 'ALLOWED', indexingState: 'INDEXING_ALLOWED', googleCanonical: null, userCanonical: null },
      { url: 'https://threadplane.ai/b', verdict: 'NEUTRAL', coverageState: 'Discovered - currently not indexed', lastCrawlTime: null, robotsTxtState: 'ALLOWED', indexingState: 'INDEXING_ALLOWED', googleCanonical: null, userCanonical: null },
    ]);
    expect(result.map((r) => r.url)).toEqual(['https://threadplane.ai/b']);
  });
});
```

- [ ] **Step 3: Run it and confirm it fails**

```bash
npx nx test website
```

Expected: FAIL — `Failed to resolve import "./analysis"`.

- [ ] **Step 4: Write the analysis module**

Create `apps/website/scripts/gsc/analysis.ts`:

```ts
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
        row.position >= 5 &&
        row.position <= 20 &&
        row.impressions >= options.minImpressions,
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
```

- [ ] **Step 5: Run the tests and confirm they pass**

```bash
npx nx test website
```

Expected: PASS.

- [ ] **Step 6: Write the report generator**

Create `apps/website/scripts/gsc/report.ts`:

```ts
// SPDX-License-Identifier: MIT
import fs from 'node:fs';
import path from 'node:path';
import type { InspectionResult, SearchAnalyticsRow } from './api';
import {
  findCanonicalMismatches,
  findStrikingDistance,
  findUnindexed,
  findWeakCtr,
  findZeroImpressionPages,
} from './analysis';

const DIR = path.join(process.cwd(), 'apps', 'website', '.gsc');

function read<T>(name: string): T {
  return JSON.parse(fs.readFileSync(path.join(DIR, name), 'utf8')) as T;
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
  const sitemapUrls = inspections.map((inspection) => inspection.url);

  const totals = queries.reduce(
    (acc, row) => ({ clicks: acc.clicks + row.clicks, impressions: acc.impressions + row.impressions }),
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
    `- Sitemap URLs inspected: ${inspections.length}`,
    `- Not cleanly indexed: ${unindexed.length}`,
    `- Google canonical ≠ our canonical: ${mismatches.length}`,
    `- Zero-impression pages in window: ${orphans.length}`,
    ``,
    `### Not indexed`,
    ``,
    unindexed.length
      ? unindexed.map((i) => `- ${i.url} — ${i.coverageState}`).join('\n')
      : '_none_',
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
    table(findStrikingDistance(queries, { minImpressions: 50 }), ['Query', 'Clicks', 'Impr', 'CTR', 'Pos']),
    ``,
    `## Weak CTR on page one (≥100 impressions, CTR < 2%)`,
    ``,
    `Title/description rewrite candidates.`,
    ``,
    table(findWeakCtr(queries, { minImpressions: 100, maxCtr: 0.02 }), ['Query', 'Clicks', 'Impr', 'CTR', 'Pos']),
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
```

- [ ] **Step 7: Generate and read the report**

```bash
npx tsx apps/website/scripts/gsc/report.ts && cat apps/website/.gsc/report.md
```

Expected: `wrote .gsc/report.md`, followed by the rendered report. **Read it before continuing** — the "Not indexed", "Canonical mismatches", and "Zero-impression pages" sections determine whether extra remediation tasks are needed beyond Phase 2.

- [ ] **Step 8: Add npm scripts**

In the root `package.json` `scripts` block, add:

```json
    "gsc:pull": "npx tsx apps/website/scripts/gsc/pull.ts",
    "gsc:report": "npx tsx apps/website/scripts/gsc/report.ts",
```

- [ ] **Step 9: Commit**

```bash
git add apps/website/scripts/gsc/analysis.ts apps/website/scripts/gsc/analysis.spec.ts apps/website/scripts/gsc/report.ts apps/website/vite.config.mts package.json
git commit -m "feat(website): search console analysis report"
```

---

## Phase 2 — Technical structure

### Task 5: Sitemap `lastmod`

Google ignores `changefreq` and `priority` entirely but does use `lastmod` when it is honest. Blog posts have real dates; docs and static routes use the source file's mtime.

**Files:**
- Modify: `apps/website/src/lib/site-metadata.ts`
- Modify: `apps/website/src/app/sitemap.ts`
- Modify: `apps/website/src/lib/site-metadata.spec.ts`

- [ ] **Step 1: Write the failing test**

Append to `apps/website/src/lib/site-metadata.spec.ts`:

```ts
describe('getSitemapEntries', () => {
  it('emits a lastModified date for every route', async () => {
    const { getSitemapEntries } = await import('./site-metadata');
    const entries = getSitemapEntries();
    expect(entries.length).toBeGreaterThan(100);
    for (const entry of entries) {
      expect(entry.lastModified).toBeInstanceOf(Date);
      expect(Number.isNaN(entry.lastModified.getTime())).toBe(false);
    }
  });

  it('uses the post date as lastModified for blog routes', async () => {
    const { getSitemapEntries } = await import('./site-metadata');
    const entry = getSitemapEntries().find((e) => e.route === '/blog/angular-chat-app-tutorial-with-ag-ui');
    expect(entry?.lastModified.toISOString().slice(0, 10)).toBe('2026-08-13');
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
npx nx test website
```

Expected: FAIL — `getSitemapEntries is not a function`.

- [ ] **Step 3: Implement `getSitemapEntries`**

In `apps/website/src/lib/site-metadata.ts`, add these imports at the top:

```ts
import fs from 'node:fs';
import path from 'node:path';
```

and append:

```ts
export interface SitemapEntry {
  route: string;
  lastModified: Date;
}

function fileModifiedTime(relativePath: string): Date {
  const candidates = [
    path.join(process.cwd(), 'apps', 'website', relativePath),
    path.join(process.cwd(), relativePath),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return fs.statSync(candidate).mtime;
  }
  return new Date();
}

export function getSitemapEntries(): SitemapEntry[] {
  const blogDates = new Map(getAllPosts().map((post) => [`/blog/${post.slug}`, new Date(post.frontmatter.date)]));

  return getSitemapRoutes().map((route) => {
    const blogDate = blogDates.get(route);
    if (blogDate) return { route, lastModified: blogDate };

    if (route.startsWith('/docs/')) {
      const [, , library, section, slug] = route.split('/');
      return {
        route,
        lastModified: fileModifiedTime(path.join('content', 'docs', library, section, `${slug}.mdx`)),
      };
    }

    return { route, lastModified: fileModifiedTime(path.join('src', 'app', route === '/' ? 'page.tsx' : `${route.replace(/^\//, '')}/page.tsx`)) };
  });
}
```

- [ ] **Step 4: Rewrite the sitemap route**

Replace the body of `apps/website/src/app/sitemap.ts` with:

```ts
import type { MetadataRoute } from 'next';
import { getCanonicalUrl, getSitemapEntries } from '../lib/site-metadata';

export default function sitemap(): MetadataRoute.Sitemap {
  return getSitemapEntries().map((entry) => ({
    url: getCanonicalUrl(entry.route),
    lastModified: entry.lastModified,
  }));
}
```

- [ ] **Step 5: Run the tests and confirm they pass**

```bash
npx nx test website
```

Expected: PASS.

- [ ] **Step 6: Verify the built sitemap**

```bash
npx nx build website && grep -m3 -A3 "<loc>" dist/apps/website/.next/server/app/sitemap.xml.body 2>/dev/null || npx nx serve website
```

If the build artifact path differs, serve locally and `curl -s http://localhost:3000/sitemap.xml | head -20`. Expected: each `<url>` now carries a `<lastmod>` and no longer carries `<changefreq>`/`<priority>`.

- [ ] **Step 7: Commit**

```bash
git add apps/website/src/lib/site-metadata.ts apps/website/src/lib/site-metadata.spec.ts apps/website/src/app/sitemap.ts
git commit -m "feat(website): emit honest lastmod in sitemap"
```

---

### Task 6: Article metadata + brand-name consistency

`ThreadPlane` vs `Threadplane` splits the brand entity; `publishedTime`/`author` are freshness and E-E-A-T signals that AI surfaces attribute with.

**Files:**
- Modify: `apps/website/src/lib/site-metadata.ts`
- Modify: `apps/website/src/lib/site-metadata.spec.ts`
- Modify: `apps/website/src/app/blog/[slug]/page.tsx`
- Modify: `apps/website/src/lib/docs.ts`

- [ ] **Step 1: Write the failing test**

Append to `apps/website/src/lib/site-metadata.spec.ts`:

```ts
describe('createPageMetadata article fields', () => {
  it('emits openGraph article dates, authors, and tags', () => {
    const metadata = createPageMetadata({
      title: 'Post — Threadplane',
      description: 'A post.',
      pathname: '/blog/post',
      type: 'article',
      article: {
        publishedTime: '2026-08-13',
        modifiedTime: '2026-08-14',
        authors: ['Brian Love'],
        tags: ['angular', 'ag-ui'],
      },
    });
    const openGraph = metadata.openGraph as Record<string, unknown>;
    expect(openGraph['publishedTime']).toBe('2026-08-13');
    expect(openGraph['modifiedTime']).toBe('2026-08-14');
    expect(openGraph['authors']).toEqual(['Brian Love']);
    expect(openGraph['tags']).toEqual(['angular', 'ag-ui']);
  });

  it('accepts a page-specific social image', () => {
    const metadata = createPageMetadata({
      title: 'Post — Threadplane',
      description: 'A post.',
      pathname: '/blog/post',
      image: '/blog/post/opengraph-image',
    });
    const openGraph = metadata.openGraph as { images: string[] };
    expect(openGraph.images).toEqual(['/blog/post/opengraph-image']);
  });
});

describe('brand name', () => {
  it('uses one canonical spelling', () => {
    expect(SITE_NAME).toBe('Threadplane');
  });
});
```

Add `SITE_NAME` to the existing import list at the top of that spec file.

- [ ] **Step 2: Run it and confirm it fails**

```bash
npx nx test website
```

Expected: FAIL — `publishedTime` is `undefined`.

- [ ] **Step 3: Extend `createPageMetadata`**

In `apps/website/src/lib/site-metadata.ts`, replace the `createPageMetadata` function with:

```ts
export interface ArticleMetadata {
  publishedTime: string;
  modifiedTime?: string;
  authors?: string[];
  tags?: string[];
}

export function createPageMetadata({
  title,
  description,
  pathname,
  type = 'article',
  image = DEFAULT_SOCIAL_IMAGE,
  article,
}: {
  title: string;
  description: string;
  pathname: string;
  type?: 'article' | 'website';
  image?: string;
  article?: ArticleMetadata;
}): Metadata {
  const canonicalPath = getCanonicalPath(pathname);

  return {
    title,
    description,
    alternates: { canonical: canonicalPath },
    openGraph: {
      title,
      description,
      url: canonicalPath,
      siteName: SITE_NAME,
      type,
      images: [image],
      ...(article
        ? {
            publishedTime: article.publishedTime,
            modifiedTime: article.modifiedTime ?? article.publishedTime,
            authors: article.authors,
            tags: article.tags,
          }
        : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  };
}
```

- [ ] **Step 4: Wire the blog route**

In `apps/website/src/app/blog/[slug]/page.tsx`, replace the body of `generateMetadata` with:

```ts
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post || post.frontmatter.draft) {
    return { title: 'Post not found — Threadplane' };
  }
  const author = getAuthor(post.frontmatter.author);
  return createPageMetadata({
    title: `${post.frontmatter.title} — Threadplane`,
    description: post.frontmatter.description,
    pathname: `/blog/${post.slug}`,
    type: 'article',
    image: `/blog/${post.slug}/opengraph-image`,
    article: {
      publishedTime: post.frontmatter.date,
      authors: [author.name],
      tags: post.frontmatter.tags,
    },
  });
}
```

- [ ] **Step 5: Unify the docs title separator**

In `apps/website/src/lib/docs.ts:89`, change:

```ts
  const title = `${doc.title} - ${libraryTitle} Docs - Threadplane`;
```

to:

```ts
  const title = `${doc.title} — ${libraryTitle} Docs — Threadplane`;
```

- [ ] **Step 6: Sweep the remaining mis-cased brand names**

```bash
grep -rn "ThreadPlane" apps/website/src apps/website/content | grep -v node_modules
```

Fix every hit to `Threadplane` (the brand is one word, capital T only). Then confirm:

```bash
grep -rn "ThreadPlane" apps/website/src apps/website/content | grep -v node_modules | wc -l
```

Expected: `0`.

- [ ] **Step 7: Run the tests and confirm they pass**

```bash
npx nx test website
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/website/src apps/website/content
git commit -m "feat(website): article metadata + canonical brand spelling"
```

---

### Task 7: JSON-LD structured data

**Files:**
- Create: `apps/website/src/lib/structured-data.ts`
- Create: `apps/website/src/lib/structured-data.spec.ts`
- Create: `apps/website/src/components/shared/JsonLd.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/website/src/lib/structured-data.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  breadcrumbJsonLd,
  organizationJsonLd,
  softwareSourceCodeJsonLd,
  techArticleJsonLd,
  websiteJsonLd,
  blogPostingJsonLd,
} from './structured-data';

describe('organizationJsonLd', () => {
  it('describes Threadplane with an absolute url and logo', () => {
    const data = organizationJsonLd();
    expect(data['@type']).toBe('Organization');
    expect(data['name']).toBe('Threadplane');
    expect(String(data['url'])).toBe('https://threadplane.ai/');
  });
});

describe('websiteJsonLd', () => {
  it('is a WebSite node pointing at the origin', () => {
    expect(websiteJsonLd()['@type']).toBe('WebSite');
  });
});

describe('blogPostingJsonLd', () => {
  it('carries headline, dates, author, and absolute urls', () => {
    const data = blogPostingJsonLd({
      title: 'A Post',
      description: 'About things.',
      slug: 'a-post',
      datePublished: '2026-08-13',
      authorName: 'Brian Love',
      tags: ['angular'],
    });
    expect(data['@type']).toBe('BlogPosting');
    expect(data['headline']).toBe('A Post');
    expect(data['datePublished']).toBe('2026-08-13');
    expect(data['dateModified']).toBe('2026-08-13');
    expect((data['author'] as Record<string, unknown>)['name']).toBe('Brian Love');
    expect(String(data['url'])).toBe('https://threadplane.ai/blog/a-post');
  });
});

describe('techArticleJsonLd', () => {
  it('describes a docs page', () => {
    const data = techArticleJsonLd({
      title: 'Installation',
      description: 'Install it.',
      pathname: '/docs/chat/getting-started/installation',
    });
    expect(data['@type']).toBe('TechArticle');
    expect(String(data['url'])).toBe('https://threadplane.ai/docs/chat/getting-started/installation');
  });
});

describe('breadcrumbJsonLd', () => {
  it('numbers positions from 1 and resolves absolute urls', () => {
    const data = breadcrumbJsonLd([
      { name: 'Docs', pathname: '/docs' },
      { name: 'Chat', pathname: '/docs/chat' },
    ]);
    const items = data['itemListElement'] as Record<string, unknown>[];
    expect(items).toHaveLength(2);
    expect(items[0]['position']).toBe(1);
    expect(String(items[1]['item'])).toBe('https://threadplane.ai/docs/chat');
  });
});

describe('softwareSourceCodeJsonLd', () => {
  it('marks Threadplane as an Angular TypeScript library', () => {
    const data = softwareSourceCodeJsonLd();
    expect(data['@type']).toBe('SoftwareSourceCode');
    expect(data['programmingLanguage']).toBe('TypeScript');
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
npx nx test website
```

Expected: FAIL — `Failed to resolve import "./structured-data"`.

- [ ] **Step 3: Implement the builders**

Create `apps/website/src/lib/structured-data.ts`:

```ts
// SPDX-License-Identifier: MIT
import { getCanonicalUrl, SITE_NAME } from './site-metadata';

export type JsonLdNode = Record<string, unknown>;

const ORGANIZATION_ID = getCanonicalUrl('/') + '#organization';

export function organizationJsonLd(): JsonLdNode {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: SITE_NAME,
    url: getCanonicalUrl('/'),
    logo: getCanonicalUrl('/logos/threadplane-mark.svg'),
    description:
      'Threadplane builds the Angular UI layer for production agent applications on LangGraph and AG-UI-compatible runtimes.',
    sameAs: ['https://github.com/blove/angular-agent-framework', 'https://www.npmjs.com/org/threadplane'],
  };
}

export function websiteJsonLd(): JsonLdNode {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': getCanonicalUrl('/') + '#website',
    name: SITE_NAME,
    url: getCanonicalUrl('/'),
    publisher: { '@id': ORGANIZATION_ID },
  };
}

export function softwareSourceCodeJsonLd(): JsonLdNode {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareSourceCode',
    name: '@threadplane/chat',
    description:
      'Signal-native Angular chat UI primitives bound to a runtime-neutral Agent contract, with adapters for LangGraph and AG-UI.',
    programmingLanguage: 'TypeScript',
    runtimePlatform: 'Angular',
    codeRepository: 'https://github.com/blove/angular-agent-framework',
    author: { '@id': ORGANIZATION_ID },
    license: 'https://threadplane.ai/docs/licensing',
  };
}

export function blogPostingJsonLd(post: {
  title: string;
  description: string;
  slug: string;
  datePublished: string;
  dateModified?: string;
  authorName: string;
  tags?: string[];
}): JsonLdNode {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    url: getCanonicalUrl(`/blog/${post.slug}`),
    mainEntityOfPage: getCanonicalUrl(`/blog/${post.slug}`),
    datePublished: post.datePublished,
    dateModified: post.dateModified ?? post.datePublished,
    image: getCanonicalUrl(`/blog/${post.slug}/opengraph-image`),
    keywords: post.tags,
    author: { '@type': 'Person', name: post.authorName, url: getCanonicalUrl('/about') },
    publisher: { '@id': ORGANIZATION_ID },
  };
}

export function techArticleJsonLd(doc: {
  title: string;
  description: string;
  pathname: string;
  dateModified?: string;
}): JsonLdNode {
  return {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: doc.title,
    description: doc.description,
    url: getCanonicalUrl(doc.pathname),
    mainEntityOfPage: getCanonicalUrl(doc.pathname),
    ...(doc.dateModified ? { dateModified: doc.dateModified } : {}),
    author: { '@id': ORGANIZATION_ID },
    publisher: { '@id': ORGANIZATION_ID },
    proficiencyLevel: 'Expert',
  };
}

export function breadcrumbJsonLd(crumbs: { name: string; pathname: string }[]): JsonLdNode {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: getCanonicalUrl(crumb.pathname),
    })),
  };
}

export function faqJsonLd(entries: { question: string; answer: string }[]): JsonLdNode {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: entries.map((entry) => ({
      '@type': 'Question',
      name: entry.question,
      acceptedAnswer: { '@type': 'Answer', text: entry.answer },
    })),
  };
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

```bash
npx nx test website
```

Expected: PASS. If `organizationJsonLd` fails on the logo path, run `ls apps/website/public/logos` and use the actual filename.

- [ ] **Step 5: Write the render component**

Create `apps/website/src/components/shared/JsonLd.tsx`:

```tsx
// SPDX-License-Identifier: MIT
import type { JsonLdNode } from '../../lib/structured-data';

/**
 * Renders schema.org JSON-LD. Content is generated from our own data, never
 * from user input, so `dangerouslySetInnerHTML` is safe here; `<` is still
 * escaped to keep a stray value from closing the script tag.
 */
export function JsonLd({ data }: { data: JsonLdNode | JsonLdNode[] }) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/website/src/lib/structured-data.ts apps/website/src/lib/structured-data.spec.ts apps/website/src/components/shared/JsonLd.tsx
git commit -m "feat(website): schema.org json-ld builders"
```

---

### Task 8: Mount JSON-LD on layout, blog, and docs

**Files:**
- Modify: `apps/website/src/app/layout.tsx`
- Modify: `apps/website/src/app/blog/[slug]/page.tsx`
- Modify: `apps/website/src/app/docs/[library]/[section]/[slug]/page.tsx`

- [ ] **Step 1: Add sitewide entity nodes**

In `apps/website/src/app/layout.tsx`, add imports:

```tsx
import { JsonLd } from '../components/shared/JsonLd';
import { organizationJsonLd, softwareSourceCodeJsonLd, websiteJsonLd } from '../lib/structured-data';
```

and inside `<body>`, as the first child:

```tsx
        <JsonLd data={[organizationJsonLd(), websiteJsonLd(), softwareSourceCodeJsonLd()]} />
```

- [ ] **Step 2: Add BlogPosting + breadcrumbs to blog posts**

In `apps/website/src/app/blog/[slug]/page.tsx`, add imports:

```tsx
import { JsonLd } from '../../../components/shared/JsonLd';
import { blogPostingJsonLd, breadcrumbJsonLd } from '../../../lib/structured-data';
```

and inside `BlogPostPage`, as the first child of the outermost `<div>`:

```tsx
      <JsonLd
        data={[
          blogPostingJsonLd({
            title: post.frontmatter.title,
            description: post.frontmatter.description,
            slug: post.slug,
            datePublished: post.frontmatter.date,
            authorName: author.name,
            tags: post.frontmatter.tags,
          }),
          breadcrumbJsonLd([
            { name: 'Blog', pathname: '/blog' },
            { name: post.frontmatter.title, pathname: `/blog/${post.slug}` },
          ]),
        ]}
      />
```

- [ ] **Step 3: Add TechArticle + breadcrumbs to docs pages**

In `apps/website/src/app/docs/[library]/[section]/[slug]/page.tsx`, add imports:

```tsx
import { JsonLd } from '../../../../../components/shared/JsonLd';
import { breadcrumbJsonLd, techArticleJsonLd } from '../../../../../lib/structured-data';
```

and inside `DocsPage`, after the `if (!doc) notFound();` guard, as the first child of the returned outermost `<div>`:

```tsx
      <JsonLd
        data={[
          techArticleJsonLd({
            title: doc.title,
            description: doc.description ?? libConfig.description,
            pathname: `/docs/${library}/${section}/${slug}`,
          }),
          breadcrumbJsonLd([
            { name: 'Docs', pathname: '/docs' },
            { name: libConfig.title, pathname: `/docs/${library}` },
            { name: doc.title, pathname: `/docs/${library}/${section}/${slug}` },
          ]),
        ]}
      />
```

If `doc` has no `description` field, use `getDocDescription(doc.content, libConfig.description)` and import it from `../../../../../lib/docs`.

- [ ] **Step 4: Build and verify the emitted JSON-LD**

```bash
npx nx build website
```

Expected: build succeeds. Then serve and check:

```bash
npx nx serve website
```

In a second shell:

```bash
curl -s http://localhost:3000/blog/angular-chat-app-tutorial-with-ag-ui | grep -c 'application/ld+json'
```

Expected: `2` (layout node array + page node array). Then validate the payload:

```bash
curl -s http://localhost:3000/blog/angular-chat-app-tutorial-with-ag-ui | python3 -c "import sys,re,json;[json.loads(m) for m in re.findall(r'ld\+json\"[^>]*>(.*?)</script>', sys.stdin.read(), re.S)] and print('valid json-ld')"
```

Expected: `valid json-ld`.

- [ ] **Step 5: Validate against Google**

Paste the deployed URL into https://search.google.com/test/rich-results after the PR merges and confirm zero errors. Record the result in the PR description.

- [ ] **Step 6: Commit**

```bash
git add apps/website/src/app
git commit -m "feat(website): mount json-ld on layout, blog, and docs"
```

---

### Task 9: Per-post OG images

**Files:**
- Create: `apps/website/src/app/blog/[slug]/opengraph-image.tsx`

- [ ] **Step 1: Read the existing generator for style parity**

```bash
cat apps/website/src/app/opengraph-image.tsx
```

Match its `size`, `contentType`, font loading, and color usage in the next step rather than inventing a new look.

- [ ] **Step 2: Write the per-post generator**

Create `apps/website/src/app/blog/[slug]/opengraph-image.tsx`:

```tsx
// SPDX-License-Identifier: MIT
import { ImageResponse } from 'next/og';
import { getAllPosts, getPostBySlug } from '../../../lib/blog';
import { getAuthor } from '../../../lib/blog-authors';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Threadplane blog post';

export function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }));
}

export default async function OpengraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  const title = post?.frontmatter.title ?? 'Threadplane';
  const author = post ? getAuthor(post.frontmatter.author).name : 'Threadplane';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#0B0D12',
          color: '#F5F7FA',
          padding: 80,
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ fontSize: 28, letterSpacing: 2, color: '#8FA3BF', textTransform: 'uppercase' }}>
          Threadplane · Blog
        </div>
        <div style={{ fontSize: 68, lineHeight: 1.1, fontWeight: 700, maxWidth: 980 }}>{title}</div>
        <div style={{ fontSize: 30, color: '#8FA3BF' }}>{author} · threadplane.ai</div>
      </div>
    ),
    size,
  );
}
```

- [ ] **Step 3: Verify the image renders**

```bash
npx nx serve website
```

In a second shell:

```bash
curl -s -o /tmp/og.png -w "%{http_code} %{content_type} %{size_download}\n" "http://localhost:3000/blog/angular-chat-app-tutorial-with-ag-ui/opengraph-image"
```

Expected: `200 image/png` with a size over 10000 bytes. Open `/tmp/og.png` and confirm the title is not clipped for the longest post title (`Build Fullstack Agentic Angular Apps Using AG-UI`).

- [ ] **Step 4: Commit**

```bash
git add "apps/website/src/app/blog/[slug]/opengraph-image.tsx"
git commit -m "feat(website): per-post opengraph images"
```

---

### Task 10: Clean heading text + agent-friendly markup

Right now every docs H2 extracts as `#Prerequisites`. That glyph rides along into snippets, TOCs, and any model reading the DOM. Google's agent-friendly guidance is the same checklist as accessibility: semantic elements, meaningful link text, clean headings.

**Files:**
- Modify: `apps/website/src/components/docs/MdxRenderer.tsx`
- Modify: `apps/website/src/app/global.css`

- [ ] **Step 1: Confirm the defect on the live site**

```bash
curl -s https://threadplane.ai/docs/chat/getting-started/installation | grep -o '<h2[^>]*>.\{0,60\}' | head -3
```

Expected: heading markup where the `#` anchor precedes the text.

- [ ] **Step 2: Move the anchor after the text and hide it from assistive tech and extraction**

In `apps/website/src/components/docs/MdxRenderer.tsx`, at both line 37 and line 43, change the anchor so it renders **after** the heading children and carries `aria-hidden`:

```tsx
      {id ? (
        <a href={`#${id}`} aria-hidden="true" tabIndex={-1} className="heading-anchor">
          #
        </a>
      ) : null}
```

Ensure the `{children}` expression precedes this block in both heading components.

- [ ] **Step 3: Keep the anchor reachable without polluting the text**

Append to `apps/website/src/app/global.css`:

```css
.heading-anchor {
  margin-left: 0.35rem;
  opacity: 0;
  text-decoration: none;
  transition: opacity 120ms ease-in-out;
}

h1:hover > .heading-anchor,
h2:hover > .heading-anchor,
h3:hover > .heading-anchor,
h4:hover > .heading-anchor {
  opacity: 0.5;
}
```

- [ ] **Step 4: Verify the extracted heading text is clean**

```bash
npx nx serve website
```

In a second shell:

```bash
curl -s http://localhost:3000/docs/chat/getting-started/installation | python3 -c "
import sys, re
html = sys.stdin.read()
for level, text in re.findall(r'<h([1-3])[^>]*>(.*?)</h\1>', html, re.S)[:8]:
    print(level, re.sub(r'<[^>]+>', '', text).strip())
"
```

Expected: `2 Prerequisites`, `2 1. Install the packages`, … with no leading `#`.

- [ ] **Step 5: Commit**

```bash
git add apps/website/src/components/docs/MdxRenderer.tsx apps/website/src/app/global.css
git commit -m "fix(website): keep anchor glyphs out of heading text"
```

---

## Phase 3 — Content and E-E-A-T

### Task 11: `/about` page with a Person entity

Google's guidance leans on first-hand expertise and people-first content. There is currently no page on the site that establishes who writes it. AI answer engines cite named, attributable authors far more readily than anonymous docs.

**Files:**
- Create: `apps/website/src/app/about/page.tsx`
- Modify: `apps/website/src/lib/site-metadata.ts`
- Modify: `apps/website/src/components/shared/Footer.tsx`

- [ ] **Step 1: Create the page**

Create `apps/website/src/app/about/page.tsx`:

```tsx
// SPDX-License-Identifier: MIT
import type { Metadata } from 'next';
import { JsonLd } from '../../components/shared/JsonLd';
import { createPageMetadata, getCanonicalUrl } from '../../lib/site-metadata';
import { blogAuthors } from '../../lib/blog-authors';

export const metadata: Metadata = createPageMetadata({
  title: 'About — Threadplane',
  description:
    'Threadplane is built by Brian Love, an Angular consultant and open-source maintainer, to give Angular teams a production UI layer for LangGraph and AG-UI agents.',
  pathname: '/about',
  type: 'website',
});

export default function AboutPage() {
  const brian = blogAuthors['brian'];

  return (
    <main style={{ maxWidth: 768, margin: '0 auto', padding: '128px 24px 96px' }}>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'AboutPage',
          url: getCanonicalUrl('/about'),
          mainEntity: {
            '@type': 'Person',
            name: brian.name,
            jobTitle: brian.role,
            description: brian.bio,
            url: getCanonicalUrl('/about'),
            sameAs: ['https://github.com/blove'],
            knowsAbout: ['Angular', 'LangGraph', 'AG-UI', 'Agentic UI', 'TypeScript'],
          },
        }}
      />
      <h1>About Threadplane</h1>
      <p>
        Threadplane is the Angular UI layer for production agent applications. It exists because
        Angular teams shipping LangGraph and AG-UI agents kept rebuilding the same last mile:
        streaming, durable threads, interrupts, tool calls, and generative UI.
      </p>
      <h2>Who builds it</h2>
      <p>
        {brian.name} — {brian.role}. {brian.bio}
      </p>
      <h2>What we will not do</h2>
      <p>
        No runtime lock-in and no abandoned majors. Threadplane binds to a runtime-neutral Agent
        contract, and every adapter ships against the same conformance suite.
      </p>
    </main>
  );
}
```

Replace the prose with Brian's own words before merging — this page is an E-E-A-T signal, and boilerplate defeats the purpose. Do not fabricate biography details.

- [ ] **Step 2: Add it to the sitemap**

In `apps/website/src/lib/site-metadata.ts`, add `'/about'` to the `staticRoutes` array in `getSitemapRoutes`, after `'/pricing'`.

- [ ] **Step 3: Link it from the footer**

In `apps/website/src/components/shared/Footer.tsx`, add an `About` link to `/about` in the same group as the existing Contact link, matching the surrounding link markup exactly.

- [ ] **Step 4: Verify**

```bash
npx nx test website && npx nx build website
```

Expected: PASS and a successful build. Then serve and confirm `curl -s http://localhost:3000/about | grep -c 'application/ld+json'` returns `2`.

- [ ] **Step 5: Commit**

```bash
git add apps/website/src/app/about apps/website/src/lib/site-metadata.ts apps/website/src/components/shared/Footer.tsx
git commit -m "feat(website): about page with person entity"
```

---

### Task 12: Add diagrams to the blog

Every blog post currently ships zero images. Google's guide asks for high-quality images and video where relevant, and a diagram is the highest-value image for an architecture tutorial.

**Files:**
- Modify: `apps/website/content/blog/2026-08-13-angular-chat-app-tutorial-with-ag-ui.mdx`
- Modify: `apps/website/content/blog/2026-08-13-angular-chat-app-tutorial-with-langchain-langgraph.mdx`
- Modify: `apps/website/content/blog/2026-08-09-agentic-ui-in-angular-production-patterns.mdx`
- Create: `apps/website/public/blog/diagrams/*.svg`

- [ ] **Step 1: Confirm the gap**

```bash
grep -c "!\[" apps/website/content/blog/*.mdx
```

Expected: `0` for every file.

- [ ] **Step 2: Check how MDX renders images**

```bash
grep -n "img\|Image" apps/website/src/components/docs/MdxRenderer.tsx
```

If there is no `img` override, add one that renders a plain `<img>` with `loading="lazy"`, `width`, `height`, and the `alt` from the MDX — dimensions prevent CLS, which is a page-experience signal.

- [ ] **Step 3: Author one SVG diagram per post**

For the AG-UI tutorial, create `apps/website/public/blog/diagrams/ag-ui-event-flow.svg` showing: AG-UI backend → SSE event stream (17 event types) → `@threadplane/ag-ui` adapter → Angular signals → `@threadplane/chat` components. Use the design tokens' surface and text colors so it reads in both themes. Repeat for the LangGraph tutorial (graph → SSE → adapter → signals) and the production-patterns post (client-tool continuation loop).

- [ ] **Step 4: Reference each diagram with descriptive alt text**

Insert immediately after the "What are we building?" heading of the AG-UI post:

```mdx
![AG-UI backend streams 17 SSE event types into the @threadplane/ag-ui adapter, which converts them into Angular signals consumed by @threadplane/chat components.](/blog/diagrams/ag-ui-event-flow.svg)
```

The alt text is a full sentence describing the mechanism, not a label — it is extractable content, not decoration.

- [ ] **Step 5: Verify**

```bash
npx nx serve website
```

In a second shell:

```bash
curl -s http://localhost:3000/blog/angular-chat-app-tutorial-with-ag-ui | grep -c "<img"
```

Expected: at least `1`, and each `<img>` has an `alt` attribute.

- [ ] **Step 6: Commit**

```bash
git add apps/website/content/blog apps/website/public/blog/diagrams apps/website/src/components/docs/MdxRenderer.tsx
git commit -m "docs(blog): architecture diagrams for the tutorial posts"
```

---

### Task 13: Question-form headings across older posts and key docs

The two newest blog posts already use question-form H2s. The four older posts use noun phrases. Question headings match how people phrase things in AI Mode, and give retrieval a clean question/answer pair — without any "chunking" or keyword stuffing, both of which Google explicitly calls useless.

**Files:**
- Modify: `apps/website/content/blog/2026-05-17-build-a-streaming-chat-ui-in-angular-with-langgraph.mdx`
- Modify: `apps/website/content/blog/2026-05-21-build-fullstack-agentic-angular-apps-using-ag-ui.mdx`
- Modify: `apps/website/content/blog/2026-05-28-human-in-the-loop-langgraph-agents-in-angular.mdx`
- Modify: `apps/website/content/blog/2026-06-04-human-in-the-loop-ag-ui-agents-in-angular.mdx`

- [ ] **Step 1: List the current headings**

```bash
grep -n "^## " apps/website/content/blog/2026-05-17-*.mdx apps/website/content/blog/2026-05-21-*.mdx apps/website/content/blog/2026-05-28-*.mdx apps/website/content/blog/2026-06-04-*.mdx
```

- [ ] **Step 2: Rewrite only the headings that are genuinely answering a question**

Example, in the streaming post: `## Why streaming matters` → `## Why does streaming matter for agent UIs?`; `## The architecture in three boxes` → `## What does the architecture look like?`. Leave `## Goals` alone — it is not a question and forcing one would be exactly the "special rewrites for AI" Google warns against. Change no body copy.

- [ ] **Step 3: Verify no anchors broke**

```bash
grep -rn "](#" apps/website/content/blog | grep -v node_modules
```

Any in-page anchor whose target heading you renamed must be updated to the new slug. Expected after fixing: every listed anchor resolves to a heading present in the same file.

- [ ] **Step 4: Commit**

```bash
git add apps/website/content/blog
git commit -m "docs(blog): question-form section headings in the 2026-05/06 posts"
```

---

### Task 14: Freeze the programmatic `solutions/*` surface

Three `solutions/*` pages generated from a 9.4 KB data file is fine. Thirty would be scaled content abuse, which Google's guide names as a policy violation. Write the rule down before someone scales it.

**Files:**
- Modify: `apps/website/src/lib/solutions-data.ts`

- [ ] **Step 1: Add the constraint as a file-header comment**

At the top of `apps/website/src/lib/solutions-data.ts`, below the SPDX line:

```ts
/**
 * Solutions pages are hand-written, not templated at scale.
 *
 * Google's scaled-content-abuse policy targets programmatically generated
 * page families that vary only by keyword. Every entry here must carry
 * genuinely distinct, first-hand content — a real customer problem, a real
 * architecture, real code. If a new entry would be a find-and-replace of an
 * existing one, do not add it; write a blog post or a docs guide instead.
 *
 * See https://developers.google.com/search/docs/fundamentals/ai-optimization-guide
 */
```

- [ ] **Step 2: Verify each existing page is genuinely distinct**

```bash
npx tsx -e "
import('./apps/website/src/lib/solutions-data.ts').then((m) => {
  for (const s of m.solutions ?? []) console.log(s.slug, JSON.stringify(s).length);
});
"
```

Read the three pages. If any two share more than boilerplate structure, rewrite the weaker one with genuinely different content or remove it from the sitemap. Record the decision in the PR description.

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/lib/solutions-data.ts
git commit -m "docs(website): record the no-scaled-content rule for solutions pages"
```

---

## Phase 4 — Measurement

### Task 15: AI crawler and AI referral tracking

AI crawlers do not execute JavaScript, so the client PostHog snippet never sees them. Edge middleware does. This gives a real answer to "are AI engines reading us, and are they sending anyone back" — the one measurement Search Console will not provide.

**Files:**
- Create: `apps/website/src/lib/analytics/ai-traffic.ts`
- Create: `apps/website/src/lib/analytics/ai-traffic.spec.ts`
- Modify: `apps/website/src/lib/analytics/events.ts`
- Create: `apps/website/src/middleware.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/website/src/lib/analytics/ai-traffic.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { classifyAiCrawler, classifyAiReferrer } from './ai-traffic';

describe('classifyAiCrawler', () => {
  it('identifies the major AI crawlers', () => {
    expect(classifyAiCrawler('Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)')).toBe('gptbot');
    expect(classifyAiCrawler('Mozilla/5.0 (compatible; ClaudeBot/1.0)')).toBe('claudebot');
    expect(classifyAiCrawler('Mozilla/5.0 (compatible; PerplexityBot/1.0)')).toBe('perplexitybot');
    expect(classifyAiCrawler('Mozilla/5.0 (compatible; Google-Extended)')).toBe('google-extended');
    expect(classifyAiCrawler('Mozilla/5.0 (compatible; Googlebot/2.1)')).toBe(null);
    expect(classifyAiCrawler('')).toBe(null);
  });
});

describe('classifyAiReferrer', () => {
  it('identifies referrals from AI answer engines', () => {
    expect(classifyAiReferrer('https://chatgpt.com/c/abc')).toBe('chatgpt');
    expect(classifyAiReferrer('https://www.perplexity.ai/search?q=x')).toBe('perplexity');
    expect(classifyAiReferrer('https://claude.ai/chat/1')).toBe('claude');
    expect(classifyAiReferrer('https://gemini.google.com/app')).toBe('gemini');
    expect(classifyAiReferrer('https://www.google.com/search?q=x')).toBe(null);
    expect(classifyAiReferrer('')).toBe(null);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
npx nx test website
```

Expected: FAIL — `Failed to resolve import "./ai-traffic"`.

- [ ] **Step 3: Implement the classifiers**

Create `apps/website/src/lib/analytics/ai-traffic.ts`:

```ts
// SPDX-License-Identifier: MIT

const CRAWLERS: [RegExp, string][] = [
  [/GPTBot/i, 'gptbot'],
  [/OAI-SearchBot/i, 'oai-searchbot'],
  [/ChatGPT-User/i, 'chatgpt-user'],
  [/ClaudeBot/i, 'claudebot'],
  [/Claude-Web/i, 'claude-web'],
  [/anthropic-ai/i, 'anthropic-ai'],
  [/PerplexityBot/i, 'perplexitybot'],
  [/Perplexity-User/i, 'perplexity-user'],
  [/Google-Extended/i, 'google-extended'],
  [/Google-CloudVertexBot/i, 'google-vertex'],
  [/Applebot-Extended/i, 'applebot-extended'],
  [/Bytespider/i, 'bytespider'],
  [/Meta-ExternalAgent/i, 'meta-external-agent'],
  [/CCBot/i, 'ccbot'],
];

const REFERRERS: [RegExp, string][] = [
  [/(^|\.)chatgpt\.com$/i, 'chatgpt'],
  [/(^|\.)chat\.openai\.com$/i, 'chatgpt'],
  [/(^|\.)perplexity\.ai$/i, 'perplexity'],
  [/(^|\.)claude\.ai$/i, 'claude'],
  [/(^|\.)gemini\.google\.com$/i, 'gemini'],
  [/(^|\.)copilot\.microsoft\.com$/i, 'copilot'],
  [/(^|\.)you\.com$/i, 'you'],
];

/** Returns a stable crawler slug, or null for humans and non-AI bots. */
export function classifyAiCrawler(userAgent: string): string | null {
  if (!userAgent) return null;
  for (const [pattern, slug] of CRAWLERS) {
    if (pattern.test(userAgent)) return slug;
  }
  return null;
}

/** Returns a stable AI-engine slug for a referrer URL, or null. */
export function classifyAiReferrer(referrer: string): string | null {
  if (!referrer) return null;
  let host: string;
  try {
    host = new URL(referrer).hostname;
  } catch {
    return null;
  }
  for (const [pattern, slug] of REFERRERS) {
    if (pattern.test(host)) return slug;
  }
  return null;
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

```bash
npx nx test website
```

Expected: PASS.

- [ ] **Step 5: Register the events**

Open `apps/website/src/lib/analytics/events.ts` and add two entries to the `analyticsEvents` registry, following the exact shape of the entries already there:

```ts
  aiCrawlerVisit: 'ai_crawler_visit',
  aiReferralVisit: 'ai_referral_visit',
```

Use whatever key/value convention the existing entries use — read the file first and match it rather than assuming.

- [ ] **Step 6: Write the middleware**

Create `apps/website/src/middleware.ts`:

```ts
// SPDX-License-Identifier: MIT
import { NextResponse, type NextRequest } from 'next/server';
import { classifyAiCrawler, classifyAiReferrer } from './lib/analytics/ai-traffic';

export const config = {
  // HTML routes only — skip assets, API routes, and Next internals.
  matcher: ['/((?!api|_next/static|_next/image|ingest|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt|xml|pdf)$).*)'],
};

const POSTHOG_HOST = 'https://us.i.posthog.com';

async function capture(event: string, properties: Record<string, string>): Promise<void> {
  const token = process.env['NEXT_PUBLIC_POSTHOG_TOKEN'];
  if (!token) return;
  try {
    await fetch(`${POSTHOG_HOST}/capture/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        api_key: token,
        event,
        distinct_id: `ai:${properties['source']}`,
        properties: { ...properties, $process_person_profile: false },
      }),
    });
  } catch {
    // Analytics must never break a page render.
  }
}

export function middleware(request: NextRequest): NextResponse {
  const pathname = request.nextUrl.pathname;
  const crawler = classifyAiCrawler(request.headers.get('user-agent') ?? '');
  const referrer = crawler ? null : classifyAiReferrer(request.headers.get('referer') ?? '');

  if (crawler) {
    void capture('ai_crawler_visit', { source: crawler, path: pathname });
  } else if (referrer) {
    void capture('ai_referral_visit', { source: referrer, path: pathname });
  }

  return NextResponse.next();
}
```

- [ ] **Step 7: Verify the middleware fires**

```bash
npx nx serve website
```

In a second shell:

```bash
curl -s -o /dev/null -A "Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)" http://localhost:3000/docs/chat/getting-started/installation
curl -s -o /dev/null -e "https://chatgpt.com/c/abc" http://localhost:3000/blog/angular-chat-app-tutorial-with-ag-ui
curl -s -o /dev/null http://localhost:3000/
```

Expected: in PostHog's live-events view, exactly one `ai_crawler_visit` (source `gptbot`) and one `ai_referral_visit` (source `chatgpt`), and nothing for the third request. If `NEXT_PUBLIC_POSTHOG_TOKEN` is unset locally, assert instead that all three requests return 200 and no error is logged.

- [ ] **Step 8: Confirm the production build still passes its bundle budget**

```bash
npx nx build website --configuration=production
```

Expected: success. (This project has bitten prod deploys before with prod-only budgets that dev builds never check.)

- [ ] **Step 9: Commit**

```bash
git add apps/website/src/lib/analytics apps/website/src/middleware.ts
git commit -m "feat(website): track ai crawler and ai referral traffic"
```

---

### Task 16: Measurement runbook

**Files:**
- Create: `docs/gtm/ai-search-measurement.md`

- [ ] **Step 1: Write the runbook**

Create `docs/gtm/ai-search-measurement.md`:

```markdown
# Measuring AI search visibility for threadplane.ai

## What each source can and cannot answer

| Question | Source | Automated? |
|---|---|---|
| Impressions/clicks in AI Overviews and AI Mode | Search Console → Performance → **Generative AI** report | **No — UI only.** Not in `searchanalytics.query` (`type` accepts only web/image/video/news/discover/googleNews), not in `searchAppearance`, not in the BigQuery export, as of 2026-08. |
| Query and page performance in classic web search | `npm run gsc:pull && npm run gsc:report` | Yes |
| Index coverage per URL | URL Inspection API, via the same pull | Yes (quota 2000/day) |
| Discover impressions | `type: 'discover'` in the pull | Yes |
| Are AI crawlers fetching us | PostHog `ai_crawler_visit` | Yes |
| Are AI engines sending referrals | PostHog `ai_referral_visit` | Yes |
| Do we appear in a given assistant's answer | Manual spot-check | No |

## Monthly routine

1. `npm run gsc:pull && npm run gsc:report`, then read `apps/website/.gsc/report.md`.
   Act on, in order: **not indexed** → **canonical mismatches** → **striking distance** →
   **weak CTR**.
2. In Search Console, open Performance → Generative AI, set the window to the last
   3 months, and export the CSV. Save it as
   `apps/website/.gsc/generative-ai-YYYY-MM.csv` (gitignored). Compare total
   impressions and top pages against the previous month by hand. Re-check whether
   the API has caught up — Google shipped Discover and News to the UI months before
   the API, and this is expected to follow.
3. In PostHog, chart `ai_crawler_visit` by `source` and `path` over 90 days. A crawler
   that stops fetching a section is an early warning. Chart `ai_referral_visit` by
   `source` for the conversion side.
4. Spot-check five assistant prompts a real buyer would type — e.g. "Angular chat UI
   for LangGraph", "how do I stream a LangGraph agent into Angular", "AG-UI Angular
   client" — in ChatGPT, Claude, Perplexity, and Google AI Mode. Record whether
   threadplane.ai is cited and what it is cited *for*. This is qualitative and slow,
   and there is no honest way to automate it; do five, not fifty.

## Tactics that do not work — do not add them

Straight from Google's AI optimization guide: `llms.txt` and AI-specific text files do
nothing for Google Search; content "chunking" is unnecessary; AI-specific keyword
rewrites are unnecessary; pursuing inauthentic mentions is ineffective. Ignore any
third-party tool claiming access to internal Google AI metrics — those numbers are
modeled, not measured.

We keep `/llms.txt` and `/llms-full.txt` because some non-Google assistants do read
them, not because they help Google.
```

- [ ] **Step 2: Verify the referenced npm scripts exist**

```bash
grep -n "gsc:pull\|gsc:report" package.json
```

Expected: both present (added in Task 4).

- [ ] **Step 3: Commit**

```bash
git add docs/gtm/ai-search-measurement.md
git commit -m "docs(gtm): ai search measurement runbook"
```

---

## Final verification

- [ ] **Step 1: Full check**

```bash
npx nx test website && npx nx lint website && npx nx build website --configuration=production
```

Expected: all three pass. Lint **warnings** are tolerated by CI; lint **errors** are not. To count errors, strip ANSI first — `grep -cE ' error '` on raw output silently returns 0:

```bash
npx nx lint website 2>&1 | sed -r "s/\x1B\[[0-9;]*[mK]//g" | grep -cE '  error  '
```

Expected: `0`.

- [ ] **Step 2: Verify the live-equivalent output locally**

```bash
npx nx serve website
```

In a second shell:

```bash
for u in / /about /blog/angular-chat-app-tutorial-with-ag-ui /docs/chat/getting-started/installation; do
  echo "=== $u"
  curl -s "http://localhost:3000$u" -o /tmp/p.html
  echo "ld+json blocks: $(grep -c 'application/ld+json' /tmp/p.html)"
  grep -o '<title>[^<]*</title>' /tmp/p.html
  grep -o '<link rel="canonical" href="[^"]*"' /tmp/p.html
done
curl -s http://localhost:3000/sitemap.xml | grep -c "<lastmod>"
```

Expected: every page has at least one `ld+json` block, exactly one canonical, a title ending in `— Threadplane`, and the sitemap `lastmod` count equals the URL count (141 after `/about` lands).

- [ ] **Step 3: Post-merge validation (record results in the PR)**

1. Rich Results Test on the deployed `/blog/*` and `/docs/*` URLs → zero errors.
2. Search Console → Sitemaps → resubmit `sitemap.xml`.
3. Search Console → URL Inspection → Request indexing for `/about`.
4. Re-run `npm run gsc:pull && npm run gsc:report` 14 days later and diff the index-health section against the pre-change run.
