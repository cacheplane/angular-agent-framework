# AI Search Measurement — Threadplane

> Operational runbook for measuring how threadplane.ai performs in search, including AI-answer surfaces. Referenced from `apps/website/scripts/gsc/README.md` and from every generated `.gsc/report.md`. If the harness or the taxonomy changes, this file changes.

## tl;dr

- Everything except AI Overviews is automated: `npm run gsc:pull` then `npm run gsc:report`.
- The Search Console **Generative AI performance report** is UI-only. There is no API for it. Read it by hand, monthly, and write the number down.
- AI crawler hits and AI-engine referrals come from PostHog, emitted by Edge middleware. They are directional, not exact.
- Several popular "AI SEO" tactics do nothing for Google Search. The [do-not-do list](#do-not-do) exists so nobody re-adds them.

## What each source can and cannot answer

| Source | Answers | Cannot answer |
| --- | --- | --- |
| `gsc:pull` / `gsc:report` (Search Console API) | Query and page performance, striking distance, weak CTR, index coverage, canonical choice, Discover, 90-day trend | Anything about AI Overviews or AI Mode |
| Search Console UI → Generative AI performance | AI Overviews / AI Mode impressions, clicks, position | Nothing exportable through an API or BigQuery |
| PostHog `marketing:ai_crawler_visit` | Which AI crawlers fetch us, and which pages they fetch | Whether the crawl produced a citation |
| PostHog `marketing:ai_referral_visit` | Referrals arriving from ChatGPT, Perplexity, Claude, Gemini, Copilot, you.com | Referrals an engine strips (many do), or in-answer citations with no click |
| Manual spot checks in the assistants themselves | Whether we are actually cited for a question we care about | Anything at scale, or anything trended over time |

No source answers "how many people saw us inside an AI answer." That number does not exist for us. The closest proxies are the UI report (Google only) and the referral events (a click, not an impression).

## The Search Console AI gap

The **Generative AI performance report** — AI Overviews and AI Mode impressions and clicks — is UI-only as of 2026-08.

- It is not in `searchanalytics.query`. That endpoint's `type` field accepts `web`, `image`, `video`, `news`, `discover`, and `googleNews`. Nothing else.
- There is no `searchAppearance` value for AI features.
- It is not in the BigQuery bulk export.

Any tool or post claiming to pull AI Overview impressions programmatically is either wrong or is inferring them from something else. Do not build against it, and do not accept a vendor's claim that they have it.

### Manual export procedure

Once a month, at the same time as the pull:

1. Open Search Console for the `threadplane.ai` **Domain property**.
2. Go to **Performance** and open the **Generative AI performance** report.
3. Set the date range to the same 90-day window the pull used (see `Window:` on the first line of `.gsc/report.md`).
4. Record total impressions, total clicks, and average position.
5. Export the query and page tables if you want detail; the export control on that report writes CSV or Google Sheets.
6. Paste the four numbers into the running log at the bottom of this file.

The UI labels move. If a step's wording no longer matches, follow the report, not the wording, and fix this list.

## The monthly routine

Run from the repo root, with `GSC_SERVICE_ACCOUNT_JSON` and `GSC_SITE_URL` exported (setup lives in `apps/website/scripts/gsc/README.md`):

```bash
npm run gsc:pull      # writes apps/website/.gsc/*.json
npm run gsc:report    # writes apps/website/.gsc/report.md
```

`.gsc/` is gitignored. The snapshots are raw API output; the report is the readable layer over them. Both are disposable — re-pull rather than archive.

Then, in order:

1. **Read the trend first.** `dates.json` holds the daily series. Split the window in half and compare; a single day is noise.
2. **Index health.** Anything under "Not indexed" is a page earning zero, permanently. `coverageState` distinguishes "crawled, not indexed" (a quality signal) from "URL is unknown to Google" (a discovery signal — usually links or sitemap). Fix discovery before you touch content.
3. **Canonical mismatches.** Should stay at zero. A non-zero count means Google picked a different URL than we declared, and our metadata is arguing with itself.
4. **Striking distance.** Queries at position 5–20 with real impressions. These are the cheapest wins: the page already ranks, it just isn't the answer yet.
5. **Weak CTR on page one.** Ranks well, nobody clicks. Title and description rewrite candidates — read the position column before acting, because the threshold is flat across positions 1–10.
6. **Zero-impression pages.** Pages in the sitemap that earned nothing in 90 days. Either they target nothing anyone searches for, or nothing links to them.
7. **The AI report, by hand.** The procedure above.
8. **AI traffic in PostHog.** `marketing:ai_crawler_visit` broken out by `ai_crawler` and `source_page`; `marketing:ai_referral_visit` by `ai_source`. Look at shape and direction, not exact counts.

Quota note: the URL Inspection API allows 2000 calls/day, and the sweep uses one per sitemap URL. At ~140 URLs that is not close to the ceiling, but if a sweep partially fails, `pull.ts` writes `.gsc/inspection-errors.json` and the report labels its index-health counts as lower bounds. Believe the label.

## AI crawler and referral events

Both are emitted from Edge middleware, in `apps/website/src/lib/analytics/ai-traffic.ts`, because neither signal can reach the client snippet: crawlers do not execute JavaScript, and a referral needs the `Referer` header at request time.

| Event | Properties |
| --- | --- |
| `marketing:ai_crawler_visit` | `ai_crawler`, `source_page`, `user_agent` |
| `marketing:ai_referral_visit` | `ai_source`, `source_page` |

Read these as directional:

- Crawler events are **deduped** per crawler and path, hourly, per instance. Referral events are not deduped.
- Both event types share one **rate limit**: 500 events per hour per instance, as an abuse ceiling — both inputs are attacker-controlled headers.
- Instances are serverless and horizontally scaled, so neither bound is fleet-global. The dataset under-counts by design.
- Only AI-specific crawler variants classify. Plain `Googlebot` and plain `Applebot` are classic search crawlers and are deliberately excluded; `Google-Extended` and `Applebot-Extended` are not.
- Referrals are anonymous — no person profile — and many engines strip the referrer entirely, so this is a floor on AI-sourced clicks, never a total.

The taxonomy of record is [taxonomy.md](./taxonomy.md). If a property name changes there, change it here too.

## Baseline: first real pull

Window **2026-05-19 → 2026-08-17** (90 days). This is what "before" looks like; compare against it.

| Signal | Value |
| --- | --- |
| Impressions, first half → second half of window (daily series) | 1,149 → 2,506 (+118%) |
| Pages earning at least one click | 15 of 121 |
| Average position on identified queries | 17.1 |
| URLs inspected | 139 |
| Indexed | 126 |
| Not indexed | 13, including 3 of 9 blog posts and 2 docs pages "unknown to Google" |
| Canonical mismatches | 0 |

The one query worth naming: **`injectagent`** — 101 impressions, 2 clicks, 2.0% CTR, position 5.6. Ranking well and converting badly, which is a title and description problem, not a ranking problem.

### Why the query totals look too small

Query-dimension totals came to 528 impressions while the page dimension totals far more. That is not a bug in the harness. Google anonymizes rare queries and omits them from the query dimension entirely, so **page-level numbers are the true volume** and query-level numbers are a sample of the identifiable tail. Never quote a query-dimension total as site traffic, and never compute site CTR from it.

## Do not do

Google has said each of these does not help in Search. They are listed here because they keep coming back.

- **`llms.txt`-style files as a *Search* tactic.** We keep `/llms.txt` because some non-Google assistants read it and it costs nothing. It does not affect Google ranking or AI Overviews. Do not cite it as an SEO deliverable, and do not expand it hoping for search gains.
- **"Chunking" content for retrieval.** Restructuring pages into machine-shaped fragments is not a ranking or citation input. Write for the reader; the fragmenting happens downstream and is not ours to optimize.
- **AI-specific keyword rewrites.** There is no separate keyword surface for AI answers. A page that answers a real question well is the whole tactic.
- **Pursuing inauthentic mentions.** Paid, traded, or manufactured mentions to appear in AI answers are the same bad idea they always were, with a new justification.

What actually moves the numbers is unglamorous: pages that answer a specific question, titles that match what the query asked, links and sitemap entries so Google can find the page at all, and fixing the 13 URLs it has not indexed.

## Running log

Append one row per monthly pull. Keep the AI columns even when they are zero — a zero we measured is worth more than a blank.

| Pull date | Window | Impressions | Clicks | Avg position | AI Overview impressions | AI Overview clicks | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-08-20 | 2026-05-19 → 2026-08-17 | 528 (query dim) | — | 17.1 | not yet read | not yet read | First pull. Page-dimension volume is higher; see the anonymization note. |
