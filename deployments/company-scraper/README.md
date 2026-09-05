# Company scraper

This packages Firecrawl's actual standalone `apps/playwright-service-ts` component at commit `4cee46d827e1353e66228aa7f6c53734581b8f7b` from https://github.com/firecrawl/firecrawl. The build retains upstream source and root license (`UPSTREAM-LICENSE`); the upstream component package lists Jeff Pereira and ISC. Review upstream licensing for your distribution. `upstream.patch` narrows the HTTP interface while retaining upstream browser setup, navigation, extraction, request interception and SSRF proxy checks. `company-handler.cjs` owns admission, authentication and cancellation policy.

Build from this directory: `docker build -t threadplane-company-scraper .`

Run with a securely supplied `COMPANY_SCRAPER_SECRET` environment variable, `--cpus=2 --memory=2g --cap-drop=ALL --security-opt=no-new-privileges --init -p 127.0.0.1:3003:3003`. The image runs as the existing nonroot `node` user. Publish behind HTTPS; never expose the local port publicly. The upstream Chromium launch uses `--no-sandbox`, so keep the container isolated from internal services and apply platform egress restrictions where supported.

`GET /health` is unauthenticated and reports browser connection readiness. `POST /scrape` requires `Authorization: Bearer <secret>` and exactly `{ "url": "https://example.com/" }`. Inputs must be HTTPS homepages without credentials, nonstandard ports, paths, queries or fragments. Public DNS checks apply at input, navigation/subresource interception, proxy connection and final URL. Browser DNS is not pinned to the initial lookup; this is an authenticated service trust boundary, not a claim of DNS rebinding protection equivalent to a pinned direct fetch.

Success returns `{ content, pageStatusCode, sourceURL, url }`, with the requested source and actual final browser URL. One active request is accepted; additional requests fail immediately with 503. Work has a ten-second deadline covering DNS, context creation/setup, navigation and extraction. Deadline or client disconnect initiates context closure, including contexts allocated late. The serialized response cap is 2 MiB. The user agent is fixed to `ThreadplaneCompanyResearch/1.0`; headers, cookies, TLS overrides and other caller options are rejected. Error responses and service logs omit raw URLs, headers and exception values. Startup requires the secret.

Context cleanup retains the admission slot until closure completes. If browser allocation or closure never settles, subsequent requests fail closed with 503; restart the container. Health reports browser connection only, not capacity or a probe capture.

Capture reads the document after `DOMContentLoaded`, without waiting for every page asset to finish loading. Content added asynchronously after that point may be absent.

Run deterministic policy tests from the repository root: `node --test deployments/company-scraper/*.test.cjs`. Run `check-upstream-security.cjs` inside the built image (command in the file) to execute the patched upstream navigation, subresource and proxy checks with controlled public/private DNS answers, including an attempted environment bypass. No hosted Firecrawl account, model keys, queue, database or worker service is needed.
