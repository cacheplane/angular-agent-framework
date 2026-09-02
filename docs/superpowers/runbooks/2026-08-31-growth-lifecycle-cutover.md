# Growth lifecycle cutover

Status: **LOCAL implementation and harness only.** No disposable database, preview, or production action in this runbook has been performed. No Neon migration/import, Resend/Google read or write, Vercel deployment, Dawn deployed request, or switch change is implied by local test results.

## Gate classes

- **LOCAL**: repository-only and safe with fake fixtures; no provider or database connection.
- **DISPOSABLE DB — explicit authorization required**: mutates an isolated throwaway database. `growth:test-integration` belongs here and is never a local-only gate.
- **PREVIEW LIVE — explicit authorization required**: touches preview Vercel, Neon, Resend, Google, or Dawn resources.
- **PRODUCTION LIVE — explicit authorization required**: touches production state, providers, recipients, configuration, or switches.

Stop immediately if an environment cannot be identified without printing a URL or credential, if a command would target a shared/root database unexpectedly, or if evidence would contain an address, provider ID, message content, token, connection string, or generated-store error text.

## 1. Local release gates

### LOCAL — Node 22 growth, website, and mailbox poller

Run these commands from the repository root in a Node 22 shell with no provider/database variables required. The other commands pin Node 22 explicitly as an additional guard:

```bash
npx -y node@22 ./node_modules/nx/bin/nx.js lint growth
npx -y node@22 ./node_modules/nx/bin/nx.js test growth
npx nx run growth:test-operator-cli
npx -y node@22 ./node_modules/nx/bin/nx.js build growth
npx -y node@22 ./node_modules/nx/bin/nx.js test google-mailbox-poller
npx -y node@22 ./node_modules/nx/bin/nx.js lint google-mailbox-poller
npx -y node@22 ./node_modules/nx/bin/nx.js lint website
npx -y node@22 ./node_modules/nx/bin/nx.js test website
npx -y node@22 ./node_modules/nx/bin/nx.js build website --configuration=production
WEBSITE_E2E_MODE=production npx -y node@22 ./node_modules/nx/bin/nx.js e2e website
```

The production-built public-copy run uses fixed, obviously fake server-only action-token and webhook keys only when Playwright spawns a local server. It must skip fixture-key cases when `BASE_URL` names an external site. The signed unsubscribe GET must return its confirmation page without opening a database or changing contact state.

The migration runner and Nx ownership use the same canonical filename language: at least four decimal digits, one underscore, a nonempty lowercase alphanumeric slug whose optional segments use a single `_` or `-`, and lowercase `.sql` (for example, `0004_add-index_v2.sql`). Uppercase extensions, missing separators, empty slugs, repeated separators, and trailing separators are ignored by both.

### LOCAL — Node 24 lifecycle

```bash
npx -y node@24 ./node_modules/nx/bin/nx.js lint lifecycle
npx -y node@24 ./node_modules/nx/bin/nx.js test lifecycle
npx -y node@24 ./node_modules/nx/bin/nx.js run lifecycle:check
npx -y node@24 ./node_modules/nx/bin/nx.js build lifecycle
```

`lifecycle:build` generates `.dawn/build/app.mjs`, rewrites the generated store binding to `DAWN_DATABASE_URL`, imports the real generated artifact, and checks its fetch-compatible export. Its authenticated request probe deliberately uses a fake app. It does **not** prove that the real generated app's `/healthz` route works; that is a separate preview dogfood gate below.

### DISPOSABLE DB — explicit authorization required

This suite is mutable and is excluded from local-only verification:

```bash
TEST_DATABASE_URL="$TEST_DATABASE_URL" npx -y node@22 ./node_modules/nx/bin/nx.js run growth:test-integration
```

Authorize it only after confirming the URL names an isolated disposable database that may be migrated, truncated, and rewritten by tests.

## 2. Preview schema and stop surfaces

### PREVIEW LIVE — explicit authorization required: target separation

Resolve provider-native database target identifiers in a private operator worksheet and map them to these synthetic aliases. Provider target identifiers are opaque provider target IDs: never paste the actual values into a command, log, screenshot, evidence file, or this runbook.

| Synthetic alias               | Binding checked privately                                   | Closed evidence class |
| ----------------------------- | ----------------------------------------------------------- | --------------------- |
| `growth-preview-target-01`    | website preview and lifecycle preview growth database       | match result          |
| `growth-production-target-01` | website production and lifecycle production growth database | match result          |
| `dawn-preview-target-01`      | lifecycle preview dedicated Dawn store                      | separation result     |
| `dawn-production-target-01`   | lifecycle production dedicated Dawn store                   | separation result     |

A match result is exactly one of `MATCH`, `MISMATCH`, or `BLOCKED`. A separation result is exactly one of `DISTINCT`, `SAME`, or `BLOCKED`.

In the restricted provider UI or private worksheet, require both preview growth bindings to have one exact target-ID match and both production growth bindings to have a different exact target-ID match. Require the preview and production growth target IDs to be distinct. Require each Dawn target ID to be distinct from both growth target IDs and from the Dawn target in the other environment. Record only the alias and closed result above.

Do not compare target URLs; URL equality is not target identity. Do not derive, compare, or retain URL hashes or target-ID hashes. Abort on a missing identifier, `MISMATCH`, `SAME`, `BLOCKED`, an unexpected shared/root target, or any uncertainty about which provider resource an identifier names. Do not continue to migration or deployment from URL-based evidence.

### PREVIEW LIVE — explicit authorization required: migrate, rerun, inventory

Export `PREVIEW_GROWTH_DATABASE_URL` in the restricted operator shell without printing it. Forbid xtrace, shell tracing, command transcripts, and session recording for every restricted-shell step. If any are required by the operator environment, stop instead of expanding a secret. In a clean Node 22 subshell, disable inherited xtrace before any variable expansion, then require the command-bound `DATABASE_URL` and both opposite database variables to be absent before applying. The migration runner independently enforces Node 22, requires nonempty `DATABASE_URL`, rejects even blank `TEST_DATABASE_URL` or `DAWN_DATABASE_URL`, and pins every migration transaction to `public`. Apply the repository migration runner exactly, then run the identical command again:

```bash
(
  set +x
  set -eu
  test -n "${PREVIEW_GROWTH_DATABASE_URL:-}"
  test -z "${DATABASE_URL+x}"
  test -z "${TEST_DATABASE_URL+x}"
  test -z "${DAWN_DATABASE_URL+x}"
  DATABASE_URL="$PREVIEW_GROWTH_DATABASE_URL" npx -y node@22 ./node_modules/tsx/dist/cli.mjs scripts/apply-migrations.mts
  DATABASE_URL="$PREVIEW_GROWTH_DATABASE_URL" npx -y node@22 ./node_modules/tsx/dist/cli.mjs scripts/apply-migrations.mts
)
```

For a fresh preview target, the first result must be exactly `Migrations complete: 3 applied, 0 unchanged.` and the second exactly `Migrations complete: 0 applied, 3 unchanged.` A different first-run count means the target was not fresh or the repository migration set changed; stop and reconcile it before continuing. A checksum mismatch or a second application of migration SQL is a hard stop.

Inventory `public` without selecting contact or job data. These queries compare the complete matching object and ledger sets in both directions; they do not merely check that expected names are present:

```bash
(
set +x
set -eu
test -n "${PREVIEW_GROWTH_DATABASE_URL:-}"
test -z "${DATABASE_URL+x}"
test -z "${TEST_DATABASE_URL+x}"
test -z "${DAWN_DATABASE_URL+x}"
PGDATABASE="$PREVIEW_GROWTH_DATABASE_URL" psql --no-psqlrc --set=ON_ERROR_STOP=1 <<'SQL'
select current_schema() = 'public' as canonical_public_schema;

with expected(name) as (
  values ('growth_activity'), ('growth_artifacts'), ('growth_contacts'),
         ('growth_jobs'), ('growth_projects')
), actual(name) as (
  select table_name
  from information_schema.tables
  where table_schema = 'public'
    and table_type = 'BASE TABLE'
    and table_name like 'growth\_%' escape '\'
)
select
  not exists (select name from expected except select name from actual)
    and not exists (select name from actual except select name from expected)
      as exact_growth_table_set,
  (select count(*) from actual) as actual_count,
  (select count(*) from expected) as expected_count;

with expected(name) as (
  values ('growth_campaign_performance_v1'),
         ('growth_contact_overview_v1'),
         ('growth_funnel_daily_v1'),
         ('growth_job_health_v1'),
         ('growth_legacy_progress_v1')
), actual(name) as (
  select table_name
  from information_schema.views
  where table_schema = 'public'
    and table_name like 'growth\_%' escape '\'
)
select
  not exists (select name from expected except select name from actual)
    and not exists (select name from actual except select name from expected)
      as exact_growth_view_set,
  (select count(*) from actual) as actual_count,
  (select count(*) from expected) as expected_count;

with expected(name) as (
  values ('0001_rate_limit_events.sql'),
         ('0002_growth_control_plane.sql'),
         ('0003_growth_reporting_views.sql')
), actual(name, checksum_length) as (
  select name, length(checksum)
  from public.threadplane_schema_migrations
)
select
  not exists (select name from expected except select name from actual)
    and not exists (select name from actual except select name from expected)
      as exact_migration_ledger_set,
  coalesce((select bool_and(checksum_length = 64) from actual), false)
      as exact_checksum_lengths,
  (select count(*) from actual) as actual_count,
  (select count(*) from expected) as expected_count;
SQL
)
```

Require the four boolean fields `canonical_public_schema`, `exact_growth_table_set`, `exact_growth_view_set`, and `exact_migration_ledger_set` to be true; require `exact_checksum_lengths` true; and require actual/expected counts `5/5`, `5/5`, and `3/3`. Any false boolean or count mismatch is a hard stop, including extra growth objects or ledger entries.

### PREVIEW LIVE — explicit authorization required: deploy stop surfaces first

Deployment order is closed and mandatory:

1. Website action-token keyring and growth database configuration.
2. `/api/unsubscribe` and `/api/growth/stop`.
3. `/api/webhooks/resend` with its dedicated webhook secret.
4. `/api/growth/replies/google` with its dedicated Google HMAC secret.
5. `/api/cron/lifecycle` with `LIFECYCLE_CRON_ENABLED=false`.
6. Lifecycle service only after the five preceding surfaces reject unauthenticated traffic correctly.

Register only this Resend webhook allowlist: `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.complained`, `email.failed`, and `email.suppressed`. Do not register open or click events, and do not enable provider open/click tracking.

The stop smoke matrix must record status/body hashes, not tokens or bodies:

| Case                                                              | Expected result                                                            |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------- |
| unsubscribe GET without/invalid token                             | 400, bounded non-enumerating response                                      |
| valid signed unsubscribe GET                                      | 200 confirmation; no mutation                                              |
| valid signed unsubscribe POST                                     | 200; approval cleared; only that contact's pending campaign jobs cancelled |
| founder stop GET without/invalid token                            | 400, bounded non-enumerating response                                      |
| valid founder stop POST                                           | contact-scoped stop and cancellation                                       |
| forged/missing Resend signature                                   | 400; no database mutation                                                  |
| missing Google signature                                          | 400; no database mutation                                                  |
| missing cron bearer                                               | 401 before lifecycle invocation                                            |
| hard bounce, complaint, suppression, reply, manual stop, deletion | each converges on the canonical stop rules                                 |

Any open/click subscription, unauthenticated success, GET mutation, cross-contact cancellation, or raw provider/error output halts cutover.

## 3. Google mailbox authorization and recovery

### PREVIEW LIVE — explicit authorization required

Follow [the poller install and smoke instructions](../../../tools/google-mailbox-poller/README.md) exactly. The operator must:

1. Create the standalone Apps Script under the intended mailbox owner and enable only the manifest scopes.
2. Set the endpoint and dedicated HMAC secret in Script Properties; never in source.
3. Run `initializeThreadplaneMailbox` once to seed the current History watermark without backfill.
4. Run `setupTrigger` once and verify exactly one every-minute `pollThreadplaneMailbox` trigger.
5. Send one allowlisted seed through the actual delivery path, verify aligned Gmail DKIM/DMARC metadata and the `X-Threadplane-Job-ID` binding, then reply.
6. Verify the reply creates the canonical reply stop and that no body, snippet, subject, attachment, or raw authentication header is persisted.
7. Force recovery in the non-production mailbox: require `recovery_required` before the metadata scan, leasing pause throughout, checkpointed resume after a simulated callback failure, and `recovery_completed` only after full scan plus History catch-up.

Do not hand-edit cursor/recovery properties, rerun initialization, or use a production mailbox for the recovery exercise.

## 4. Lifecycle Vercel project and dogfood

### PREVIEW LIVE — explicit authorization required: project ownership

Create a separate protected Vercel project with root `apps/lifecycle`, monorepo parent-file access enabled, and the project-level Node runtime explicitly set to Node 24. `apps/lifecycle/vercel.json` does not itself pin Node 24; the package engine and Vercel project setting must agree.

Environment ownership is strict:

| Owner                     | Values                                                                                                                                                                                                                                                                                                            |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Website preview project   | preview growth `DATABASE_URL`; growth token/email HMAC keyrings; `RESEND_WEBHOOK_SECRET`; `GOOGLE_REPLY_HMAC_SECRET`; `CRON_SECRET`; lifecycle origin and shared service secret; `LIFECYCLE_CRON_ENABLED=false`                                                                                                   |
| Lifecycle preview project | preview growth `DATABASE_URL`; app-dedicated preview `DAWN_DATABASE_URL`; shared lifecycle service secret; Anthropic/Resend keys; growth action-token keyring; founder address; delivery environment/allowlist/redirect; immutable cohort timestamp; sender flags; all delivery/enrollment/leasing switches false |
| Vercel project settings   | root directory, parent-file access, Node 24, protected preview access policy                                                                                                                                                                                                                                      |

Preview and production must use separate growth databases and separate Dawn stores. `DAWN_DATABASE_URL` must never alias or fall back to growth `DATABASE_URL`. No value may use a `NEXT_PUBLIC_` name.

### PREVIEW LIVE — explicit authorization required: deterministic dogfood fixtures

Use synthetic aliases in evidence; never record URLs, credentials, emails, database IDs, provider IDs, or generated `String(error)` output.

| Gate                       | Deterministic fixture                                                                                                                                                                  | Expected result                                                                                                            | Cleanup                                                            |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| outer authorization        | paths `/healthz`, `/threads`, `/threads/thread-dogfood-01/state`, `/threads/thread-dogfood-01/cancel`, `/threads/thread-dogfood-01/runs/wait`, AG-UI, memory; missing and wrong bearer | 401 before Dawn receives every request                                                                                     | none                                                               |
| real generated health      | authenticated `/healthz` through deployed catch-all adapter                                                                                                                            | real generated app responds successfully; record schema/body hash only                                                     | none                                                               |
| named-thread run           | one real UUID mapped in evidence to `thread-dogfood-01`; route `/dispatch#workflow`; input `{"trigger":"cron"}`                                                                        | strict state contains trigger/result and bounded counts                                                                    | exact Dawn keys in the approved cleanup manifest                   |
| duplicate effects          | two concurrent invocations over jobs keyed `duplicate-fixture-01`                                                                                                                      | at most one durable/provider effect per idempotency key                                                                    | exact growth/Dawn/provider keys in the approved cleanup manifest   |
| mailbox recovery           | synthetic recovery alias `recovery-fixture-01`, checkpoint failure, resume                                                                                                             | send/reply leasing and final submission pause; non-mail work may continue; resume only after matching completion           | exact recovery and fixture keys in the approved cleanup manifest   |
| abort/cancel               | long-running synthetic enrichment alias `abort-fixture-01`; abort request then invoke thread cancel                                                                                    | `AbortSignal` reaches app work; no recipient/internal provider call after cancellation checkpoint; cancel outcome recorded | exact lease/thread keys in the approved cleanup manifest           |
| fresh-instance persistence | dedicated Dawn alias `dawn-store-preview-01`; write thread/checkpoint in instance A, read/update in fresh instance B                                                                   | state survives with only `DAWN_DATABASE_URL`; no growth-store fallback                                                     | exact Dawn thread/checkpoint keys in the approved cleanup manifest |

For outer auth, test health, thread create/read/state/cancel/run, AG-UI, and memory. For the generated health gate, do not cite `verify-vercel-adapter.mts` as evidence: it imports the real artifact but its authenticated request uses a fake app.

Keep `LIFECYCLE_CRON_ENABLED=false`, `DELIVERY_ENABLED=false`, `CAMPAIGN_ENROLLMENT_ENABLED=false`, and `CAMPAIGN_ENABLED=false` until every row passes. Any duplicate effect, missing abort, recovery bypass, lost fresh-instance state, auth delegation, or generic `DATABASE_URL` use is a hard halt.

### PREVIEW LIVE — explicit authorization required: fixture cleanup gate

Before setup, approve a closed cleanup manifest for the three fixture stores below. The private operator worksheet maps each redacted synthetic alias to one exact-key selector; it must never enter logs or evidence. The approved cleanup implementation must compare that exact key and the dedicated fixture namespace/schema marker, report the bounded preflight count, remove only the named fixture, and report the bounded post-cleanup count. Never use a generic delete, prefix/wildcard match, age-based sweep, schema drop, or unbounded provider operation.

| Store                   | Exact approved requirement                                                                                                                                                                                                                                           | Completion rule                                                                                                                                                                                                                                                                                 |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| growth control plane    | One reviewed transaction targets the exact synthetic project/contact keys and only their fixture-owned activities/jobs; it verifies the preflight count against the manifest, removes dependents before owners, and verifies that all exact fixture keys are absent. | `VERIFIED` only when `expected_count` is positive, preflight equals expected, the transaction commits, and post-cleanup is zero; otherwise `FAILED`.                                                                                                                                            |
| dedicated Dawn store    | One reviewed, Dawn-version-matched procedure targets only the exact synthetic thread/checkpoint/run keys in the dedicated preview Dawn schema and verifies that a fresh instance can no longer read them.                                                            | `VERIFIED` only when `expected_count` is positive, preflight equals expected, and post-cleanup is zero when checked from a fresh instance; otherwise `FAILED`.                                                                                                                                  |
| Resend provider fixture | Use only Resend's supported single-record action for the exact synthetic message/contact fixture identifier. Do not bulk cancel/delete or search by recipient.                                                                                                       | `VERIFIED` requires positive expected count, preflight equal to expected, and post-cleanup zero. `RETAINED_APPROVED` is permitted only for an immutable exact record when preflight equals expected and post-cleanup equals the approved retained count, with owner, reason, and future expiry. |

Every store row in the evidence template is required. `expected_count` is approved in the manifest before setup and must be positive; `preflight_count` is measured immediately before cleanup; `post_cleanup_count` is measured immediately after. A zero preflight against a positive manifest is a failure, never successful cleanup. A dogfood gate may not be marked `PASS`, and setting `LIFECYCLE_CRON_ENABLED=true` is forbidden until cleanup is `VERIFIED` for every required mutable fixture. The sole exception is an exact immutable provider record marked `RETAINED_APPROVED`: its positive expected and preflight counts must match, its post-cleanup count must equal `approved_retained_count`, and it must record `retained_owner`, `retained_reason`, and `retention_expires_at`. At expiry it becomes blocking until renewed or verified removed. Any count mismatch, expired retention, or cleanup failure is a hard halt; preserve the failed alias mapping for the authorized incident owner without exposing identifiers or PII.

## 5. Form and sender canaries

### PREVIEW LIVE — explicit authorization required: requested-content canary

With cron enabled only after dogfood, delivery restricted to the preview allowlist, and both campaign switches false:

1. Submit one deterministic whitepaper form fixture through the `growth_v1` server policy.
2. Require one durable acceptance transaction and one requested `fulfill` job.
3. Require the real generated lifecycle run to submit exactly the requested resource through Resend to the redirected/allowlisted recipient.
4. Prove there is no new local/remote NDJSON write, Loops write, Resend audience/contact upsert, provider-scheduled follow-up, or `send_step` enrollment.
5. Record hashes/counts only, then complete the exact-key per-store cleanup manifest for the synthetic growth records and provider fixture.

Any legacy side effect, campaign job, scheduled provider follow-up, or missing durable fulfillment halts the canary. Do not remove legacy code until this gate passes in the authorized environment.

### PRODUCTION LIVE — explicit authorization required: sender identity

From one received allowlisted message, verify and record pass/fail without copying raw headers:

- SPF alignment/pass, DKIM alignment/pass, and DMARC pass for `threadplane.ai`;
- expected Return-Path;
- `List-Unsubscribe` with the opaque HTTPS action URL;
- `List-Unsubscribe-Post: List-Unsubscribe=One-Click`;
- Brian BCC seed and `X-Threadplane-Job-ID` on the received copy;
- `Reply-To` routes replies to Brian;
- no open pixel and no click-link rewriting.

Do not enable production recipient delivery if any item is absent or if provider tracking is active.

## 6. Legacy Resend reconciliation

### LOCAL

The importer unit gate is provider-free:

```bash
npx -y node@22 ./node_modules/vitest/vitest.mjs run scripts/import-resend-lifecycle.spec.ts
```

### PREVIEW LIVE — explicit authorization required

Run a fresh aggregate-only provider snapshot, privately record the current counts, then import into an authorized preview/disposable target. The dry run reads the live Resend provider even though it does not write. Never reuse the historical 14-contact/17-scheduled observation. Before apply, require `TEST_DATABASE_URL` to be present and `DATABASE_URL` to be absent; the importer rejects both variables together and rejects the production acknowledgement in this mode:

```bash
npm run growth:import-resend -- --dry-run
test -n "${TEST_DATABASE_URL:-}" && test -z "${DATABASE_URL:-}"
env -u DATABASE_URL npm run growth:import-resend -- --apply --expected-contacts "$EXPECTED_CONTACTS" --expected-scheduled "$EXPECTED_SCHEDULED"
```

Require aggregate JSON only, zero newly granted approvals, stable idempotent rerun, and contact-scoped legacy cancellation counts. This apply mutates a database and is not a local-only check.

### PRODUCTION LIVE — explicit authorization required

After preview reconciliation and deployed stop surfaces, repeat the immediately-current dry run and apply with the production acknowledgement. The dry run is a live provider read. Before apply, require the environment-bound `DATABASE_URL` to be present and `TEST_DATABASE_URL` to be absent; the acknowledgement never permits fallback to a test target and the importer rejects both variables together:

```bash
npm run growth:import-resend -- --dry-run
test -n "${DATABASE_URL:-}" && test -z "${TEST_DATABASE_URL:-}"
env -u TEST_DATABASE_URL npm run growth:import-resend -- --apply --expected-contacts "$EXPECTED_CONTACTS" --expected-scheduled "$EXPECTED_SCHEDULED" --allow-database-url-apply
```

The importer never mutates Resend. If it reports pending legacy cancellations, an authorized operator must query exact IDs only in a restricted non-recorded database session, cancel each individually in Resend, verify the per-ID count equals the aggregate, and destroy the ephemeral checklist. Never bulk-cancel, export, log, or paste provider IDs.

## 7. Shadow, allowlist, launch, and rollback

### PREVIEW LIVE — explicit authorization required

Observe at least one review window with cron running but all delivery/enrollment/leasing switches false. Require zero auth bypasses, zero unknown outcomes, zero stuck/expired leases, no unmatched recovery pause, and no duplicate idempotency effects. Halt on any nonzero safety signal.

Then set `DELIVERY_ENABLED=true` with campaign enrollment/leasing false and restrict all recipient delivery to internal/test allowlist plus redirect. Prove requested fulfillment only.

### PRODUCTION LIVE — explicit authorization required

1. Repeat protected health/stop/sender checks.
2. Set the immutable `CAMPAIGN_ENROLLMENT_START_AT` to the approved launch instant; never move it backward.
3. Enable enrollment for explicit test contacts and review the exact cohort.
4. Enable leasing last, first for internal/test recipients, then a small new-whitepaper cohort.
5. Review daily before expansion; use the thresholds in the operations runbook.

Immediate halt: set campaign leasing false, then delivery false if recipient safety is uncertain, then enrollment false. Leave cron on only if it is needed for fulfillment/recovery and is behaving correctly; otherwise disable cron too. Preserve ledgers, unknown outcomes, recovery state, cohort timestamp, and provider records. Roll back code only after switches are confirmed and leases settle/expire.

## Appendix A: secret-free dogfood evidence template

```yaml
evidence_schema_version: 2
utc_window:
  started_at: YYYY-MM-DDTHH:mm:ss.sssZ
  ended_at: YYYY-MM-DDTHH:mm:ss.sssZ
repo_commit: 40-hex-commit
versions:
  node: 24.x
  dawn: 0.8.21
  hono: 4.13.5
environment_label: preview-lifecycle-dogfood # label only; no URL
schema_aliases:
  growth: growth-preview-schema-01
  dawn: dawn-preview-schema-01
instance_aliases: [lifecycle-preview-instance-a, lifecycle-preview-instance-b]
synthetic_aliases:
  setup:
    [
      thread-dogfood-01,
      duplicate-fixture-01,
      recovery-fixture-01,
      abort-fixture-01,
    ]
  cleanup:
    [
      cleanup-growth-fixtures-01,
      cleanup-dawn-fixtures-01,
      cleanup-provider-fixtures-01,
    ]
cleanup_results:
  - store: growth-control-plane
    fixture_alias: cleanup-growth-fixtures-01
    cleanup_status: VERIFIED|FAILED
    expected_count: positive-integer
    preflight_count: positive-integer
    post_cleanup_count: 0
    approved_retained_count: null
    completed_at: YYYY-MM-DDTHH:mm:ss.sssZ|null
    failure: sanitized-error-class|null
    retained_owner: null
    retained_reason: null
    retention_expires_at: null
  - store: dedicated-dawn
    fixture_alias: cleanup-dawn-fixtures-01
    cleanup_status: VERIFIED|FAILED
    expected_count: positive-integer
    preflight_count: positive-integer
    post_cleanup_count: 0
    approved_retained_count: null
    completed_at: YYYY-MM-DDTHH:mm:ss.sssZ|null
    failure: sanitized-error-class|null
    retained_owner: null
    retained_reason: null
    retention_expires_at: null
  - store: resend-provider-fixture
    fixture_alias: cleanup-provider-fixtures-01
    cleanup_status: VERIFIED|FAILED|RETAINED_APPROVED
    expected_count: positive-integer
    preflight_count: positive-integer
    post_cleanup_count: nonnegative-integer
    approved_retained_count: 0|positive-integer
    completed_at: YYYY-MM-DDTHH:mm:ss.sssZ|null
    failure: sanitized-error-class|null
    retained_owner: sanitized-role-alias|null
    retained_reason: bounded-non-PII-reason|null
    retention_expires_at: YYYY-MM-DDTHH:mm:ss.sssZ|null
artifact_hashes:
  dawn_app_mjs_sha256: 64-hex
  dawn_stores_mjs_sha256: 64-hex
  vercel_adapter_source_sha256: 64-hex
gates:
  - name: outer-auth
    sanitized_request: method/path-alias/header-presence-only
    expected: bounded expected status/schema
    actual: bounded actual status/schema/body-hash
    status: PASS|FAIL|BLOCKED
  - name: real-generated-health
    sanitized_request: GET health path alias; authenticated=true
    expected: generated app success through adapter
    actual: status/schema/body-hash
    status: PASS|FAIL|BLOCKED
  - name: named-thread-run
    sanitized_request: thread alias, route, closed input keys
    expected: strict dispatch state schema
    actual: status/schema/counts only
    status: PASS|FAIL|BLOCKED
  - name: duplicate-effects
    sanitized_request: invocation count and idempotency alias
    expected: one durable/provider effect
    actual: aggregate counts only
    status: PASS|FAIL|BLOCKED
  - name: recovery-pause-resume
    sanitized_request: recovery/checkpoint aliases
    expected: pause, checkpoint resume, matching completion
    actual: closed state/counts only
    status: PASS|FAIL|BLOCKED
  - name: abort-and-cancel
    sanitized_request: abort/thread aliases and timing checkpoint
    expected: signal propagation and no post-cancel provider call
    actual: closed state/counts only
    status: PASS|FAIL|BLOCKED
  - name: fresh-instance-persistence
    sanitized_request: schema/instance/thread aliases
    expected: instance B reads instance A state from dedicated Dawn store
    actual: state schema/hash only
    status: PASS|FAIL|BLOCKED
observations: []
workarounds: []
upstream_desired_tests: []
redaction_declaration: >-
  Reviewed for and contains no URLs, credentials, connection strings, tokens,
  email addresses, provider/database identifiers, message content, raw headers,
  generated String(error) values, or unsanitized request/response bodies.
```

### LOCAL — artifact hashes

Hash local artifacts without displaying their contents:

```bash
shasum -a 256 apps/lifecycle/.dawn/build/app.mjs apps/lifecycle/.dawn/build/stores.mjs apps/lifecycle/src/vercel-adapter.ts
```

## Appendix B: Dawn handoff prompt (do not send from this runbook task)

Use this generalized prompt for Dawn task/thread `01a05e2f-7e93-7bd0-af74-f13d5a7719cd` only after authorized dogfood evidence exists:

> Review the attached secret-free Threadplane Dawn 0.8.21/Hono/Vercel dogfood evidence. Generalize the findings into upstream behavior and regression tests without copying Threadplane URLs, credentials, schema names, provider identifiers, or application-specific fixtures. Cover: authentication before all generated surfaces; a real generated health request; named-thread `/runs/wait`; duplicate-effect/idempotency behavior; mailbox-style pause/resume as a generic external recovery gate; AbortSignal propagation and cancel semantics; and Postgres thread/checkpoint persistence across fresh instances with a dedicated store binding. For each workaround, identify the desired Dawn API or generator change, the smallest upstream red test, compatibility impact, and whether the application workaround can be removed. Treat any omitted/redacted field as intentionally unavailable; do not request secrets.

This repository task does not send the prompt and does not authorize access to the Dawn task.
