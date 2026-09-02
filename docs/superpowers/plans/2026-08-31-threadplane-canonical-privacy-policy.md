# Threadplane Canonical Privacy Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Threadplane's public analytics promises and dedicated documentation with one canonical `/privacy` policy, while ensuring no rendered website surface or public response contains the case-insensitive word `telemetry`.

**Architecture:** Keep internal package names, source identifiers, environment variables, logs, and engineering tests intact. Remove the dedicated public docs library, project a sanitized subset of TypeDoc data into the public website, redirect retired routes, and enforce the public-copy boundary in both unit tests and a production crawl.

**Tech Stack:** Next.js 16, React 19, Nx 22, Vitest 4, Playwright, TypeDoc, MDX.

**Spec:** `docs/superpowers/specs/2026-08-31-threadplane-growth-lifecycle-v1-design.md` sections K, M.59–M.65, and N/PR 4.

**Dependency:** Land this plan before enabling default-on runtime analytics. It has no Neon or provider dependency.

**Merge order and dirty-worktree rule:** Land this plan first, then the lifecycle/control-plane plan, then the runtime plan. Before the PR, record `git status --short`; review `git diff -- <owned paths>` and stage only explicit owned paths or hunks. Website, lockfile, and CI changes already present in the worktree are not implicitly part of this plan.

---

## Verified current state

- There is no `/privacy` route, footer privacy link, or legacy redirect.
- `docsConfig` exposes six HTML routes and six `/api/markdown/telemetry/...` routes from `apps/website/content/docs/telemetry/`.
- That config also feeds navigation, docs search, static params, sitemap entries, and markdown lookup; there is no independent search-index file.
- Public occurrences span the dedicated library, three blogs, fourteen narrative docs, three generated API files, the home/pilot-to-prod promise surfaces, `llms.txt`, `llms-full.txt`, and `/api/ingest` error bodies.
- `OpenTelemetry` on Pilot-to-Prod matches the required case-insensitive output scan.
- `YesWall` publishes an install/no-phone-home guarantee without the target word, so it is also removed under the approved no-install-guarantees decision.
- Internal identifiers such as `@threadplane/telemetry`, `AgentRuntimeTelemetry*`, `TelemetryIngestPayload`, and `TPLANE_TELEMETRY_*` are outside this public-copy migration.

## Public copy contract

The canonical policy covers submitted information and communications; website and product analytics; operational/research/support/approved-outreach purposes; Vercel, Neon, PostHog, Resend, Google Workspace, and Anthropic; email opt-out and reply handling; indefinite default retention; deletion requests; security; international processing; changes; and `brian@threadplane.ai` contact information.

It must not contain an event/property catalog, installation behavior claim, exclusion/"never collected" list, "what we won't do" positioning, or an absolute guarantee. The absence of the word from rendered public output is a product-copy decision, not a request to rename internal APIs.

---

## Task 1: Add the canonical policy, sitemap entry, and footer link

**Files:**

- Create: `apps/website/src/app/privacy/page.tsx`
- Create: `apps/website/src/app/privacy/page.spec.tsx`
- Modify: `apps/website/src/lib/site-metadata.ts`
- Modify: `apps/website/src/lib/sitemap-dates.spec.ts`
- Modify: `apps/website/src/components/shared/Footer.tsx`
- Modify: `apps/website/e2e/website.spec.ts`

- [ ] **Step 1: Write failing policy tests.** Render the route and assert the policy has canonical metadata, names the approved data categories/processors, says default retention is indefinite, explains deletion/opt-out/contact, and omits the prohibited promises/catalogs.

- [ ] **Step 2: Write failing discovery tests.** Assert `/privacy` is in `getSitemapRoutes()`/the sitemap and that the global footer links to it.

- [ ] **Step 3: Run the focused red test.**

```bash
npx nx test website -- --run apps/website/src/app/privacy/page.spec.tsx apps/website/src/lib/sitemap-dates.spec.ts
```

Expected: FAIL because the route and sitemap entry do not exist.

- [ ] **Step 4: Implement the policy route.** Use the site's existing metadata/layout primitives. Keep the copy factual and general; do not add a separate analytics disclosure page.

- [ ] **Step 5: Add discovery surfaces.** Add `/privacy` to the static sitemap inventory and a bottom-bar footer link with the existing footer CTA tracking pattern.

- [ ] **Step 6: Re-run the focused test.**

```bash
npx nx test website -- --run apps/website/src/app/privacy/page.spec.tsx apps/website/src/lib/sitemap-dates.spec.ts
```

Expected: PASS.

---

## Task 2: Remove promise-oriented marketing surfaces

**Files:**

- Delete: `apps/website/src/components/landing/Promises.tsx`
- Modify: `apps/website/src/app/page.tsx`
- Modify: `apps/website/src/app/pilot-to-prod/page.tsx`
- Modify: `apps/website/src/components/landing/FinalCTA.tsx`
- Modify: `apps/website/src/components/landing/FinalCTA.spec.tsx`
- Modify: `apps/website/src/components/landing/YesWall.tsx`
- Modify: `apps/website/src/components/landing/YesWall.spec.tsx`
- Modify: `apps/website/src/app/solutions/[slug]/page.tsx`
- Modify: `apps/website/src/app/render/page.tsx`
- Modify: `apps/website/src/styles/landing.css`
- Modify: `apps/website/e2e/website.spec.ts`

- [ ] **Step 1: Make the regression tests express the new surface.** Assert `FinalCTA` has no caption, `YesWall` has fifteen current questions and no install/no-phone-home claim, and the home and Pilot-to-Prod routes do not render a Promises section.

- [ ] **Step 2: Run the focused red test.**

```bash
npx nx test website -- --run apps/website/src/components/landing/FinalCTA.spec.tsx apps/website/src/components/landing/YesWall.spec.tsx
```

Expected: FAIL on the default caption, old question count, and install claim.

- [ ] **Step 3: Delete the whole Promises component and both call sites.** Do not preserve a reduced "what we won't do" section.

- [ ] **Step 4: Remove the `FinalCTA.caption` prop, default, markup, call-site override, and orphaned `.final-cta-caption` rules.**

- [ ] **Step 5: Remove the `YesWall` install/no-phone-home item.** Derive its count from the remaining data or update it to fifteen so the label cannot drift.

- [ ] **Step 6: Reword remaining rendered references.** Change Pilot-to-Prod's `OpenTelemetry hooks` to `Distributed tracing hooks`; use observability/render-event language on the Render page.

- [ ] **Step 7: Remove the orphaned Promises CSS block from `apps/website/src/styles/landing.css`.**

- [ ] **Step 8: Re-run the focused tests.**

```bash
npx nx test website -- --run apps/website/src/components/landing/FinalCTA.spec.tsx apps/website/src/components/landing/YesWall.spec.tsx
```

Expected: PASS.

---

## Task 3: Retire the dedicated docs library and redirect every old route

**Files:**

- Delete: `apps/website/content/docs/telemetry/api/api-docs.json`
- Delete: `apps/website/content/docs/telemetry/getting-started/installation.mdx`
- Delete: `apps/website/content/docs/telemetry/getting-started/introduction.mdx`
- Delete: `apps/website/content/docs/telemetry/guides/browser.mdx`
- Delete: `apps/website/content/docs/telemetry/guides/node.mdx`
- Delete: `apps/website/content/docs/telemetry/guides/privacy-and-opt-out.mdx`
- Delete: `apps/website/content/docs/telemetry/reference/events.mdx`
- Modify: `apps/website/next.config.ts`
- Modify: `apps/website/next.config.spec.ts`
- Modify: `apps/website/src/lib/docs-config.ts`
- Modify: `apps/website/src/lib/docs.spec.ts`
- Modify: `apps/website/src/app/docs/page.tsx`
- Modify: `apps/website/src/components/docs/LibraryMark.tsx`
- Modify: `apps/website/src/components/docs/LibraryMark.spec.tsx`
- Modify: `apps/website/e2e/docs.spec.ts`
- Modify: `apps/website/e2e/website.spec.ts`

- [ ] **Step 1: Add failing redirect and inventory tests.** Cover both exact roots and wildcard descendants for `/docs/telemetry` and `/api/markdown/telemetry`; assert the retired library is absent from slugs, docs cards, search, and sitemap inventory.

- [ ] **Step 1a: Preserve existing configuration coverage.** Extend `next.config.spec.ts`; keep its PostHog rewrite assertions intact while adding redirect assertions.

- [ ] **Step 2: Run the focused red test.**

```bash
npx nx test website -- --run apps/website/src/lib/docs.spec.ts apps/website/next.config.spec.ts apps/website/src/components/docs/LibraryMark.spec.tsx
```

Expected: FAIL because the library remains and redirects are absent.

- [ ] **Step 3: Add permanent redirects.** Add exact-root and `:path*` rules in `next.config.ts`, all targeting `/privacy`, for both public docs and markdown API routes.

- [ ] **Step 4: Delete the seven dedicated public files.** Remove the `LibraryId` member/config block, docs home card, and `LibraryMark` mapping. Search/static params/sitemap/markdown lookup then lose the library through the existing shared configuration.

- [ ] **Step 5: Update existing tests and overflow/crawl matrices.** Replace old route expectations with redirect and absence assertions.

- [ ] **Step 6: Re-run the focused tests.**

```bash
npx nx test website -- --run apps/website/src/lib/docs.spec.ts apps/website/next.config.spec.ts apps/website/src/components/docs/LibraryMark.spec.tsx
```

Expected: PASS.

---

## Task 4: Clean public narrative copy and response bodies

**Files:**

- Modify: `apps/website/content/blog/2026-05-21-build-fullstack-agentic-angular-apps-using-ag-ui.mdx`
- Modify: `apps/website/content/blog/2026-08-09-agentic-ui-in-angular-production-patterns.mdx`
- Modify: `apps/website/content/blog/2026-08-31-what-changes-when-the-runtime-changes.mdx`
- Modify: `apps/website/content/docs/ag-ui/api/inject-agent.mdx`
- Modify: `apps/website/content/docs/ag-ui/api/provide-agent.mdx`
- Modify: `apps/website/content/docs/ag-ui/api/to-agent.mdx`
- Modify: `apps/website/content/docs/ag-ui/concepts/architecture.mdx`
- Modify: `apps/website/content/docs/ag-ui/getting-started/installation.mdx`
- Modify: `apps/website/content/docs/ag-ui/reference/event-mapping.mdx`
- Modify: `apps/website/content/docs/chat/guides/error-handling.mdx`
- Modify: `apps/website/content/docs/chat/guides/lifecycle.mdx`
- Modify: `apps/website/content/docs/chat/guides/thread-routing.mdx`
- Modify: `apps/website/content/docs/langgraph/api/provide-agent.mdx`
- Modify: `apps/website/content/docs/langgraph/concepts/agent-contract.mdx`
- Modify: `apps/website/content/docs/langgraph/getting-started/introduction.mdx`
- Modify: `apps/website/content/docs/langgraph/guides/lifecycle.mdx`
- Modify: `apps/website/content/docs/render/guides/lifecycle.mdx`
- Modify: `apps/website/src/app/llms.txt/route.ts`
- Modify: `apps/website/src/app/llms-full.txt/route.ts`
- Modify: `apps/website/src/app/api/ingest/route.ts`
- Modify: `apps/website/src/app/api/ingest/route.spec.ts`
- Create: `apps/website/src/lib/public-copy.spec.ts`

- [ ] **Step 1: Add a failing content scan.** Scan public blog/docs MDX and generated API JSON case-insensitively. Also reject the approved banned claims: `phone home`, `installation is inert`, `off by default`, and `what we won't do`.

- [ ] **Step 2: Add API response assertions.** Invalid, unconfigured, and failed `/api/ingest` responses must say `event payload`/`event ingest`, while internal type names and log prefixes remain untouched.

- [ ] **Step 3: Run the focused red test.**

```bash
npx nx test website -- --run apps/website/src/lib/public-copy.spec.ts apps/website/src/app/api/ingest/route.spec.ts
```

Expected: FAIL and identify the remaining public content/response strings.

- [ ] **Step 4: Rewrite the three blogs and fourteen narrative docs.** Use observability, instrumentation, diagnostics, logging, or neutral lifecycle language. Delete the three lifecycle guides' absolute privacy sections instead of relabeling them. Remove obsolete links and config rows.

- [ ] **Step 5: Remove the package from both LLM routes.** Delete the JSON import and `API_DOCS` entry from `llms-full.txt`; do not emit an alternative dedicated policy catalog.

- [ ] **Step 6: Reword only public ingest response strings.** Use `Invalid event payload`, `Event ingest is not configured`, and `Event ingest failed`; keep internal source identifiers intact.

- [ ] **Step 7: Re-run the focused tests.**

```bash
npx nx test website -- --run apps/website/src/lib/public-copy.spec.ts apps/website/src/app/api/ingest/route.spec.ts
```

Expected: generated API JSON may still fail; all hand-authored content and public response assertions pass.

---

## Task 5: Project internal TypeDoc APIs safely into public docs

**Files:**

- Create: `apps/website/scripts/public-doc-projection.ts`
- Create: `apps/website/scripts/public-doc-projection.spec.ts`
- Modify: `apps/website/scripts/generate-api-docs.ts`
- Modify: `apps/website/scripts/generate-narrative-docs.ts`
- Verify/regenerate: `apps/website/public/AGENTS.md`
- Verify/regenerate: `apps/website/public/CLAUDE.md`
- Modify generated: `apps/website/content/docs/ag-ui/api/api-docs.json`
- Modify generated: `apps/website/content/docs/chat/api/api-docs.json`
- Modify generated: `apps/website/content/docs/langgraph/api/api-docs.json`

- [ ] **Step 1: Write projection tests before the implementation.** Feed representative TypeDoc objects containing affected entry names, property names, types, signatures, and description sentences. Assert the public projection omits the affected structure, retains unrelated data, does not mutate its input, and throws if serialized output still contains the blocked term.

- [ ] **Step 2: Run the red projection test.**

```bash
npx nx test website -- --run apps/website/scripts/public-doc-projection.spec.ts
```

Expected: FAIL because the projection module does not exist.

- [ ] **Step 3: Implement the pure public projection.** Filter public TypeDoc output only; do not rename `AgentRuntimeTelemetry*`, config fields, or package exports in source.

- [ ] **Step 4: Wire the API generator.** Remove the retired library configuration, apply the projection before writing every remaining public JSON file, and validate the serialized output.

- [ ] **Step 5: Guard narrative generation.** Limit reads to the six remaining public API directories and reject generated MDX before writing if it crosses the boundary.

- [ ] **Step 6: Run the projection test green.**

```bash
npx nx test website -- --run apps/website/scripts/public-doc-projection.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Regenerate deterministic API docs only.** Do not run the Anthropic-backed narrative generator for this PR.

```bash
npm run generate-api-docs
```

Expected: six public API-doc outputs remain, no retired output is recreated, and no generated JSON contains the blocked term.

- [ ] **Step 8: Run the deterministic agent-context generator and scan its public files.** The current output has no occurrence, but the release contract explicitly covers generated public context.

```bash
npm run generate-agent-context
rg -n -i 'telemetry' apps/website/public/AGENTS.md apps/website/public/CLAUDE.md
```

Expected: the generator succeeds, committed outputs are current, and `rg` returns no matches.

---

## Task 6: Add a production-output crawl and finish the rollout gate

**Files:**

- Create: `apps/website/e2e/public-copy.spec.ts`
- Modify: `apps/website/playwright.config.ts`
- Modify: `.github/workflows/ci.yml` only if the existing website E2E job does not already execute all specs

- [ ] **Step 1: Add the E2E boundary test.** Crawl every sitemap URL plus an explicit registry of non-indexed public routes, `/AGENTS.md`, `/CLAUDE.md`, `/llms.txt`, `/llms-full.txt`, representative `/api/markdown` output, and public `/api/ingest` errors. Assert no case-insensitive occurrence; assert the footer link, docs-search absence, canonical policy, and all legacy redirects. Future public routes such as `/connect` must be added to the non-indexed registry in the same PR that creates them.

- [ ] **Step 1a: Add a mandatory production-server mode.** The current Playwright config starts `next dev`. Add a `WEBSITE_E2E_MODE=production` branch whose web server serves the already-completed Nx production build (for example `npx next start . --hostname ... --port ...` from the correct built app directory). Keep the existing dev mode for ordinary tests, but the public-output gate must use production mode.

- [ ] **Step 2: Run the targeted E2E red test against a production build.**

```bash
npx nx build website --configuration=production --skip-nx-cache
WEBSITE_E2E_MODE=production npx nx e2e website -- --grep "public copy boundary"
```

Expected initially: FAIL with any remaining rendered or response occurrence.

- [ ] **Step 3: Fix only the reported public boundary leaks.** Do not expand this into an internal API rename.

- [ ] **Step 4: Run the complete website verification.**

```bash
npx nx test website
npx nx lint website
npx nx build website --configuration=production --skip-nx-cache
WEBSITE_E2E_MODE=production npx nx e2e website
```

Expected: all pass.

- [ ] **Step 5: Run final source and diff checks.**

```bash
rg -n -i 'telemetry' apps/website/content/blog apps/website/content/docs apps/website/public/AGENTS.md apps/website/public/CLAUDE.md
git diff --check
git status --short
```

Expected: `rg` returns no matches; `git diff --check` passes; status contains only intended website changes plus the pre-existing unrelated dirty files.

- [ ] **Step 6: Preview rollout.** Crawl the preview, verify all six docs redirects plus markdown wildcard handling, inspect `/privacy` metadata, footer/search, LLM endpoints, and public API responses.

- [ ] **Step 7: Create one logical commit after all verification.** Repository guidance forbids mid-task commits. Re-record `git status --short`, inspect `git diff -- <explicit privacy-plan-owned paths>`, stage only those paths/hunks, verify `git diff --cached`, and then commit. Never use `git add apps/website`, `git add .`, or include unrelated pre-existing cockpit/lockfile/plan changes.

---

## Acceptance checklist

- `/privacy` is the sole public policy surface for analytics/data handling.
- Every former docs and markdown route redirects permanently to `/privacy`.
- Home and Pilot-to-Prod do not render Promises; `FinalCTA` has no caption; `YesWall` has no install guarantee.
- Public HTML, generated JSON, sitemap/LLM output, markdown responses, and public API response bodies contain no case-insensitive occurrence.
- Internal engineering identifiers and package APIs remain source-compatible.
- The public policy states indefinite default retention and deletion handling without catalogs, exclusions, or absolute promises.
