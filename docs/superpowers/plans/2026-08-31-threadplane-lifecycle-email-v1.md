# Threadplane Lifecycle Email V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace NDJSON, Loops, and provider-scheduled drip mail with a Neon-backed CRM/control plane, durable approval and stop semantics, bounded AI enrichment, Google reply detection, and one plain-text three-message Resend campaign.

**Architecture:** A private buildable `libs/growth` library owns the five Neon tables, transactions, job leases, score calculation, provider ledger, and all send authorization. The website owns forms and signed inbound routes. A separate Node 24 Dawn app leases due work; Vercel Cron reaches it through an authenticated website bridge. Dawn 0.8.21's supported Hono build is deployed through a thin app-owned Vercel adapter that authenticates every Dawn path before delegating. Dawn durable runtime state uses a dedicated Neon database URL and never silently reuses the growth CRM URL. Resend only delivers messages. Google Apps Script reports header-only seed/reply facts. Neon is the v1 CRM.

**Tech Stack:** Nx 22, npm workspaces, TypeScript 5.9/6 boundaries, Neon Postgres 17, `@neondatabase/serverless` 0.10.4, Hono 4.13.5, Resend 6.10.0, Dawn Core/CLI/LangGraph/Postgres Storage/SDK 0.8.21, Node 24, Anthropic SDK 0.79.0, Zod 4.4.3, Vitest 4, Google Apps Script/Gmail advanced service.

**Spec:** `docs/superpowers/specs/2026-08-31-threadplane-growth-lifecycle-v1-design.md` sections E/P0.1–P0.5, P0.9, P1.1–P1.2, P1.5–P1.7, G–J, L, M, and N/PRs 1–3, 6–7.

**Dependencies:** The runtime-analytics plan consumes this plan's `growth_projects`, `growth_activity`, and contact/claim repository. The privacy-policy plan must deploy before default-on product analytics. No campaign may lease until Tasks 1–7 and the live stop-path smoke tests are complete.

**Merge order and dirty-worktree rule:** Apply the privacy plan first, this lifecycle/control-plane plan second, and the runtime plan third. Before each PR phase, record `git status --short`; review `git diff -- <owned paths>` and stage only explicit owned paths or hunks. CI files, website routes, `package-lock.json`, and shared analytics definitions may contain earlier-plan work and must be preserved.

---

## Verified current state

- `migrations/0001_rate_limit_events.sql` is the only migration; there is no migration runner.
- `whitepaper-signup` writes NDJSON, sends designed HTML, schedules Resend day 2/5/10/20 messages, syncs a Resend audience and Loops, and captures email-derived analytics.
- `newsletter` sends designed HTML and syncs Resend/Loops; `leads` writes NDJSON, sends HTML notification, and syncs Resend/Loops.
- `unsubscribe` is a raw-email mutating GET that only appends NDJSON. It neither suppresses nor cancels anything.
- `apps/website/lib/resend.ts` discards provider IDs and only supports HTML plus provider scheduling. The installed SDK supports text, BCC, Reply-To, headers, tags, idempotency keys, cancellation, and verified webhooks.
- `pricing/LeadForm.tsx` shares `/api/leads`, so it needs the same visible disclosure as `ContactForm.tsx`.
- Root `vercel.json` deploys only the website. Dawn 0.8.21 requires Node 24 and has no native Vercel build target; its supported Hono target emits a web-standard Dawn app. A small app-owned Vercel adapter must authenticate every Dawn path and delegate to that generated Hono app, while the website cron bridge remains the sole scheduled caller.

## Ownership and invariants

- `outreach_approved_at` is the only current send-approval field. Setting it is an explicit, provenance-recorded command; clearing it is part of every stop.
- Every recipient send performs the same final database authorization transition immediately before Resend submission.
- A generic form upsert never reverses unsubscribe, complaint, hard bounce, provider suppression, or founder suppression. Reauthorization is a dedicated action.
- Reply stops the automated sequence but does not suppress Brian's human reply.
- Neon schedules all future steps. Resend receives only messages that are due now.
- Campaign enrollment is materialized by the scheduler, not by a form transaction. `CAMPAIGN_ENROLLMENT_ENABLED` controls materialization and is separate from `CAMPAIGN_ENABLED`, which controls leasing/sending. `CAMPAIGN_ENROLLMENT_START_AT` is a required immutable launch timestamp for cohort v1. Only when enrollment is enabled, and only for contacts whose effective `outreach_approved_at` is on/after that timestamp, may the scheduler create `campaign.enrolled:v1`; pre-launch approvals are never backfilled automatically.
- Step 1 is due at enrollment. Its provider acceptance atomically anchors step 2 to at least +3 days and step 3 to at least +8 days; step 2 acceptance also keeps step 3 at least five days later. Pausing and re-enabling can delay cadence but cannot compress it.
- Recipient and internal lifecycle mail is text-only. Campaign mail is from/reply-to Brian, BCCs Brian, and carries `X-Threadplane-Job-ID`.
- AI may draft and summarize; it may not authorize, score, address, schedule, or send.

---

## Phase 1 / PR 1: Neon growth control plane

### Task 1: Scaffold the private growth library and migration runner

**Files:**

- Create: `libs/growth/package.json`
- Create: `libs/growth/project.json`
- Create: `libs/growth/tsconfig.json`
- Create: `libs/growth/tsconfig.lib.json`
- Create: `libs/growth/tsconfig.spec.json`
- Create: `libs/growth/vite.config.mts`
- Create: `libs/growth/src/index.ts`
- Create: `libs/growth/src/lib/models.ts`
- Create: `libs/growth/src/lib/database.ts`
- Create: `libs/growth/test/migrations.integration.spec.ts`
- Create: `migrations/0002_growth_control_plane.sql`
- Create: `migrations/0003_growth_reporting_views.sql`
- Create: `scripts/apply-migrations.mts`
- Create: `scripts/apply-migrations.spec.ts`
- Modify: `tsconfig.base.json`
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Add the Nx project and red integration target.** Define `build`, `test`, `test-integration`, and `lint`; add `@threadplane-internal/growth` to TS paths. Pin runtime dependencies in the library package instead of relying on root hoisting.

- [ ] **Step 2: Write failing migration-runner tests.** Require ordered discovery, one transaction per migration, a migration ledger/checksum, repeatability, and refusal to silently change an already-applied migration.

- [ ] **Step 3: Write the live integration inventory test.** Against `TEST_DATABASE_URL`, require exactly the five growth tables, their constraints/indexes, and five reporting views. Use a disposable Neon branch/database only.

- [ ] **Step 4: Run red.**

```bash
npx nx test growth
npx nx run growth:test-integration
```

Expected: FAIL because the runner/schema do not exist.

- [ ] **Step 5: Implement the lazy SQL executor and runner.** Production code must fail closed when `DATABASE_URL` is missing; tests inject a `SqlExecutor` rather than importing live environment state.

- [ ] **Step 6: Create `0002_growth_control_plane.sql`.** Implement the five approved tables, checks, partial indexes, foreign keys, `updated_at` trigger, and `citext` extension exactly as the design specifies.

- [ ] **Step 7: Create `0003_growth_reporting_views.sql`.** Add `growth_contact_overview_v1`, `growth_funnel_daily_v1`, `growth_campaign_performance_v1`, `growth_job_health_v1`, and `growth_legacy_progress_v1` without exposing raw email outside the contact overview.

- [ ] **Step 8: Add root commands.** Add `db:migrate`, `growth:control`, and `growth:import-resend` scripts.

- [ ] **Step 9: Run green.**

```bash
npx nx test growth
TEST_DATABASE_URL="$TEST_DATABASE_URL" npx nx run growth:test-integration
npx nx lint growth
npx nx build growth
```

Expected: all pass; a second migration run applies zero statements and preserves checksums.

### Task 2: Implement identity lookup, approval, hard-stop history, and deletion

**Files:**

- Create: `libs/growth/src/lib/crypto.ts`
- Create: `libs/growth/src/lib/crypto.spec.ts`
- Create: `libs/growth/src/lib/contacts.ts`
- Create: `libs/growth/src/lib/contacts.spec.ts`
- Create: `libs/growth/test/contacts.integration.spec.ts`

- [ ] **Step 1: Test normalized private lookup.** Require versioned `HMAC-SHA-256(secret, normalized_email)`, constant-time comparison helpers, no raw email/hash analytics projection, and rotation support for active plus previous keys.

- [ ] **Step 2: Test approval semantics.** `approveContactFromForm` upserts bounded facts, records exact notice/source/version, and sets the timestamp only when no later hard stop exists. A repeated form after a hard stop stays unapproved. `reauthorizeContact` records a distinct founder action.

- [ ] **Step 3: Test deletion.** Cancel work, unlink projects, delete artifacts and raw mappings, retain only the private suppression HMAC plus minimal stop/delivery audit, and make stale jobs unable to restore data.

- [ ] **Step 4: Run red then implement.**

```bash
npx nx test growth -- --run libs/growth/src/lib/crypto.spec.ts libs/growth/src/lib/contacts.spec.ts
TEST_DATABASE_URL="$TEST_DATABASE_URL" npx nx run growth:test-integration
```

Expected before implementation: FAIL. Expected after: PASS, including concurrent approval/stop fixtures.

### Task 3: Implement durable jobs, leases, score calculation, and artifacts

**Files:**

- Create: `libs/growth/src/lib/jobs.ts`
- Create: `libs/growth/src/lib/jobs.spec.ts`
- Create: `libs/growth/src/lib/scoring.ts`
- Create: `libs/growth/src/lib/scoring.spec.ts`
- Create: `libs/growth/test/jobs.integration.spec.ts`
- Create: `libs/growth/test/concurrency.integration.spec.ts`

- [ ] **Step 1: Test idempotent cohort enrollment and cadence.** With `CAMPAIGN_ENROLLMENT_ENABLED=false`, no approval materializes campaign jobs. After enabling it with immutable `CAMPAIGN_ENROLLMENT_START_AT`, approvals before the timestamp remain excluded; a contact approved on/after it receives one `campaign.enrolled:v1` activity and keys `campaign:v1:<contact-id>:step:1|2|3`. Re-enrollment cannot duplicate them. Step 1 is due at enrollment; provider acceptance anchors step 2 no earlier than +3 days and step 3 no earlier than +8 days (and at least five days after step 2), so pause/re-enable cannot compress the sequence.

- [ ] **Step 2: Test the atomic lease CTE.** Use `FOR UPDATE SKIP LOCKED`, bounded batches, UUID lease tokens, attempt increment, lease renewal, and expired-lease reclamation.

- [ ] **Step 3: Test transitions.** Step 2/3 require previous provider acceptance; known submission stores provider ID; ambiguous acceptance becomes `delivery_status='unknown'` and is not blindly retried outside the provider idempotency window.

- [ ] **Step 4: Test deterministic scoring.** Recompute from set-based activities using score version/reason codes and caps; never increment imperatively and never accept an AI-computed value.

- [ ] **Step 5: Run red then implement.**

```bash
npx nx test growth -- --run libs/growth/src/lib/jobs.spec.ts libs/growth/src/lib/scoring.spec.ts
TEST_DATABASE_URL="$TEST_DATABASE_URL" npx nx run growth:test-integration
```

Expected after implementation: PASS under duplicate and concurrent lease attempts.

---

## Phase 2 / PR 2: Durable stops and provider callbacks

### Task 4: Implement the canonical stop transaction and founder controls

**Files:**

- Create: `libs/growth/src/lib/stops.ts`
- Create: `libs/growth/src/lib/stops.spec.ts`
- Create: `libs/growth/test/stops.integration.spec.ts`
- Create: `scripts/growth-control.mts`
- Create: `scripts/growth-control.spec.ts`

- [ ] **Step 1: Test one atomic stop.** It clears approval, inserts one unique reason activity, cancels pending and unsent leased jobs, preserves submitted/completed records, and returns matching scheduled legacy provider IDs for best-effort cancellation.

- [ ] **Step 2: Test idempotency and races.** Repeat the same stop, race stop against the final send transition, and prove no later submission is silently authorized; record the bounded provider race for manual review.

- [ ] **Step 3: Test provider-sync policy.** Unsubscribe, complaint, hard bounce, provider suppression, invalid address, and manual suppression synchronize provider contact state. Reply only ends automation.

- [ ] **Step 4: Test founder CLI controls.** Support `status|approve|stop|delete --email`; approval and deletion are explicit provenance-bearing commands. The signed founder-stop route is deferred to Task 5 after its token primitive exists.

- [ ] **Step 5: Run red then implement.**

```bash
npx nx test growth
npx vitest run scripts/growth-control.spec.ts
TEST_DATABASE_URL="$TEST_DATABASE_URL" npx nx run growth:test-integration
```

Expected after implementation: PASS; repeating a stop does not create a second state transition.

### Task 5: Replace raw-email unsubscribe with signed GET/POST behavior

**Files:**

- Create: `libs/growth/src/lib/tokens.ts`
- Create: `libs/growth/src/lib/tokens.spec.ts`
- Modify: `apps/website/src/app/api/unsubscribe/route.ts`
- Create: `apps/website/src/app/api/unsubscribe/route.spec.ts`
- Create: `apps/website/src/app/api/growth/stop/route.ts`
- Create: `apps/website/src/app/api/growth/stop/route.spec.ts`

- [ ] **Step 1: Test the token.** Payload contains random contact UUID, purpose, key version, and issued-at; HMAC validation is constant-time. Active unsubscribe keys may be long-lived; founder-stop tokens are short-lived.

- [ ] **Step 2: Test route semantics.** `GET ?token=` renders confirmation without mutation; POST performs the stop without a cookie and supports `List-Unsubscribe-Post`. Tampered, wrong-purpose, expired-policy, unknown-key, and unknown-contact responses are uniform.

- [ ] **Step 3: Preserve legacy compatibility.** Existing `GET ?email=` calls the same canonical stop transaction; no newly generated message may contain a raw email URL.

- [ ] **Step 3a: Add the signed founder-stop route.** Use the now-tested purpose-bound short-lived token, POST confirmation, uniform errors, and the canonical stop transaction.

- [ ] **Step 4: Run red then implement.**

```bash
npx nx test growth -- --run libs/growth/src/lib/tokens.spec.ts
npx nx test website -- --run apps/website/src/app/api/unsubscribe/route.spec.ts apps/website/src/app/api/growth/stop/route.spec.ts
```

Expected after implementation: PASS; confirmation GET leaves approval unchanged, POST clears it.

### Task 6: Add the Resend ledger, text send policy, and verified webhooks

**Files:**

- Create: `libs/growth/src/lib/resend.ts`
- Create: `libs/growth/src/lib/resend.spec.ts`
- Create: `libs/growth/src/lib/webhooks.ts`
- Create: `libs/growth/src/lib/webhooks.spec.ts`
- Create: `apps/website/src/app/api/webhooks/resend/route.ts`
- Create: `apps/website/src/app/api/webhooks/resend/route.spec.ts`

- [ ] **Step 1: Test the recipient send contract.** Text only; no `html`; sender/reply-to Brian; BCC Brian; `X-Threadplane-Job-ID`; opaque unsubscribe headers; provider tags; job idempotency key; provider ID returned and persisted.

- [ ] **Step 2: Test production gates.** `DELIVERY_ENABLED=true`, production environment, verified sender configuration, and allowlisted recipients in preview/test. `CAMPAIGN_ENABLED=false` blocks only `send_step` leasing.

- [ ] **Step 3: Test webhook verification before parsing.** Read `request.text()`, verify the three Svix headers with `resend.webhooks.verify`, and use `resend:<svix-id>` as the replay key.

- [ ] **Step 4: Test closed status mapping.** Apply sent, delivered, delayed, permanent bounced, complained, suppressed, and failed. Ignore open/click. Hard bounce, complaint, and suppression invoke the canonical stop.

- [ ] **Step 5: Run red then implement.**

```bash
npx nx test growth -- --run libs/growth/src/lib/resend.spec.ts libs/growth/src/lib/webhooks.spec.ts
npx nx test website -- --run apps/website/src/app/api/webhooks/resend/route.spec.ts
```

Expected after implementation: forged/replayed events do nothing; accepted events append one activity and never regress delivery state.

### Task 7: Add metadata-only Google Workspace reply polling

**Files:**

- Create: `libs/growth/src/lib/replies.ts`
- Create: `libs/growth/src/lib/replies.spec.ts`
- Create: `apps/website/src/app/api/growth/replies/google/route.ts`
- Create: `apps/website/src/app/api/growth/replies/google/route.spec.ts`
- Create: `tools/google-mailbox-poller/project.json`
- Create: `tools/google-mailbox-poller/vite.config.mts`
- Create: `tools/google-mailbox-poller/Code.gs`
- Create: `tools/google-mailbox-poller/Code.spec.ts`
- Create: `tools/google-mailbox-poller/appsscript.json`
- Create: `tools/google-mailbox-poller/README.md`

- [ ] **Step 1: Test the HMAC envelope.** Canonical input is `<timestamp>\n<nonce>\n<sha256(raw-json-body)>`; accept five minutes, reject stale signatures/replayed nonces, and dedupe Gmail message IDs.

- [ ] **Step 2: Test seed registration.** Brian-originated mail with `X-Threadplane-Job-ID` binds Gmail seed ID and RFC Message-ID only to a valid submitted/completed job and never stops a sequence.

- [ ] **Step 3: Test reply matching.** Match `In-Reply-To`, then `References`; never guess by sender. Normal and out-of-office replies invoke the canonical reply stop. An unknown reference enqueues `reply_reconcile:gmail:<message-id>` with headers only.

- [ ] **Step 4: Test data minimization.** Request payloads, logs, activities, jobs, and artifacts must contain no body/snippet field.

- [ ] **Step 5: Implement the Apps Script.** Use one every-minute installable trigger; request only `From`, `Message-ID`, `X-Threadplane-Job-ID`, `In-Reply-To`, and `References`; sort oldest-first; keep an overlapping cursor window; advance only after acknowledged posts.

- [ ] **Step 6: Run red then green.**

```bash
npx nx test website -- --run apps/website/src/app/api/growth/replies/google/route.spec.ts
npx nx test google-mailbox-poller
npx nx test growth -- --run libs/growth/src/lib/replies.spec.ts
```

Expected after implementation: PASS, including reply-before-seed reconciliation.

- [ ] **Step 7: Run a real Workspace smoke test before campaign rollout.** BCC a test send, observe the seed and reply in one Gmail thread, confirm stop within the polling interval, and confirm Brian's manual reply addresses the recipient.

---

## Phase 3 / PR 3: Forms and legacy cutover

### Task 8: Make form acceptance a durable transaction

**Files:**

- Create: `libs/growth/src/lib/forms.ts`
- Create: `libs/growth/src/lib/forms.spec.ts`
- Create: `apps/website/src/lib/growth/form-policy.ts`
- Create: `apps/website/src/lib/growth/form-policy.spec.ts`
- Modify: `apps/website/src/app/api/whitepaper-signup/route.ts`
- Modify: `apps/website/src/app/api/newsletter/route.ts`
- Modify: `apps/website/src/app/api/leads/route.ts`
- Create: `apps/website/src/app/api/whitepaper-signup/route.spec.ts`
- Create: `apps/website/src/app/api/newsletter/route.spec.ts`
- Modify: `apps/website/src/app/api/leads/route.spec.ts`
- Modify: `apps/website/src/components/landing/WhitePaperBlock.tsx`
- Modify: `apps/website/src/components/shared/AnnouncementToast.tsx`
- Modify: `apps/website/src/components/shared/Footer.tsx`
- Modify: `apps/website/src/components/contact/ContactForm.tsx`
- Modify: `apps/website/src/components/contact/ContactForm.spec.tsx`
- Modify: `apps/website/src/components/pricing/LeadForm.tsx`
- Create component tests for WhitePaperBlock, AnnouncementToast, Footer newsletter, and pricing LeadForm where none exist

- [ ] **Step 1: Test `acceptFormSubmission`.** In one transaction normalize/upsert contact, record the exact active server policy/source/version, and set approval only when eligible. Always enqueue requested fulfillment. Enqueue enrichment and internal-summary only when the transaction's effective approval is non-null; a generic form after unsubscribe, complaint, hard bounce, provider suppression, or founder suppression creates no campaign work. Forms never create `send_step` rows; the scheduler's versioned cohort enrollment does that after launch.

- [ ] **Step 2: Test fulfillment independence.** The route succeeds only after Neon acceptance; email/enrichment/nudge failures do not erase the accepted record or block later recovery.

- [ ] **Step 3: Test all route contracts red.** One disclosed submission creates one contact/activity/job set; repeated calls dedupe; a hard-stopped contact remains unapproved; no NDJSON, Loops, Resend audience, old scheduled message, or PostHog PII call occurs.

- [ ] **Step 4: Test exact visible disclosure.** Whitepaper: `Send me the guide and a short, three-email follow-up from Brian about building with Threadplane. Unsubscribe anytime.` Contact/pricing: `By sending, you agree Brian may follow up by email about your request.` Newsletter: `Subscribe to Threadplane updates and a short, three-email welcome from Brian. Unsubscribe anytime.`

- [ ] **Step 4a: Test one server-controlled cutover policy.** `form-policy.ts` is server-only and selects both route behavior and the props passed from server pages/layout into every client form. `legacy` mode renders the legacy UI and uses the legacy route path; `growth_v1` renders the exact three-email notice and accepts only the matching policy version into Neon. A submitted stale/mismatched policy version is rejected with a retryable response. No independent `NEXT_PUBLIC_*` switch may let copy and server behavior diverge.

- [ ] **Step 5: Run red.**

```bash
npx nx test growth -- --run libs/growth/src/lib/forms.spec.ts
npx nx test website -- --run apps/website/src/app/api/whitepaper-signup/route.spec.ts apps/website/src/app/api/newsletter/route.spec.ts apps/website/src/app/api/leads/route.spec.ts apps/website/src/components/contact/ContactForm.spec.tsx
```

Expected: FAIL on the current provider-first/NDJSON behavior and absent notices.

- [ ] **Step 6: Implement the routes/components behind the server-controlled form policy.** Carry only bounded submitted facts, the active policy version, and the current short-lived acquisition session ID. `legacy` preserves old copy/behavior temporarily; `growth_v1` changes both the rendered disclosure and server transaction together, commits to Neon, and makes a best-effort lifecycle nudge. Do not switch the server policy until Tasks 11–14 are deployed and can fulfill a new signup.

- [ ] **Step 7: Run the full website suite.**

```bash
npx nx test website
npx nx lint website
npx nx build website --configuration=production
```

Expected: PASS.

### Task 9: Import live Resend state without enrolling or bulk-cancelling it

**Files:**

- Create: `scripts/import-resend-lifecycle.mts`
- Create: `scripts/import-resend-lifecycle.spec.ts`
- Create: `docs/superpowers/runbooks/2026-08-31-growth-lifecycle-cutover.md`

- [ ] **Step 1: Test pagination and redacted dry-run output.** Enumerate contacts and scheduled email objects; never print raw addresses.

- [ ] **Step 2: Test guarded apply.** `--apply --expected-contacts 14 --expected-scheduled 17` aborts if the live snapshot drifted; imports contacts unapproved and scheduled messages as legacy ledger jobs with provider ID/due time; never calls cancel.

- [ ] **Step 3: Test rerun and selective stop.** Provider ID/idempotency keys make reruns safe; a later canonical stop cancels only that contact's still-pending legacy provider IDs.

- [ ] **Step 4: Run red then implement.**

```bash
npx vitest run scripts/import-resend-lifecycle.spec.ts
npm run growth:import-resend -- --dry-run
```

Expected after implementation: tests pass and dry-run prints only counts/status. Do not run `--apply` until preview migrations and stop paths are deployed.

### Post-rollout cleanup PR: Remove obsolete provider-first machinery only after the new worker is live

**Files:**

- Delete: `apps/website/lib/drip.ts`
- Delete: `apps/website/lib/loops.ts`
- Delete: `apps/website/lib/resend.ts`
- Delete: `apps/website/emails/angular-download.ts`
- Delete: `apps/website/emails/chat-download.ts`
- Delete: `apps/website/emails/drip-angular-followup.ts`
- Delete: `apps/website/emails/drip-chat-followup.ts`
- Delete: `apps/website/emails/drip-render-followup.ts`
- Delete: `apps/website/emails/drip-whitepaper-followup.ts`
- Delete: `apps/website/emails/email-wrapper.ts`
- Delete: `apps/website/emails/lead-notification.ts`
- Delete: `apps/website/emails/newsletter-welcome.ts`
- Delete: `apps/website/emails/render-download.ts`
- Delete: `apps/website/emails/whitepaper-download.ts`
- Delete: `apps/website/src/app/api/email-preview/route.ts`
- Modify: `apps/website/src/app/api/whitepaper-signup/route.ts`
- Modify: `apps/website/src/app/api/newsletter/route.ts`
- Modify: `apps/website/src/app/api/leads/route.ts`
- Modify: their route/component policy tests

- [ ] **Step 0: Confirm the deployment dependency.** This is a separate post-rollout cleanup PR, not part of Phase 3/PR 3. Do not execute it until Tasks 11–14 are deployed, the `growth_v1` server policy has delivered a real requested guide through the new queue, and rollback no longer needs the old path.

- [ ] **Step 1: Prove no live imports remain.**

```bash
rg -n "lib/(drip|loops|resend)|emails/|scheduleWhitepaperDrip|loopsUpsertContact|scheduledAt" apps/website
```

Expected before deletion: only obsolete implementation/tests. After deletion: no live matches.

- [ ] **Step 2: Remove the fallback before deleting imports.** Change all three form routes/components to accept only `growth_v1`, delete the legacy branch/feature-policy fallback, and run their tests. Then delete obsolete files and now-unused configuration. Do not remove the root `resend` dependency; `libs/growth` and lifecycle still use it.

- [ ] **Step 3: Re-run website verification.**

```bash
npx nx test website
npx nx lint website
npx nx build website --configuration=production
```

Expected: PASS.

---

## Phase 4 / PR 6: Dawn dispatcher and bounded enrichment

### Task 11: Scaffold the Node 24 Dawn lifecycle service and cron bridge

**Files:**

- Create: `apps/lifecycle/package.json`
- Create: `apps/lifecycle/project.json`
- Create: `apps/lifecycle/tsconfig.json`
- Create: `apps/lifecycle/vitest.config.ts`
- Create: `apps/lifecycle/dawn.config.ts`
- Create: `apps/lifecycle/vercel.json`
- Create: `apps/lifecycle/api/index.ts`
- Create: `apps/lifecycle/scripts/verify-vercel-adapter.mts`
- Create: `apps/lifecycle/scripts/verify-vercel-adapter.spec.ts`
- Create: `apps/lifecycle/src/middleware.ts`
- Create: `apps/lifecycle/src/app/dispatch/index.ts`
- Create: `apps/lifecycle/src/app/dispatch/state.ts`
- Create: `apps/lifecycle/src/dispatcher.ts`
- Create: `apps/lifecycle/src/dispatcher.spec.ts`
- Create: `apps/website/src/lib/growth/lifecycle-client.ts`
- Create: `apps/website/src/lib/growth/lifecycle-client.spec.ts`
- Create: `apps/website/src/app/api/cron/lifecycle/route.ts`
- Create: `apps/website/src/app/api/cron/lifecycle/route.spec.ts`
- Modify: `vercel.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Pin the lifecycle runtime.** In its own package declare Dawn Core/CLI/LangGraph/Postgres Storage/SDK `0.8.21`, `@neondatabase/serverless` `0.10.4`, Hono `4.13.5`, Anthropic `0.79.0`, Zod `4.4.3`, Resend `6.10.0`, the private growth library, and `engines.node >=24`. `dawn.config.ts` directly imports `@dawn-ai/core`, so declare it directly rather than relying on the CLI's transitive dependency. The generated Dawn stores must receive a dedicated `DAWN_DATABASE_URL`; missing configuration fails closed, and neither the adapter nor generated output may fall back to the growth `DATABASE_URL`.

- [ ] **Step 2: Write red dispatcher tests.** Reject missing/wrong service bearer tokens; dispatch a bounded lease batch; recover expired leases; propagate Dawn's `AbortSignal`; ensure duplicate cron invocations cannot duplicate effects. The Dawn dispatcher must route every leased job through the exported `dispatchGrowthLeasedJob` boundary in `libs/growth`; it must not duplicate the job-kind switch or call reply reconciliation settlement directly. Assert that an unmatched `mailbox.recovery_required` activity pauses `send_step` and `reply_reconcile` leasing, returns `recovery_paused` for an already leased reconciliation job, blocks final Resend submission, and that the matching `mailbox.recovery_completed` activity is observed before leasing resumes. Surface the unmatched recovery as an operator-visible closed alert; no worker path may bypass this boundary.

- [ ] **Step 3: Configure Dawn and the Vercel adapter.** Use `appDir: 'src/app'`, Dawn 0.8.21's supported `hono` target, `/dispatch#workflow`, and middleware with a dedicated service token. Add a thin app-owned Vercel entry that authenticates the exact service bearer token for every path—including health, thread management/state/cancel, execution, AG-UI, and memory surfaces—before delegating to the generated `.dawn/build/app.mjs`; route middleware is defense in depth. The build must rewrite only the generated runtime's database lookup from dedicated `DAWN_DATABASE_URL` or compose equivalent dedicated stores, never copy it into a generic `DATABASE_URL`. A post-build verifier must fail if the expected generated app or default fetch-compatible export is absent and must exercise a local authenticated request through the adapter.

- [ ] **Step 4: Write red website bridge tests.** Require Vercel `Authorization: Bearer $CRON_SECRET`; create a unique Dawn thread and invoke `/threads/<uuid>/runs/wait` with route `/dispatch#workflow`; treat form nudges as best effort.

- [ ] **Step 5: Add the every-minute root cron.** Route it to `/api/cron/lifecycle`; do not expose the Dawn service secret as `NEXT_PUBLIC_*`.

- [ ] **Step 6: Run red then green.** The lifecycle build runs Dawn first, then the adapter verifier. Cron remains disabled until the post-build and deployed dogfood gates pass.

```bash
npx nx test lifecycle
npx nx run lifecycle:check
npx nx build lifecycle
npx nx test website -- --run apps/website/src/lib/growth/lifecycle-client.spec.ts apps/website/src/app/api/cron/lifecycle/route.spec.ts
```

Expected after implementation: PASS on Node 24. The website continues to build on its existing Node lane.

### Task 12: Implement bounded deterministic research and one structured Claude call

**Files:**

- Create: `apps/lifecycle/src/enrichment/schema.ts`
- Create: `apps/lifecycle/src/enrichment/research-input.ts`
- Create: `apps/lifecycle/src/enrichment/research-input.spec.ts`
- Create: `apps/lifecycle/src/enrichment/company-fetch.ts`
- Create: `apps/lifecycle/src/enrichment/company-fetch.spec.ts`
- Create: `apps/lifecycle/src/enrichment/anthropic.ts`
- Create: `apps/lifecycle/src/enrichment/anthropic.spec.ts`

- [ ] **Step 1: Test the input boundary.** Permit only persisted form facts, deterministic score/reasons, bounded company pages, and an explicitly linked compact project summary. Personal-email domains take the neutral path.

- [ ] **Step 2: Test the fetcher against SSRF.** Derive HTTPS origin only from validated `company_domain`; resolve every hop; reject loopback/private/link-local/reserved IPs and non-HTTPS; cap at three pages, three redirects, 250 KiB/page, five seconds/page.

- [ ] **Step 3: Test persisted evidence.** Keep bounded extracted facts, URL, retrieval time, and content hash; never store full page bodies.

- [ ] **Step 4: Test the Zod 4 artifact.** Require bounded summary/confidence/cited signals/company profile/score version and reasons/recommended angle/sources/exactly three drafts. Forbid approval, recipient, due time, and delivery state.

- [ ] **Step 5: Test the model call.** One `messages.parse` using `claude-sonnet-4-6` default, 1,200 max output tokens, 30-second timeout, SDK retries disabled, and the Dawn signal. The scheduler owns one retry; after five minutes step 1 gets a neutral fallback.

- [ ] **Step 6: Run red then implement.**

```bash
npx nx test lifecycle -- --run apps/lifecycle/src/enrichment
```

Expected after implementation: PASS; model output cannot affect authorization or score.

---

## Phase 5 / PR 7: Hardcoded founder campaign

### Task 13: Add plain-text fulfillment, internal notifications, and campaign templates

**Files:**

- Create: `apps/lifecycle/src/fulfillment/templates.ts`
- Create: `apps/lifecycle/src/fulfillment/templates.spec.ts`
- Create: `apps/lifecycle/src/notifications/templates.ts`
- Create: `apps/lifecycle/src/notifications/templates.spec.ts`
- Create: `apps/lifecycle/src/campaign/templates.ts`
- Create: `apps/lifecycle/src/campaign/templates.spec.ts`

- [ ] **Step 1: Write exact template constraints.** Every output is a string, campaign steps are at most 120 words, one question, at most one useful link, no calendar link, no HTML/tracking markup, and no phrase implying surveillance such as `I saw you`.

- [ ] **Step 2: Cover the four entry contexts.** Whitepaper fulfills the requested guide; newsletter welcomes; contact/pricing acknowledges the request; explicit connect refers only to facts the person submitted or claimed.

- [ ] **Step 3: Include the internal summary.** Show bounded sources/reasons/draft preview and a short-lived founder stop URL, without granting send authority.

- [ ] **Step 4: Run red then implement.**

```bash
npx nx test lifecycle -- --run apps/lifecycle/src/fulfillment apps/lifecycle/src/notifications apps/lifecycle/src/campaign/templates.spec.ts
```

Expected after implementation: PASS.

### Task 14: Execute the campaign through the final send gate

**Files:**

- Create: `apps/lifecycle/src/campaign/send.ts`
- Create: `apps/lifecycle/src/campaign/send.spec.ts`
- Modify: `apps/lifecycle/src/dispatcher.ts`
- Modify: `libs/growth/src/lib/jobs.ts`
- Modify: `libs/growth/src/lib/resend.ts`
- Create: `libs/growth/src/lib/campaign-analytics.ts` (closed aggregate outcome definitions consumed by the later runtime/PostHog plan; this plan does not edit shared dashboards)
- Create: `docs/superpowers/runbooks/2026-08-31-growth-lifecycle-operations.md`

- [ ] **Step 1: Test enrollment, dispatch, and copy ownership.** `CAMPAIGN_ENROLLMENT_ENABLED=false` creates no campaign rows regardless of approval. When enabled, materialize `campaign.enrolled:v1` only for approved contacts on/after immutable `CAMPAIGN_ENROLLMENT_START_AT`; prove pre-launch contacts remain excluded when the separate `CAMPAIGN_ENABLED` leasing switch later turns on. Step 1 waits for the artifact until enrollment + five minutes, then uses neutral fallback. The three AI-produced subject/body drafts are eligible recipient inputs only after schema, evidence, word/question/link/style, and prohibited-claim validation; each maps to its fixed step. A rejected or missing draft uses the hardcoded neutral template. Signature, unsubscribe footer, recipient, due time, and send authority are deterministic. Each provider acceptance pushes later `available_at` forward to preserve +3/+8 cadence; an overdue backlog can never send in a burst.

- [ ] **Step 2: Test final authorization.** Immediately before provider submission, atomically require contact exists/not deleted, approval non-null, no superseding stop, campaign/delivery switches active, and lease token valid.

- [ ] **Step 3: Test provider outcomes.** A known acceptance persists provider ID and completes the job; a timeout/ambiguous response becomes unknown/manual review; no duplicate cron/lease execution creates a second submission.

- [ ] **Step 4: Test every stop path at every campaign point.** Unsubscribe, reply, bounce, complaint, provider suppression, founder stop, deletion, and re-submitted generic form all prevent later steps.

- [ ] **Step 5: Run red then green.**

```bash
npx nx test lifecycle -- --run apps/lifecycle/src/campaign
TEST_DATABASE_URL="$TEST_DATABASE_URL" npx nx run growth:test-integration
```

Expected after implementation: PASS.

---

## Task 15: CI, deploy, and controlled cutover

**Files:**

- Modify: `scripts/ci-scope.mjs`
- Modify: `scripts/ci-scope.spec.mjs`
- Modify: `scripts/ci-workflow.spec.mjs`
- Modify: `.github/workflows/ci.yml`
- Modify: `apps/website/e2e/public-copy.spec.ts`
- Finalize: `docs/superpowers/runbooks/2026-08-31-growth-lifecycle-cutover.md`
- Finalize: `docs/superpowers/runbooks/2026-08-31-growth-lifecycle-operations.md`

- [ ] **Step 1: Add affected scopes and CI lanes.** Growth and website stay on Node 22. Lifecycle installs/tests/builds on Node 24. Google poller tests run in the growth/lifecycle lane.

- [ ] **Step 1a: Extend the permanent public-output boundary.** Add the new unsubscribe, founder-stop, Resend-webhook, Google-reply, and cron routes to `apps/website/e2e/public-copy.spec.ts`. Exercise safe unauthenticated/error responses (and unsubscribe confirmation with a fixture token) and assert none reintroduces the blocked public website term. Preserve the privacy plan's existing route registry and assertions.

- [ ] **Step 2: Verify CI configuration.**

```bash
node --test scripts/ci-scope.spec.mjs scripts/ci-workflow.spec.mjs
```

Expected: PASS with changes to growth/lifecycle files selecting the correct jobs.

- [ ] **Step 3: Run all local gates.**

```bash
npx nx run-many -t lint --projects=growth,website,lifecycle
npx nx run-many -t test --projects=growth,website,lifecycle,google-mailbox-poller
TEST_DATABASE_URL="$TEST_DATABASE_URL" npx nx run growth:test-integration
npx nx run-many -t build --projects=growth,website,lifecycle
git diff --check
```

Expected: all pass on the required Node versions.

- [ ] **Step 4: Apply preview migrations and deploy stop surfaces first.** Register only sent/delivered/delivery-delayed/bounced/complained/failed/suppressed Resend webhooks. Do not subscribe to open/click.

- [ ] **Step 5: Authorize and smoke-test the Apps Script.** Store the dedicated secret in Script Properties; verify a real seed/reply thread and no body persistence.

- [ ] **Step 6: Reconcile live legacy state.** Run dry-run, require the then-current snapshot to match explicit `--expected-*` values (initial investigation was 14 contacts/17 scheduled), then apply. Never bulk-cancel.

- [ ] **Step 7: Deploy lifecycle as a separate protected Vercel project.** Configure Node 24, production/preview growth Neon separation, an app-dedicated `DAWN_DATABASE_URL`, `CRON_SECRET`, lifecycle service secret, Anthropic/Resend keys, email HMAC/token keys, sender gates, immutable `CAMPAIGN_ENROLLMENT_START_AT`, and both enrollment/leasing switches off. The adapter must cover every Dawn path; verify unauthenticated health/thread/state/cancel requests are rejected before verifying authenticated health and cron dispatch.

- [ ] **Step 7a: Complete the Dawn Hono/Vercel dogfood gate before enabling cron.** Exercise outer auth, health, a named-thread `/threads/<uuid>/runs/wait` call for `/dispatch#workflow`, duplicate cron dispatch, mailbox recovery pause/resume, Dawn `AbortSignal` propagation plus cancel behavior, and dedicated Neon thread/checkpoint persistence across fresh instances. Record the exact generated artifacts, adapter behavior, and provider/runtime findings. Send the dogfood findings to Dawn task `01a05e2f-7e93-7bd0-af74-f13d5a7719cd` for a generalized upstream backport. Keep the cron disabled until every item passes; this task authors the checklist but does not deploy or call live services.

- [ ] **Step 8: Enable the form canary only after the service is healthy.** With campaign leasing disabled, switch the server form policy to `growth_v1` for a test signup and prove the requested content is accepted by Resend from the durable fulfillment job. Then confirm no new NDJSON, Loops write, Resend audience upsert, or provider-scheduled follow-up occurs. Only after this smoke test may the post-rollout cleanup PR delete the old path.

- [ ] **Step 9: Verify sender identity from received mail.** Confirm threadplane.ai SPF, DKIM, DMARC, Return-Path, List-Unsubscribe, List-Unsubscribe-Post, BCC seed, Reply-To, and no open/click rewriting.

- [ ] **Step 10: Roll through shadow and allowlist.** Shadow jobs; internal/test recipients; `DELIVERY_ENABLED=true` with both campaign switches false to prove fulfillment. At launch, set the immutable cohort timestamp to the launch instant, turn enrollment on for test contacts, then turn leasing on; expand to a small new-whitepaper cohort with daily unknown-send/job-health review. Never move the cohort timestamp backward to harvest the pre-launch backlog.

- [ ] **Step 11: Create one logical commit per completed PR phase, never mid-task.** Re-record `git status --short`, inspect `git diff -- <explicit phase-owned paths>`, and stage only those paths/hunks. Never use `git add .`, a broad app-directory add, or overwrite the already-dirty lockfile/CI files.

---

## Runtime-plan integration contract

The runtime plan, not this plan, owns `/connect`, its fragment-clearing UI, and the project-claim route. This plan must export a transaction callable after successful claim proof that links the existing `growth_projects` row, applies the explicit connect notice/approval, and enqueues the same lifecycle jobs. UUID-only, wrong, conflicting, replayed, or consumed claims remain the runtime plan's responsibility.

## Acceptance checklist

- Neon contains the five canonical tables and reporting views; all migrations are repeatable.
- Every new eligible form has exact visible disclosure and one durable accepted transaction.
- `outreach_approved_at` is required at the final send gate; every stop clears it and cancels pending work.
- New unsubscribe links are opaque; human GET does not mutate; one-click POST works; legacy raw links converge on the same stop.
- Resend IDs/statuses and verified webhook events are durable; open/click tracking is disabled and unused.
- Google header-only reply facts stop the sequence without storing bodies or guessing by sender.
- The only automated campaign is ready/day-3/day-8, text-only, founder-style, and Neon scheduled.
- AI enrichment is bounded, cited, structured, retry-limited, and has no authority.
- Legacy contacts remain unapproved; legacy scheduled messages continue unless that contact hits a canonical stop.
