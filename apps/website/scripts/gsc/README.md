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

    npm run gsc:pull      # writes apps/website/.gsc/*.json
    npm run gsc:report    # writes apps/website/.gsc/report.md

`gsc:report` reads the snapshots `gsc:pull` wrote, so run the pull first.

Both scripts resolve their `.gsc` directory relative to the current working
directory (`<cwd>/apps/website/.gsc`), so the raw form must be invoked from the
repo root:

    npx tsx apps/website/scripts/gsc/pull.ts
    npx tsx apps/website/scripts/gsc/report.ts

If the URL Inspection sweep hits quota or transient errors, `pull.ts` also
writes `.gsc/inspection-errors.json` and the report labels its index-health
counts as lower bounds.

## What this CANNOT do

The Search Console **Generative AI performance report** (AI Overviews /
AI Mode impressions and clicks) is UI-only as of 2026-08. It is not in
`searchanalytics.query`, not in `searchAppearance`, and not in the
BigQuery bulk export. See `docs/gtm/ai-search-measurement.md` for the
manual export procedure.
