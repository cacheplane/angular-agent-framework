# Growth lifecycle operations

Status: **LOCAL implementation and harness only.** No Vercel, Neon, Resend, Google mailbox, or deployed Dawn cutover has been performed. All disposable database, preview, and production gates below require explicit operator authorization.

## Gate classes

- **LOCAL**: source, unit, lint, build, and fake-fixture checks only.
- **DISPOSABLE DB — explicit authorization required**: mutable isolated database checks, including `growth:test-integration`.
- **PREVIEW LIVE — explicit authorization required**: any preview deployment, provider, mailbox, database, or switch action.
- **PRODUCTION LIVE — explicit authorization required**: any production deployment, provider, mailbox, database, recipient, or switch action.

## Environment ownership

All values are server-only. Never print them, expose them through `NEXT_PUBLIC_*`, or capture raw environment/error output.

| Value/category                                                                                  | Website project                                  | Lifecycle project              | Ownership rule                                                                               |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------ | -------------------------------------------------------------------------------------------- |
| growth `DATABASE_URL`                                                                           | yes                                              | yes                            | separate preview and production Neon resources; same environment label within a running pair |
| `DAWN_DATABASE_URL`                                                                             | no                                               | yes                            | lifecycle-dedicated store; never alias/fallback to growth database                           |
| `DELIVERY_ENVIRONMENT`, `GROWTH_DATABASE_ENVIRONMENT`                                           | no                                               | yes                            | each exactly `test`, `preview`, or `production`; values must match                           |
| growth action-token and email-HMAC keyrings                                                     | stop/action routes                               | recipient template/action URLs | active version plus retained prior keys; shared only where verification requires it          |
| `RESEND_WEBHOOK_SECRET`                                                                         | yes                                              | no                             | dedicated webhook verification secret                                                        |
| `GOOGLE_REPLY_HMAC_SECRET`                                                                      | yes                                              | matching Apps Script property  | dedicated reply-ingress secret                                                               |
| `CRON_SECRET`                                                                                   | yes                                              | no                             | protects website cron bridge                                                                 |
| `LIFECYCLE_SERVICE_SECRET`                                                                      | yes                                              | yes                            | exact shared bearer; outer adapter and Dawn middleware both enforce it                       |
| lifecycle origin                                                                                | yes                                              | no                             | server-only HTTPS origin; evidence stores an alias, never the URL                            |
| `ANTHROPIC_API_KEY`, enrichment model                                                           | no                                               | yes                            | bounded enrichment only                                                                      |
| `RESEND_API_KEY`, sender/tracking flags                                                         | no                                               | yes                            | delivery only; tracking must be disabled                                                     |
| non-production allowlist/redirect                                                               | no                                               | preview/test lifecycle         | must include founder/redirect recipients before delivery                                     |
| `FOUNDER_NOTIFICATION_EMAIL`                                                                    | no                                               | yes                            | must be allowlisted outside production                                                       |
| `CAMPAIGN_ENROLLMENT_START_AT`                                                                  | no                                               | yes                            | canonical UTC milliseconds; immutable once materialization runs                              |
| `LIFECYCLE_CRON_ENABLED`, `DELIVERY_ENABLED`, `CAMPAIGN_ENROLLMENT_ENABLED`, `CAMPAIGN_ENABLED` | cron switch on website; other three on lifecycle | as stated                      | all default false; exact lowercase strings only                                              |

The lifecycle Vercel project must use root `apps/lifecycle`, parent-file access, and a project-level Node 24 setting. `apps/lifecycle/vercel.json` relies on that project setting.

## Switch order

### PREVIEW LIVE — explicit authorization required

1. Set `LIFECYCLE_CRON_ENABLED=false`, `DELIVERY_ENABLED=false`, `CAMPAIGN_ENROLLMENT_ENABLED=false`, and `CAMPAIGN_ENABLED=false` before deploy/migration checks.
2. Verify separated databases, matching environment labels, action-token/email-HMAC keyrings, service/cron auth, sender/tracking flags, and preview allowlist/redirect.
3. Complete real generated health, named-thread, duplicate, recovery, abort/cancel, and fresh-instance Dawn dogfood, then complete the cutover runbook's exact-key per-store cleanup gate. A gate cannot be `PASS` while required cleanup is incomplete or failed.
4. Set `LIFECYCLE_CRON_ENABLED=true` only after every required mutable cleanup is `VERIFIED` with preflight equal to its positive expected manifest count and post-cleanup zero. Any permitted immutable provider retention must be `RETAINED_APPROVED`, with matching positive expected/preflight counts, post-cleanup equal to its approved retained count, and a current owner, reason, and future expiry. Keep all three lifecycle switches false and observe bounded no-delivery dispatch and operator alerts.
5. Set `DELIVERY_ENABLED=true` first. Canary only explicitly requested fulfillment to redirected/allowlisted recipients.
6. Set `CAMPAIGN_ENROLLMENT_START_AT` to the approved UTC launch instant, then `CAMPAIGN_ENROLLMENT_ENABLED=true`. Review the exact materialized cohort.
7. Set `CAMPAIGN_ENABLED=true` last. It controls only `send_step` leasing; it does not gate fulfillment, enrichment, notification, or reply recovery.

### PRODUCTION LIVE — explicit authorization required

Repeat every protected health/stop/sender gate before following the same switch order. Never move the cohort timestamp backward, infer approval from an import/timestamp, or broaden the allowlist as a shortcut.

## Runtime invariants

Duplicate cron invocations are normal. Skip-locked leases, lease tokens, immutable activity keys, job idempotency keys, and Resend idempotency keys must yield at most one effect.

An unmatched `mailbox.recovery_required` blocks `send_step` and `reply_reconcile` leasing and final submission. Recovery-safe non-mail work may continue. Work resumes only after the matching `mailbox.recovery_completed` event.

The worker checks cancellation after asynchronous preparation and before recipient submission, internal at-most-once claims, and provider calls. Once a provider call begins, settle its known/rejected/ambiguous outcome even if the request later aborts. Never automatically resubmit an expired lease with final authorization or a prior internal submission claim.

Deterministically corrupt persisted input becomes `deterministic_job_poison` and does not stop the remaining leased batch. Abort, heartbeat loss, and infrastructure errors stop the batch and must not be misclassified as poison.

## Daily rollout review

### PREVIEW LIVE — explicit authorization required

Review one complete UTC window before each expansion. Use aggregate views/counts and sanitized aliases only.

| Signal                                       | Continue threshold                                     | Halt/rollback threshold                                       |
| -------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------- |
| auth rejects on protected paths              | expected probes only; zero unauthorized delegation     | any protected request reaches Dawn without exact bearer       |
| cron                                         | successful bounded runs; no overlap duplicate effects  | repeated 5xx/timeouts, unbounded runtime, or duplicate effect |
| due/expired leases                           | no unexplained expired leases                          | any growing expired-lease backlog or heartbeat loss           |
| delivery unknown                             | zero during canary                                     | any new unknown recipient/internal outcome; pause delivery    |
| provider reject/bounce/complaint/suppression | explained test fixture only                            | any unexpected real recipient signal                          |
| mailbox recovery                             | no unmatched event outside planned exercise            | unmatched pause, bypass, or completion mismatch               |
| stops                                        | zero pending/leased campaign jobs after effective stop | any send eligibility/job survives a stop                      |
| persistence                                  | thread/checkpoint readable across fresh instances      | lost/cross-environment state or growth DB fallback            |
| campaign cohort                              | exact approved fixture/new cohort                      | pre-launch/imported/unapproved contact appears                |
| legacy side effects                          | zero NDJSON/Loops/audience/scheduled follow-up         | any legacy write or provider scheduling                       |

### PRODUCTION LIVE — explicit authorization required

Review the same table daily before cohort expansion. Any auth bypass, duplicate effect, unknown outcome, stop violation, recovery bypass, persistence loss, sender-auth failure, tracking reactivation, or legacy side effect is an immediate halt. Do not average safety failures into a percentage.

## Incident actions

### Authentication incident — PREVIEW/PRODUCTION LIVE, explicit authorization required

1. Set `LIFECYCLE_CRON_ENABLED=false` and `CAMPAIGN_ENABLED=false`; set `DELIVERY_ENABLED=false` if recipient access may be exposed.
2. Preserve bounded request status/hash evidence without headers or URLs.
3. Rotate the affected cron/service/webhook/reply secret in its owning projects and Apps Script property where applicable.
4. Re-run missing/wrong/exact auth probes across health, thread, state, cancel, run, AG-UI, and memory before re-enabling cron.

### Cron incident — PREVIEW/PRODUCTION LIVE, explicit authorization required

1. Set `LIFECYCLE_CRON_ENABLED=false` to stop bridge invocations.
2. Keep leasing false; disable delivery if a run may have crossed final submission.
3. Inspect aggregate leased/expired/unknown counts and Dawn thread aliases; never replay a run blindly.
4. Resume cron with all three lifecycle switches false, then restore switches in normal order.

### Mailbox recovery incident — PREVIEW/PRODUCTION LIVE, explicit authorization required

1. Keep `CAMPAIGN_ENABLED=false`; do not delete or edit Apps Script recovery/cursor properties.
2. Verify the unmatched recovery alias, last acknowledged checkpoint, and server pause.
3. Let the same recovery ID resume metadata-only scan and History catch-up.
4. Require matching completion before leasing/reply reconciliation resumes. If state is malformed, keep delivery off and repair with an audited targeted procedure; never rerun initialization.

### Stop incident — PREVIEW/PRODUCTION LIVE, explicit authorization required

1. Set `CAMPAIGN_ENABLED=false`; set `DELIVERY_ENABLED=false` if final-gate correctness is uncertain.
2. Apply the canonical contact-scoped founder stop if an additional recipient must stop.
3. Confirm approval cleared and pending campaign work cancelled. Cancel only returned still-pending legacy provider IDs one at a time in a restricted non-recorded session.
4. Never bulk-cancel, bulk-delete, or infer reauthorization from a new form submission.

### Unknown delivery incident — PREVIEW/PRODUCTION LIVE, explicit authorization required

1. Set `DELIVERY_ENABLED=false`; preserve the durable unknown/manual-review state.
2. Inspect the provider by durable idempotency metadata without copying provider/recipient data into evidence.
3. Resolve through the explicit acceptance-unknown reconciliation path only when provider outcome is proven.
4. Never reset unknown to pending or automatically resubmit.

### Dawn persistence incident — PREVIEW/PRODUCTION LIVE, explicit authorization required

1. Set cron, leasing, and delivery false.
2. Record artifact hashes, Node/Dawn/Hono versions, schema/instance aliases, and sanitized state hashes.
3. Verify both instances use the same dedicated environment-specific `DAWN_DATABASE_URL` and never generic growth fallback.
4. Do not migrate/copy/delete store data until a targeted recovery is approved. Re-run fresh-instance persistence before any switch resumes.

## Safe rollback

### PREVIEW/PRODUCTION LIVE — explicit authorization required

1. Set `CAMPAIGN_ENABLED=false` first.
2. Set `DELIVERY_ENABLED=false` whenever recipient safety or provider outcome is uncertain.
3. Set `CAMPAIGN_ENROLLMENT_ENABLED=false`; preserve the immutable cohort timestamp and enrollment/activity/job ledgers.
4. Set `LIFECYCLE_CRON_ENABLED=false` if dispatch/auth/persistence is unsafe. Keep it on only for a specifically approved recovery/fulfillment need that is known safe.
5. Preserve reply recovery controls and unknown outcomes. Do not erase, reset, or release them.
6. Roll back application code only after switches are confirmed and active leases settle or expire.

## Monitoring surfaces

### PREVIEW/PRODUCTION LIVE — explicit authorization required

- `growth_job_health_v1`: due work, expired leases, attempts, failed and unknown outcomes by kind.
- `growth_campaign_performance_v1`: submitted, delivered, bounced, complained, suppressed, failed, and unknown counts.
- `growth_contact_overview_v1`: restricted CRM review because it contains contact details.
- Aggregate counts for unmatched recovery events, acceptance-unknown activities, provider rejections, campaign steps by due bucket, and stops followed by pending/leased campaign work.

Evidence must prefer counts, status/schema hashes, and synthetic aliases. Never export raw email, message copy, token URLs, enrichment artifacts, provider IDs, connection strings, request headers, or generated `String(error)` values.

## Local and disposable verification commands

### LOCAL — Node 22

Use a Node 22 shell for this block. The other commands pin Node 22 explicitly as an additional guard.

```bash
npx -y node@22 ./node_modules/nx/bin/nx.js lint growth
npx -y node@22 ./node_modules/nx/bin/nx.js test growth
npx nx run growth:test-operator-cli
npx -y node@22 ./node_modules/nx/bin/nx.js build growth
npx -y node@22 ./node_modules/nx/bin/nx.js test google-mailbox-poller
npx -y node@22 ./node_modules/nx/bin/nx.js lint google-mailbox-poller
```

### LOCAL — Node 24

```bash
npx -y node@24 ./node_modules/nx/bin/nx.js lint lifecycle
npx -y node@24 ./node_modules/nx/bin/nx.js test lifecycle
npx -y node@24 ./node_modules/nx/bin/nx.js run lifecycle:check
npx -y node@24 ./node_modules/nx/bin/nx.js build lifecycle
```

### DISPOSABLE DB — explicit authorization required

```bash
TEST_DATABASE_URL="$TEST_DATABASE_URL" npx -y node@22 ./node_modules/nx/bin/nx.js run growth:test-integration
```

This integration command mutates its target and is not a local-only test.
