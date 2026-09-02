# Threadplane Growth Lifecycle Hard Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Threadplane's legacy website lead and whitepaper delivery paths with the already-merged Neon/Dawn/Resend lifecycle, cancel every outstanding provider-scheduled legacy message, and enable the new system through a controlled production hard cutover.

**Architecture:** Website forms validate one server-owned `growth_v1` policy and commit contacts, approval, activity, and jobs in one Neon transaction before returning success. Dawn leases durable fulfillment, enrichment, notification, and campaign jobs; Resend transports messages and reports delivery; signed stop surfaces and Google mailbox metadata polling terminate outreach. The repository lands as one focused pull request, then production uses a short Vercel Firewall quiescent window to snapshot, import, cancel, deploy, and reopen without dual-writing or reviving legacy behavior.

**Tech Stack:** Nx, npm, TypeScript, Next.js 16, React 19, Vitest, Playwright, Neon PostgreSQL, Dawn 0.8.21, Vercel Pro/Cron/Firewall, Resend 6.10, Google Apps Script.

---

## Working agreements

- Work only in the clean `growth-hard-cutover` worktree on `blove/growth-hard-cutover`.
- Treat the original `angular-agent-framework` checkout as a read-only source draft. It contains unrelated user work. Never reset, stage, commit, or edit it.
- The source draft is not the specification. Port the useful `growth_v1` implementation, then apply the hard-cutover changes in the approved design.
- Use `@superpowers:test-driven-development` for every behavior change and `@superpowers:verification-before-completion` before every completion claim.
- Make the task commits below only after their focused tests pass. Do not publish or merge until the full verification task passes.
- Never print `.env` values, provider IDs, email addresses, database URLs, or raw provider responses in logs or review evidence.
- Production mutations are explicitly confined to Tasks 10–12, after the code pull request is green and merged.

## File map

### Growth control plane

- Modify `libs/growth/src/lib/jobs.ts`: exclude imported legacy contacts from campaign enrollment.
- Modify `libs/growth/src/lib/jobs.spec.ts`: assert the SQL eligibility backstop.
- Modify `libs/growth/test/jobs.integration.spec.ts`: prove an imported contact remains excluded after a later approving form event.
- Modify `scripts/import-resend-lifecycle.mts`: create a deterministic terminal marker for every imported contact and enforce the cutover timing preflight.
- Modify `scripts/import-resend-lifecycle.spec.ts`: cover contact markers, idempotency, approval preservation, and timing rejection.
- Create `scripts/cancel-resend-lifecycle.mts`: cancel and reconcile imported scheduled messages one provider record at a time.
- Create `scripts/cancel-resend-lifecycle.spec.ts`: cover guards, partial failure, settlement, deadline expiry, output redaction, and idempotent rerun.
- Modify `libs/growth/project.json`: include the new operator in task inputs and operator tests.
- Modify `libs/growth/vite.operator-cli.config.mts`: include the cancellation operator spec.
- Modify `package.json` and `package-lock.json`: add the operator script and website server boundary dependency without accepting unrelated lockfile changes.
- Modify `docs/superpowers/runbooks/2026-08-31-growth-lifecycle-cutover.md`: replace drain instructions with the approved block/snapshot/import/cancel/reconcile sequence.

### Website server boundary

- Create `apps/website/src/app/api/_internal/read-bounded-body.ts` and its spec.
- Create `apps/website/src/lib/growth/email-keyring.ts`.
- Create `apps/website/src/lib/growth/form-client.ts` and its spec.
- Create `apps/website/src/lib/growth/form-policy.ts` and its spec.
- Create `apps/website/src/lib/growth/form-route.ts` and its spec.
- Create `apps/website/src/lib/growth/lifecycle-client.ts` and its spec.
- Create `apps/website/src/lib/growth/hard-cutover-boundary.spec.ts`.
- Modify `apps/website/tsconfig.json`: add only the internal growth path alias.

### Forms and pages

- Replace `apps/website/src/app/api/whitepaper-signup/route.ts` and its spec.
- Replace `apps/website/src/app/api/newsletter/route.ts` and add its spec.
- Replace `apps/website/src/app/api/leads/route.ts` and replace its spec.
- Modify `apps/website/src/components/landing/WhitePaperBlock.tsx` and add/restore its focused spec.
- Modify `apps/website/src/components/shared/AnnouncementToast.tsx` and add its focused spec.
- Modify `apps/website/src/components/shared/Footer.tsx` and add its focused spec.
- Modify `apps/website/src/components/shared/SiteFooter.tsx` and its focused spec so the root layout can pass policy through the route gate.
- Modify `apps/website/src/components/contact/ContactForm.tsx` and its focused spec.
- Modify `apps/website/src/components/pricing/LeadForm.tsx` and add/restore its focused spec.
- Modify only policy-prop hunks in `apps/website/src/app/layout.tsx`, `page.tsx`, `ag-ui/page.tsx`, `chat/page.tsx`, `contact/page.tsx`, `langgraph/page.tsx`, `pilot-to-prod/page.tsx`, `pricing/page.tsx`, `render/page.tsx`, `solutions/page.tsx`, and `solutions/[slug]/page.tsx`.
- Modify only the four form-flow cases in `apps/website/e2e/website.spec.ts` and the local environment construction in `apps/website/playwright.config.ts`.

### Stop and orchestration adapters

- Replace `apps/website/src/app/api/unsubscribe/route.ts` and add its spec.
- Create `apps/website/src/app/api/growth/stop/route.ts` and its spec.
- Create `apps/website/src/app/api/growth/replies/google/route.ts` and its spec.
- Create `apps/website/src/app/api/webhooks/resend/route.ts` and its spec.
- Create `apps/website/src/app/api/cron/lifecycle/route.ts` and its spec.
- Modify `vercel.json`: register the single lifecycle cron.

### Legacy deletion

- Delete `apps/website/lib/drip.ts`, `apps/website/lib/loops.ts`, and `apps/website/lib/resend.ts`.
- Delete `apps/website/src/app/api/email-preview/route.ts`.
- Delete the legacy-only `apps/website/emails/*.ts` templates after proving no remaining import.
- Do not modify `apps/website/src/lib/analytics/server.ts` in this pull request. It becomes inactive when the form imports disappear; attribution cleanup is a separate change.

## Task 0: Synchronize the clean worktree and prove the baseline

**Files:**

- No planned file changes.

- [x] **Step 1: Fetch and inspect divergence**

```bash
git fetch origin
git status --short --branch
git log --oneline --left-right HEAD...origin/main
```

Expected: only the committed design and this uncommitted plan are local. Stop if any unrelated working-tree change appears.

- [x] **Step 2: Rebase the design commit onto current main**

Temporarily leave the uncommitted plan untouched only if Git can preserve it safely; otherwise stage it nowhere and use a non-destructive temporary patch file outside the repository. Run:

```bash
git rebase origin/main
```

Expected: clean rebase. If a conflict touches the design or any growth/lifecycle file, stop and resolve from current repository truth rather than accepting either side wholesale.

- [x] **Step 3: Re-run the merged-foundation baseline**

```bash
NX_DAEMON=false npx nx run-many -t test --projects=growth,lifecycle --outputStyle=static
```

Expected: PASS before implementation begins.

## Task 1: Block imported contacts from campaign enrollment

**Files:**

- Modify: `libs/growth/src/lib/jobs.spec.ts`
- Modify: `libs/growth/src/lib/jobs.ts`
- Modify: `libs/growth/test/jobs.integration.spec.ts`

- [x] **Step 1: Add a failing SQL-shape assertion**

In the existing `materializes only post-launch approvals` unit test, assert the enrollment query contains this contact-level backstop:

```ts
expect(sql).toMatch(
  /not exists \([\s\S]*from growth_jobs legacy[\s\S]*legacy\.contact_id = c\.id[\s\S]*legacy\.kind = 'legacy'/u
);
```

- [x] **Step 2: Run the focused unit test and prove it fails**

Run:

```bash
npx -y node@22 ./node_modules/vitest/vitest.mjs run --config libs/growth/vite.config.mts libs/growth/src/lib/jobs.spec.ts
```

Expected: FAIL because `materializeCampaignEnrollment()` does not query `growth_jobs legacy`.

- [x] **Step 3: Add the minimal eligibility predicate**

In the `eligible` CTE in `materializeCampaignEnrollment()`, place this before the existing `campaign.enrolled:v1` check:

```sql
and not exists (
  select 1
  from growth_jobs legacy
  where legacy.contact_id = c.id
    and legacy.kind = 'legacy'
)
```

- [x] **Step 4: Add a real-database integration case**

In `libs/growth/test/jobs.integration.spec.ts`, create two approved post-launch contacts. Give one a terminal legacy marker:

```sql
insert into growth_jobs (
  kind, contact_id, status, available_at, idempotency_key, payload
) values (
  'legacy', $1, 'cancelled', $2,
  'legacy:resend:contact:test-imported',
  '{"legacy_type":"contact_marker","provider":"resend"}'::jsonb
)
```

Call `materializeCampaignEnrollment()` and assert only the control contact receives `campaign.enrolled:v1` plus three `send_step` jobs. Then add a later `form.outreach_approved` activity and update `outreach_approved_at` for the imported contact; call again and assert it is still excluded.

- [x] **Step 5: Run unit tests, then the disposable-Neon integration test**

Run the unit command from Step 2. Expected: PASS.

Run with the already-provisioned disposable test connection loaded without printing it:

```bash
NX_DAEMON=false npx nx test-integration growth --outputStyle=static
```

Expected: PASS, including the new imported-contact case.

- [x] **Step 6: Commit**

```bash
git add libs/growth/src/lib/jobs.ts libs/growth/src/lib/jobs.spec.ts libs/growth/test/jobs.integration.spec.ts
git commit -S -m "fix: exclude imported contacts from lifecycle campaign"
```

## Task 2: Mark every imported Resend contact and enforce the timing preflight

**Files:**

- Modify: `scripts/import-resend-lifecycle.spec.ts`
- Modify: `scripts/import-resend-lifecycle.mts`

- [x] **Step 1: Add failing importer tests**

Add cases proving:

1. One contact and zero scheduled messages creates one terminal legacy contact marker.
2. One contact and one scheduled message creates one marker plus one provider-bound legacy schedule job.
3. Reapplying the same snapshot creates neither duplicate.
4. Import never sets `outreach_approved_at`.
5. The apply path rejects before loading keys or creating a database executor when the earliest scheduled message does not allow a 30-minute processing window plus a five-minute delivery margin.
6. A snapshot at the exact 35-minute boundary is accepted.
7. Every scheduled-message payload includes `legacy_type: 'scheduled_message'`, and replay validation rejects an old or conflicting payload shape.
8. A successful import persists one immutable cutover configuration activity containing snapshot time, cancellation deadline, aggregate counts, and a SHA-256 identity of the sorted opaque provider contact/message IDs. Reapply validates rather than replaces it.

Use deterministic keys:

```ts
const contactMarkerKey = `legacy:resend:contact:${providerContactId}`;
const scheduledKey = `legacy:resend:scheduled:${providerEmailId}`;
```

The marker row must be:

```ts
{
  kind: 'legacy',
  status: 'cancelled',
  provider_email_id: null,
  delivery_status: 'not_submitted',
  payload: {
    imported: true,
    legacy_type: 'contact_marker',
    provider: 'resend',
    provider_contact_id: providerContactId,
  },
}
```

Provider IDs remain in Neon but must not appear in CLI output or thrown error text.

- [x] **Step 2: Run the operator test and prove it fails**

```bash
npx -y node@22 ./node_modules/vitest/vitest.mjs run --config libs/growth/vite.operator-cli.config.mts scripts/import-resend-lifecycle.spec.ts
```

Expected: FAIL because contacts without schedules have no marker and no timing guard exists.

- [x] **Step 3: Implement marker creation inside the existing import transaction**

After `importContact()` returns each contact, insert the deterministic marker with `ON CONFLICT (idempotency_key) DO NOTHING`, validate an existing row exactly on replay, and add separate aggregate result fields:

```ts
legacy_contact_markers_created: number;
legacy_contact_markers_existing: number;
legacy_scheduled_jobs_created: number;
legacy_scheduled_jobs_existing: number;
```

Do not overload the marker with schedule state. Keep the existing provider-bound job per scheduled message.

Change the scheduled-message payload to:

```ts
const payload = {
  imported: true,
  legacy_type: 'scheduled_message',
  provider: 'resend',
  provider_state: 'scheduled',
};
```

Validate this exact payload on replay so the later cancellation query cannot silently miss an older row.

- [x] **Step 4: Implement a pure timing preflight**

Add constants and a pure exported helper:

```ts
const MIN_CANCELLATION_WORK_MS = 30 * 60_000;
const DELIVERY_SAFETY_MARGIN_MS = 5 * 60_000;

export function cancellationDeadline(
  snapshot: ResendLifecycleSnapshot,
  snapshotAt: Date
): Date | null {
  if (snapshot.scheduledEmails.length === 0) return null;
  const earliest = Math.min(
    ...snapshot.scheduledEmails.map(({ scheduled_at }) =>
      new Date(scheduled_at).getTime()
    )
  );
  const deadline = new Date(earliest - DELIVERY_SAFETY_MARGIN_MS);
  if (deadline.getTime() - snapshotAt.getTime() < MIN_CANCELLATION_WORK_MS) {
    fail('snapshot_cancellation_window_insufficient');
  }
  return deadline;
}
```

Call it after exact count validation but before key loading, database creation, or provider mutation. Use one captured `now()` value for preflight and import.

Inside the successful import transaction, persist the authority used by the separate cancellation process:

```ts
{
  event_key: 'legacy:resend:cutover:v1:configuration',
  kind: 'legacy.resend_cutover_configured',
  occurred_at: snapshotAt,
  data: {
    snapshot_at: snapshotAt.toISOString(),
    cancellation_deadline: deadline?.toISOString() ?? null,
    expected_contacts: prepared.contacts.length,
    expected_scheduled: prepared.scheduled.length,
    snapshot_identity: sha256OfSortedOpaqueProviderIds,
  },
}
```

`snapshot_identity` hashes only opaque provider IDs and structural separators, never email or other PII. `ON CONFLICT` must read and validate the exact stored counts, deadline, and identity; it must not move the deadline. Add only the deadline timestamp and remaining seconds to aggregate CLI output.

- [x] **Step 5: Run focused tests and type/build checks**

Run the command from Step 2, then:

```bash
NX_DAEMON=false npx nx test-operator-cli growth --outputStyle=static
NX_DAEMON=false npx nx build growth --outputStyle=static
```

Expected: all PASS.

- [x] **Step 6: Commit**

```bash
git add scripts/import-resend-lifecycle.mts scripts/import-resend-lifecycle.spec.ts
git commit -S -m "feat: mark imported lifecycle contacts"
```

## Task 3: Add the one-record-at-a-time legacy cancellation operator

**Files:**

- Create: `scripts/cancel-resend-lifecycle.mts`
- Create: `scripts/cancel-resend-lifecycle.spec.ts`
- Modify: `libs/growth/project.json`
- Modify: `libs/growth/vite.operator-cli.config.mts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `docs/superpowers/runbooks/2026-08-31-growth-lifecycle-cutover.md`

- [x] **Step 1: Write the failing operator contract tests**

Define a dependency-injected `mainCancelResendLifecycle()` and test:

- `--dry-run` reads Neon and Resend, emits aggregate counts only, and never calls cancel.
- `--apply` requires `--expected-scheduled N` and the same `TEST_DATABASE_URL` versus acknowledged `DATABASE_URL` guard as the importer.
- Any currently scheduled Resend ID outside the complete immutable imported schedule set halts before mutation.
- Missing unresolved IDs are checked with `emails.get()` before comparing the remaining verified-scheduled subset with the provider scheduled set.
- When configured `expected_scheduled > 0`, the stored cancellation deadline must be non-null and still in the future.
- When configured `expected_scheduled === 0`, the deadline must be null, both imported/provider schedule inventories must be empty, and the operator succeeds with zero `get` or `cancel` calls.
- Each call is `client.emails.cancel(exactProviderId)`; there is no bulk or recipient-derived call.
- A confirmed cancellation sets only its exact job to terminal state and records one stable activity event.
- Provider error or ambiguous result keeps the exact job unresolved with a closed `last_error_code`.
- If provider cancellation succeeds but Neon settlement fails, a rerun uses `emails.get(exactProviderId)` and settles only when the exact record reports `last_event === 'canceled'`; it does not issue a second cancel.
- Missing, malformed, delivered, or otherwise ambiguous exact-record lookup remains unresolved and halts cutover.
- A provider-unsubscribed imported contact whose stop transaction already changed the job's `status` to `cancelled` is still selected while `payload.provider_state === 'scheduled'`.
- A final paginated re-list must contain zero scheduled messages.
- A rerun after full settlement makes zero cancellation calls and returns success.
- Output and errors contain no `@`, provider ID, subject, recipient, or raw provider error.

Use this public surface:

```ts
export interface LegacyCancellationClient {
  emails: {
    list(options: { limit: number; after?: string }): Promise<ProviderListResponse<unknown>>;
    cancel(id: string): Promise<{ data: unknown | null; error: unknown | null }>;
    get(id: string): Promise<{ data: unknown | null; error: unknown | null }>;
  };
}

export async function mainCancelResendLifecycle(
  argv: readonly string[],
  dependencies: LegacyCancellationDependencies
): Promise<number>;
```

- [x] **Step 2: Run the new spec and prove it fails**

```bash
npx -y node@22 ./node_modules/vitest/vitest.mjs run --config libs/growth/vite.operator-cli.config.mts scripts/cancel-resend-lifecycle.spec.ts
```

Expected: FAIL because the file is absent.

- [x] **Step 3: Implement bounded inventory loading and guards**

Read and validate `legacy:resend:cutover:v1:configuration`, including deadline, counts, and snapshot identity. Reconstruct the complete immutable inventory with two queries that do not filter on job status or provider state:

```sql
select payload->>'provider_contact_id' as provider_contact_id
from growth_jobs
where kind = 'legacy'
  and provider_email_id is null
  and payload->>'legacy_type' = 'contact_marker'
order by payload->>'provider_contact_id'
```

```sql
select id, contact_id, available_at, provider_email_id, status, payload
from growth_jobs
where kind = 'legacy'
  and provider_email_id is not null
  and payload->>'legacy_type' = 'scheduled_message'
order by provider_email_id
```

Recompute the configured snapshot identity from all contact-marker IDs and all scheduled-message IDs, including already reconciled rows. Validate exact contact and scheduled counts plus the stored hash before selecting work. Require a future stored deadline only when the configured scheduled count is positive. For zero schedules, require a null deadline and empty immutable, unresolved, and provider scheduled inventories.

Provider reconciliation is then keyed by `payload.provider_state`, not job `status`, because `stopContact()` may already cancel the local job for an unsubscribed contact while the Resend schedule remains live. Derive the unresolved subset with:

```sql
select id, contact_id, available_at, provider_email_id, status, payload
from growth_jobs
where kind = 'legacy'
  and provider_email_id is not null
  and payload->>'legacy_type' = 'scheduled_message'
  and payload->>'provider_state' = 'scheduled'
order by provider_email_id
```

Include both `pending` and locally `cancelled` jobs while `payload->>'provider_state' = 'scheduled'`. Reject null/duplicate/unbounded IDs, unknown job state, count/snapshot-identity drift, database-environment mismatch, a currently scheduled provider ID outside the full immutable imported schedule set, or an expired stored deadline before the first cancel call. Do not require equality with the unresolved subset yet; missing unresolved IDs must pass exact-record recovery first.

- [x] **Step 4: Implement exact settlement**

After each successful provider cancellation, use one transaction to update the exact job and insert a stable activity:

```sql
update growth_jobs
set status = 'cancelled',
    lease_token = null,
    lease_until = null,
    last_error_code = null,
    payload = payload || jsonb_build_object(
      'provider_state', 'cancelled',
      'cancelled_at', $2::timestamptz
    )
where id = $1
  and kind = 'legacy'
  and provider_email_id = $3
  and payload->>'legacy_type' = 'scheduled_message'
  and payload->>'provider_state' = 'scheduled'
returning id
```

Insert `legacy.resend_schedule_cancelled` with `event_key = 'legacy:resend:scheduled:' || job_id || ':cancelled'`. On provider failure, preserve the local job status, leave `payload.provider_state='scheduled'`, write one closed error category, and continue only long enough to produce a complete unresolved aggregate. Never mark an absent-but-unconfirmed provider record as cancelled.

- [x] **Step 5: Re-list and require zero**

Before issuing a cancel, classify each unresolved imported ID from the current scheduled list. If it is absent, call `emails.get(id)`:

- `last_event === 'canceled'`: settle Neon without another cancellation call.
- Still scheduled: retain it in the verified-scheduled subset.
- Delivered, sent, failed, unknown, missing, or malformed: persist a closed unresolved category and halt the cutover.

This exact-record reconciliation is mandatory after a prior provider success followed by a Neon failure. After settling every verified canceled record, re-query the unresolved subset and require its ID set to equal the verified-scheduled provider set. Only then call `emails.cancel(id)` once for each remaining exact ID.

After the per-record cancellation pass, use the same bounded pagination as the importer. Success requires:

```ts
{
  unresolved_imported: 0,
  unexpected_provider_scheduled: 0,
  provider_scheduled_remaining: 0,
}
```

If the deadline passes at any checkpoint, stop further mutation, persist the unresolved state, and fail.

- [x] **Step 6: Wire repository commands**

Add:

```json
"growth:cancel-resend": "tsx scripts/cancel-resend-lifecycle.mts"
```

Add `scripts/cancel-resend-lifecycle*` to `growthLifecycleControlPlane` and its spec to `vite.operator-cli.config.mts`. Update the lockfile only through `npm install --package-lock-only --ignore-scripts` if package metadata actually changes; reject unrelated removals.

- [x] **Step 7: Replace the legacy drain runbook section**

Document the exact sequence: Vercel Firewall block, in-flight request drain, stable provider inventories, final importer dry run, timing preflight, apply, cancellation dry run, cancellation apply, exact-record recovery, final provider re-list, hard-boundary deploy, and firewall removal. Replace rollback instructions so no prior website deployment may receive the three form POSTs: block them first, keep them blocked until a Neon-only boundary is restored, and reconcile accepted Neon/provider effects before reopening. Use placeholders for counts and never show provider IDs.

- [x] **Step 8: Run operator, growth, and lint checks**

```bash
NX_DAEMON=false npx nx test-operator-cli growth --outputStyle=static
NX_DAEMON=false npx nx test growth --outputStyle=static
NX_DAEMON=false npx nx lint growth --outputStyle=static
```

Expected: all PASS.

- [x] **Step 9: Commit**

```bash
git add scripts/cancel-resend-lifecycle.mts scripts/cancel-resend-lifecycle.spec.ts libs/growth/project.json libs/growth/vite.operator-cli.config.mts package.json package-lock.json docs/superpowers/runbooks/2026-08-31-growth-lifecycle-cutover.md
git commit -S -m "feat: reconcile scheduled lifecycle mail"
```

## Task 4: Establish the fail-closed website growth boundary

**Files:**

- Create: `apps/website/src/app/api/_internal/read-bounded-body.ts`
- Create: `apps/website/src/app/api/_internal/read-bounded-body.spec.ts`
- Create: `apps/website/src/lib/growth/email-keyring.ts`
- Create: `apps/website/src/lib/growth/form-client.ts`
- Create: `apps/website/src/lib/growth/form-client.spec.ts`
- Create: `apps/website/src/lib/growth/form-policy.ts`
- Create: `apps/website/src/lib/growth/form-policy.spec.ts`
- Create: `apps/website/src/lib/growth/form-route.ts`
- Create: `apps/website/src/lib/growth/form-route.spec.ts`
- Create: `apps/website/src/lib/growth/lifecycle-client.ts`
- Create: `apps/website/src/lib/growth/lifecycle-client.spec.ts`
- Modify: `apps/website/tsconfig.json`
- Modify: `package.json`
- Modify: `package-lock.json`

- [x] **Step 1: Port the focused helper tests, then harden the policy tests**

Use the source draft versions as the starting point, but change the policy expectations to:

```ts
expect(() => getFormPolicy({})).toThrow(/GROWTH_FORM_POLICY/u);
expect(() => getFormPolicy({ GROWTH_FORM_POLICY: 'legacy' })).toThrow();
expect(() => getFormPolicy({ GROWTH_FORM_POLICY: 'unknown' })).toThrow();
expect(getFormPolicy({ GROWTH_FORM_POLICY: 'growth_v1' })).toEqual({
  mode: 'growth_v1',
  version: GROWTH_FORM_POLICY_VERSION,
  disclosures: expect.objectContaining({
    whitepaper: expect.any(String),
    newsletter: expect.any(String),
    contact: expect.any(String),
  }),
});
```

Retain tests for bounded body streaming, immutable retry snapshots, acquisition-session UUIDs, PII-free nudges, timeout, and secret-safe errors.

- [x] **Step 2: Run the focused website tests and prove they fail**

```bash
npx -y node@22 ./node_modules/vitest/vitest.mjs run --config apps/website/vite.config.mts apps/website/src/app/api/_internal/read-bounded-body.spec.ts apps/website/src/lib/growth/form-client.spec.ts apps/website/src/lib/growth/form-policy.spec.ts apps/website/src/lib/growth/form-route.spec.ts apps/website/src/lib/growth/lifecycle-client.spec.ts
```

Expected: FAIL because the files are absent.

- [x] **Step 3: Port helpers from the source draft using `apply_patch`**

Port the six focused modules without copying any other source-worktree file. Preserve dependency injection and closed errors. Add only this path to `apps/website/tsconfig.json`:

```json
"@threadplane-internal/growth": ["../../libs/growth/src/index.ts"]
```

Add `server-only@^0.0.1` to the root package metadata and lockfile without accepting the draft's unrelated dependency changes.

- [x] **Step 4: Remove legacy from the policy type and runtime**

The final policy module must have no `LEGACY_POLICY` and no default:

```ts
export interface PublicFormPolicy {
  mode: 'growth_v1';
  version: typeof GROWTH_FORM_POLICY_VERSION;
  disclosures: {
    contact: string;
    newsletter: string;
    whitepaper: string;
  };
}

export function getFormPolicy(
  environment: Readonly<Record<string, string | undefined>> = process.env
): PublicFormPolicy {
  if (environment['GROWTH_FORM_POLICY']?.trim() !== 'growth_v1') {
    throw new Error('GROWTH_FORM_POLICY must be growth_v1');
  }
  return GROWTH_V1_POLICY;
}
```

- [x] **Step 5: Run focused tests and the website type/build surface**

Run the command from Step 2. Expected: PASS.

```bash
GROWTH_FORM_POLICY=growth_v1 NX_DAEMON=false npx nx test website --outputStyle=static
```

Expected: existing website tests plus new helpers PASS.

- [x] **Step 6: Commit**

```bash
git add apps/website/src/app/api/_internal apps/website/src/lib/growth apps/website/tsconfig.json package.json package-lock.json
git commit -S -m "feat: add durable website growth boundary"
```

## Task 5: Cut all acquisition forms over to Neon-only acceptance

**Files:**

- Modify: `apps/website/src/app/api/whitepaper-signup/route.ts`
- Create: `apps/website/src/app/api/whitepaper-signup/route.spec.ts`
- Modify: `apps/website/src/app/api/newsletter/route.ts`
- Create: `apps/website/src/app/api/newsletter/route.spec.ts`
- Modify: `apps/website/src/app/api/leads/route.ts`
- Modify: `apps/website/src/app/api/leads/route.spec.ts`

- [x] **Step 1: Port and rewrite route tests as growth-only contracts**

Start from the source draft's `growth_v1` describes. Delete every expectation for NDJSON, Loops, Resend Audience, synchronous email, legacy analytics, or `legacyPost`. Add a common assertion per route:

```ts
expect(accept).toHaveBeenCalledOnce();
expect(accept.mock.invocationCallOrder[0]).toBeLessThan(
  nudge.mock.invocationCallOrder[0]
);
```

Required cases per route: committed success, stale/missing policy `409`, malformed/oversized body `400`, invalid email `400`, invalid UUID `400`, database/keyring setup `503`, Neon transaction `503`, post-commit nudge failure still `200`, and same-UUID replay without duplicate logical jobs.

- [x] **Step 2: Run the three route specs and prove the growth-only expectations fail**

```bash
npx -y node@22 ./node_modules/vitest/vitest.mjs run --config apps/website/vite.config.mts apps/website/src/app/api/whitepaper-signup/route.spec.ts apps/website/src/app/api/newsletter/route.spec.ts apps/website/src/app/api/leads/route.spec.ts
```

Expected: FAIL while the current routes still import and execute legacy helpers.

- [x] **Step 3: Replace the routes with their source-draft durable branches only**

Remove `legacyPost()` and all imports of `fs`, `path`, `getSourcePage`, website email templates, `lib/drip`, `lib/loops`, `lib/resend`, and `lib/analytics/server`. Each route must follow only:

```ts
const body = await readBoundedJsonObject(request, MAX_BODY_BYTES);
const policy = dependencies.getPolicy();
if (!matchesSubmittedFormPolicy(policy, submittedVersion)) {
  return stalePolicyResponse(policy);
}
// Strict field validation and normalizeRecipientEmail.
// Create DB + load keyring.
await dependencies.accept(database, input);
// Close DB.
await dependencies.nudge({ submissionId }).catch(() => undefined);
return jsonResponse({ ok: true });
```

No code path may send or schedule email from the request.

- [x] **Step 4: Add cross-route static boundary assertions**

Create `apps/website/src/lib/growth/hard-cutover-boundary.spec.ts`. Read only the three production route source files and reject these patterns:

```ts
const forbidden = [
  /from ['"](?:node:)?fs['"]/u,
  /lib\/loops/u,
  /lib\/resend/u,
  /lib\/drip/u,
  /scheduleWhitepaperDrip/u,
  /addToAudience/u,
  /sendEmail\(/u,
  /\.ndjson/u,
  /legacyPost/u,
];
```

- [x] **Step 5: Run focused and full website unit tests**

Run the command from Step 2, then:

```bash
GROWTH_FORM_POLICY=growth_v1 NX_DAEMON=false npx nx test website --outputStyle=static
```

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add apps/website/src/app/api/whitepaper-signup apps/website/src/app/api/newsletter apps/website/src/app/api/leads apps/website/src/lib/growth/hard-cutover-boundary.spec.ts
git commit -S -m "feat: persist acquisition forms in neon"
```

## Task 6: Make every rendered form submit the immutable growth envelope

**Files:**

- Modify the five form components and their focused specs listed in the file map.
- Modify `apps/website/src/components/shared/SiteFooter.tsx` and `SiteFooter.spec.tsx`.
- Modify only policy-prop hunks in the eleven page/layout files listed in the file map, including `ag-ui/page.tsx`.
- Modify: `apps/website/playwright.config.ts`
- Modify: `apps/website/e2e/website.spec.ts`

- [x] **Step 1: Port focused component tests and add hard-cutover assertions**

Each form spec must prove:

- The disclosure text is visible and referenced with `aria-describedby`.
- The request contains `submission_id`, `policy_version`, and optional `acquisition_session_id` plus the declared form facts.
- An uncertain retry reuses the same UUID and immutable facts.
- A changed form creates a new UUID.
- `409` displays the refresh/retry message and does not report success.
- No component contains a `formPolicy.mode === 'legacy'` branch.

Add a `SiteFooter` test proving it passes the exact policy object to `Footer` on marketing routes and still renders nothing on `/docs` routes.

- [x] **Step 2: Run focused component tests and prove they fail**

```bash
npx -y node@22 ./node_modules/vitest/vitest.mjs run --config apps/website/vite.config.mts apps/website/src/components/landing/WhitePaperBlock.spec.tsx apps/website/src/components/shared/AnnouncementToast.spec.tsx apps/website/src/components/shared/Footer.spec.tsx apps/website/src/components/shared/SiteFooter.spec.tsx apps/website/src/components/contact/ContactForm.spec.tsx apps/website/src/components/pricing/LeadForm.spec.tsx
```

Expected: FAIL because current components submit the legacy payload.

- [x] **Step 3: Port only the growth form behavior**

Use `growthFormRequestSnapshot()` unconditionally. Accept `PublicFormPolicy` as a server-provided prop, render its matching disclosure, send the immutable snapshot, retain it after an uncertain failure, and clear it after success or a user fact change. Do not port visual redesign hunks.

- [x] **Step 4: Thread policy through pages without unrelated changes**

In every listed server page/layout, add only `getFormPolicy()`, create `const formPolicy = getFormPolicy()`, and pass it to the relevant form. The root layout passes it through `SiteFooter` and directly to `AnnouncementToast`; `SiteFooter` passes it to `Footer`. `ag-ui/page.tsx` passes it to its existing `WhitePaperBlock`. Compare each reconstructed file against `origin/main` and ensure the diff contains no unrelated text, structure, style, telemetry, privacy, or cockpit changes.

- [x] **Step 5: Update local Playwright environment and four form assertions**

Set `GROWTH_FORM_POLICY: 'growth_v1'` in `createLocalWebServerEnvironment()`. Update only contact, pricing, newsletter, and whitepaper E2E payload expectations to require UUID-shaped `submission_id` and the exact policy version. Keep network interception so E2E does not require Neon or send email.

- [x] **Step 6: Run component tests and browser form flows**

Run Step 2. Expected: PASS.

```bash
GROWTH_FORM_POLICY=growth_v1 NX_DAEMON=false npx nx e2e website --outputStyle=static --grep "contact page submits|pricing lead form posts|footer newsletter form posts|whitepaper signup form posts"
```

Expected: four selected tests PASS with no external provider call.

- [x] **Step 7: Commit**

Stage only the named files, inspect `git diff --cached`, then:

```bash
git commit -S -m "feat: submit growth approval envelopes"
```

## Task 7: Land stop, webhook, reply, and cron adapters

**Files:**

- Modify: `apps/website/src/app/api/unsubscribe/route.ts`
- Create the four route directories/specs listed under “Stop and orchestration adapters”.
- Modify: `vercel.json`

- [x] **Step 1: Port all five route specs and correct legacy unsubscribe expectations**

For the raw-email compatibility case, replace the source-draft test that treats internal failure as success. The required matrix is:

```ts
// Healthy known and healthy unknown valid addresses: same 200 shape.
// Database/stop failure for any valid address: same retryable 503 shape.
// Malformed address: 400 without database access.
```

Add the same retry distinction for signed human confirmation and RFC one-click POST: malformed content or invalid/expired token remains the closed `400` response, while database creation, canonical stop failure, or database close failure returns the uniform retryable `503` response so clients can retry.

Retain exact raw-body webhook verification, size limits, HMAC timestamp/replay checks, no-cookie confirmation pages, one-click POST parsing, closed errors, database cleanup, and cron-disabled behavior.

- [x] **Step 2: Run route tests and prove they fail**

```bash
npx -y node@22 ./node_modules/vitest/vitest.mjs run --config apps/website/vite.config.mts apps/website/src/app/api/unsubscribe/route.spec.ts apps/website/src/app/api/growth/stop/route.spec.ts apps/website/src/app/api/growth/replies/google/route.spec.ts apps/website/src/app/api/webhooks/resend/route.spec.ts apps/website/src/app/api/cron/lifecycle/route.spec.ts
```

Expected: FAIL because four routes are absent and legacy unsubscribe is not durable.

- [x] **Step 3: Port the adapters and fix false-success unsubscribe**

In the raw-email GET branch, keep known/unknown non-enumeration but move `successResponse()` inside the successful database operation:

```ts
try {
  await withDatabase(dependencies, async (executor) => {
    await dependencies.stopLegacyEmailUnsubscribe(executor, input);
  });
  return successResponse();
} catch {
  return retryableFailureResponse();
}
```

Do not log the email or internal error. New links and one-click POSTs use only signed opaque tokens.

Apply the same server-failure response in the signed POST branch:

```ts
try {
  await withDatabase(dependencies, (executor) =>
    dependencies.stopContact(executor, signedStopInput(payload, receivedAt))
  );
  return successResponse();
} catch {
  return retryableFailureResponse();
}
```

- [x] **Step 4: Register exactly one Vercel cron**

Add only:

```json
"crons": [
  { "path": "/api/cron/lifecycle", "schedule": "* * * * *" }
]
```

The route must still return disabled without invoking Dawn unless `LIFECYCLE_CRON_ENABLED` is exactly `true`.

- [x] **Step 5: Run focused tests, website tests, and config checks**

Run Step 2. Expected: PASS.

```bash
GROWTH_FORM_POLICY=growth_v1 NX_DAEMON=false npx nx test website --outputStyle=static
```

Expected: PASS, including one cron registration and failure-path tests.

- [x] **Step 6: Commit**

```bash
git add apps/website/src/app/api/unsubscribe apps/website/src/app/api/growth apps/website/src/app/api/webhooks apps/website/src/app/api/cron vercel.json
git commit -S -m "feat: expose lifecycle stop and dispatch routes"
```

## Task 8: Delete the legacy delivery implementation and prove the production boundary

**Files:**

- Delete the legacy files listed under “Legacy deletion”.
- Modify: `apps/website/package.json` if `resend` becomes unused there.
- Modify: `package-lock.json` only as required.
- Modify: `apps/website/src/lib/growth/hard-cutover-boundary.spec.ts`

- [x] **Step 1: Expand the boundary test before deletion**

Assert the legacy modules and preview route do not exist and production source contains no imports or calls to them. Also assert no affected route imports `apps/website/src/lib/analytics/server.ts`.

- [x] **Step 2: Run the boundary test and prove it fails**

```bash
npx -y node@22 ./node_modules/vitest/vitest.mjs run --config apps/website/vite.config.mts apps/website/src/lib/growth/hard-cutover-boundary.spec.ts
```

Expected: FAIL because the legacy modules still exist.

- [x] **Step 3: Delete only the now-unreferenced legacy implementation**

Delete `apps/website/lib/{drip,loops,resend}.ts`, `/api/email-preview`, and all `apps/website/emails/*.ts`. Confirm first that `rg` finds no remaining import outside those files. Remove `resend` from `apps/website/package.json` only if no website source imports it; keep the root/lifecycle dependency used by the operator and Dawn delivery.

- [x] **Step 4: Regenerate only required package metadata**

```bash
npm install --package-lock-only --ignore-scripts
```

Inspect the lockfile and revert any unrelated mechanical drift with a targeted patch; do not copy the dirty source lockfile.

- [x] **Step 5: Prove the legacy surface is gone**

```bash
rg -n "scheduleWhitepaperDrip|loopsUpsertContact|loopsSendEvent|addToAudience|whitepaper-signups\.ndjson|leads\.ndjson|unsubscribed\.ndjson|legacyPost" apps/website
```

Expected: no production matches; only explicit forbidden-pattern strings inside the boundary spec are allowed.

Run the boundary test. Expected: PASS.

- [x] **Step 6: Run website lint and production build**

```bash
GROWTH_FORM_POLICY=growth_v1 NX_DAEMON=false npx nx lint website --outputStyle=static
GROWTH_FORM_POLICY=growth_v1 NX_DAEMON=false npx nx build website --outputStyle=static
```

Expected: PASS. Inspect `dist/apps/website/.next` and verify the affected functions contain no legacy module or NDJSON path.

- [x] **Step 7: Commit**

```bash
git add -A apps/website package-lock.json
git commit -S -m "refactor: remove legacy website email pipeline"
```

## Task 9: Full verification, review, pull request, and merge

**Files:**

- Review all changed files; create no planned new production code.

- [x] **Step 1: Verify scope before broad tests**

```bash
git status --short
git diff --stat origin/main...HEAD
git diff --name-status origin/main...HEAD
git diff --check origin/main...HEAD
```

Expected: only files named in this plan and the committed design spec. No generated docs, `data/`, `tsconfig.tsbuildinfo`, telemetry, privacy, cockpit, or visual-redesign files.

- [x] **Step 2: Run all repository-native project gates**

```bash
GROWTH_FORM_POLICY=growth_v1 NX_DAEMON=false npx nx run-many -t test lint build --projects=growth,lifecycle,website --outputStyle=static
NX_DAEMON=false npx nx run lifecycle:check --outputStyle=static
NX_DAEMON=false npx nx run growth:test-operator-cli --outputStyle=static
NX_DAEMON=false npx nx run growth:test-integration --outputStyle=static
```

Expected: every target PASS using the disposable Neon integration database for the final command.

- [x] **Step 3: Run production-mode website E2E**

Build first, then:

```bash
GROWTH_FORM_POLICY=growth_v1 WEBSITE_E2E_MODE=production NX_DAEMON=false npx nx e2e website --outputStyle=static
```

Expected: PASS; mocked form requests contain policy and UUID fields, and no provider effect occurs.

- [ ] **Step 4: Run preview no-delivery canaries**

With preview `DELIVERY_ENABLED=false`, `CAMPAIGN_ENROLLMENT_ENABLED=false`, `CAMPAIGN_ENABLED=false`, and cron disabled, deploy the branch preview. Submit one deterministic form fixture and verify one contact, approval activity, and expected fulfillment/enrichment/notification jobs in preview Neon, with zero Resend effects. Verify authenticated lifecycle health and two-instance Dawn persistence using the existing runbook.

- [ ] **Step 5: Request independent code review**

Invoke `@superpowers:requesting-code-review`. Resolve only evidence-backed findings, rerun affected tests after each change, and make one signed fix commit if needed.

- [ ] **Step 6: Create the pull request**

The PR title and body must describe the hard cutover, testing, operational gates, and explicit exclusions without referencing internal agent tooling. Do not include secrets, provider identifiers, contacts, or raw environment output.

- [ ] **Step 7: Wait for green and merge**

Require all branch protections and review gates to pass. Re-read the live check state immediately before merge. Merge on green as previously authorized; do not start production mutation on a merely pending or stale check result.

## Task 10: Provision and deploy production with every effect switch off

**Files:**

- No repository edits. Follow `docs/superpowers/runbooks/2026-08-31-growth-lifecycle-cutover.md`.

- [ ] **Step 1: Re-read provider state before mutation**

Verify the current Vercel team/project linkage, the live website project, the lifecycle project, available Neon Marketplace installation, and production environment metadata. Never assume preview resource IDs or historical Resend counts apply to production.

- [ ] **Step 2: Provision two distinct production Neon resources**

Create one Growth production resource connected to both website and lifecycle projects as `DATABASE_URL`, and a separate Dawn production resource connected only to lifecycle as `DAWN_DATABASE_URL`. Require different resource IDs and production-only environment scope.

- [ ] **Step 3: Apply and verify migrations**

Run database preflight, apply the committed migrations to Growth production, and verify reporting views. Initialize Dawn storage only through the lifecycle service's supported deployment path. Do not alias Dawn storage to Growth.

- [ ] **Step 4: Install production secrets and fail-closed flags**

Website: growth database environment, form policy, token/email keyrings, webhook secret, Google reply secret, cron secret, lifecycle URL and service secret.

Lifecycle: Growth and Dawn connections, service secret, model/provider keys, sender configuration, action-token keyring, founder address, and exact environment policy.

Set:

```text
LIFECYCLE_CRON_ENABLED=false
DELIVERY_ENABLED=false
CAMPAIGN_ENROLLMENT_ENABLED=false
CAMPAIGN_ENABLED=false
GROWTH_FORM_POLICY=growth_v1
```

- [ ] **Step 5: Deploy lifecycle first**

Deploy the merged commit, verify unauthenticated rejection and authenticated real `/healthz`, then prove no job leasing or provider delivery can occur with switches off.

- [ ] **Step 6: Prepare—but do not promote—the website deployment**

Build/deploy the merged website artifact with `growth_v1`. Verify configuration, database reachability, lifecycle reachability, and bundle absence of legacy code on its deployment URL. Do not route production form traffic to it yet.

- [ ] **Step 7: Prepare and verify the rollback control before cutover**

Create the exact Vercel Firewall rule definition used to block the three form POST paths and verify it can be installed without affecting ordinary GET traffic. Record the current and prepared deployment identifiers privately. The rollback order is fixed: disable campaign/enrollment and recipient delivery as appropriate; install and verify the three-route block; wait for in-flight requests; select a prior deployment only behind that block; reconcile Neon jobs and all provider effects; restore a deployment that retains the Neon-only form boundary; then remove the block. Forms must never reopen on the old NDJSON/Loops/Resend scheduling implementation.

## Task 11: Execute the quiescent hard cutover

**Files:**

- No repository edits. Record aggregate-only evidence in the private operator worksheet described by the runbook.

- [ ] **Step 1: Install and verify the temporary form-route block**

Create a Vercel Firewall rule that returns a retryable maintenance response only for POST requests to:

```text
/api/whitepaper-signup
/api/newsletter
/api/leads
```

Verify all three production POSTs are blocked and ordinary site GETs remain available.

- [ ] **Step 2: Drain pre-block legacy invocations and prove inventory stability**

Resolve the maximum execution duration of the currently deployed legacy form functions from the production deployment configuration. Wait that entire duration plus a 30-second margin after the firewall block becomes effective. Use Vercel runtime observability to require zero active invocations for the three paths, then take two complete aggregate Resend contact/scheduled inventories 60 seconds apart. Both inventories must have identical counts and scheduled-ID set hashes. If they drift, keep the firewall active and restart the drain interval.

- [ ] **Step 3: Take the authoritative snapshot and timing preflight**

Run the importer dry run, approve exact aggregate counts privately, and confirm the earliest scheduled delivery leaves the required 30-minute work window plus five-minute margin. If it does not, make no DB/provider mutation, remove the firewall rule, and select a later safe window.

- [ ] **Step 4: Import the final snapshot**

Run the production-acknowledged importer with exact expected counts. Verify:

- every provider contact has one terminal marker;
- every scheduled message has one provider-bound legacy job;
- zero approval timestamps were granted;
- re-running is idempotent.

- [ ] **Step 5: Cancel and reconcile every scheduled message**

Run cancellation dry-run, approve its aggregate inventory, then apply. Require one supported Resend cancel operation per exact imported job, durable settlement, zero unresolved jobs, zero unexpected provider schedules, zero final scheduled messages, and completion before the deadline.

If any condition fails, keep the firewall and all campaign switches off. Follow the prepared rollback order if deployment rollback is required. Do not claim cutover completion or route form POSTs to a prior deployment.

- [ ] **Step 6: Promote the hard-boundary website while forms remain blocked**

Promote the prepared website deployment. Verify production is on the merged commit, `growth_v1` is active, and static/runtime probes find no NDJSON, Loops, Audience, direct send, or provider scheduling path.

- [ ] **Step 7: Reopen forms and capture the immutable cohort instant**

Remove the firewall rule. Record that exact instant for `CAMPAIGN_ENROLLMENT_START_AT`. Submit one allowlisted no-delivery form smoke test and verify its Neon transaction and jobs. Suppress or delete the synthetic contact through the approved exact-key cleanup so it cannot enter the real campaign.

## Task 12: Verify callbacks, enable fulfillment, then enable the campaign

**Files:**

- No repository edits unless runtime testing reveals a defect; defects return to a new tested pull request rather than being patched directly in production.

- [ ] **Step 1: Register and verify the Resend webhook**

Register the exact production webhook URL and allowed delivery events. Verify a signed fixture changes the exact job delivery state and a forged/stale signature produces no mutation. Leave open/click tracking disabled.

- [ ] **Step 2: Install and initialize Google mailbox polling**

Under the intended Google Business Starter mailbox owner, install the committed Apps Script, set only Script Properties, initialize the history watermark once, and create exactly one minute trigger. Verify metadata/header-only callback behavior and no message-body persistence.

- [ ] **Step 3: Enable cron with recipient delivery still off**

Set `LIFECYCLE_CRON_ENABLED=true`. Verify durable jobs are discoverable without provider submission, no duplicate leases occur across two lifecycle instances, and no mailbox recovery condition is open.

- [ ] **Step 4: Enable fulfillment delivery only**

Set `DELIVERY_ENABLED=true` while campaign enrollment and campaign delivery stay false. Submit one allowlisted production whitepaper request. Require exactly one plain-text fulfillment, persisted provider ID, webhook delivery state, correct Reply-To, signed unsubscribe headers, authenticated domain results, and no tracking.

- [ ] **Step 5: Verify natural reply stop**

Reply from the canary recipient. Require the Google poller to record the reply stop, clear `outreach_approved_at`, and cancel pending campaign work without persisting body, subject, or snippet.

- [ ] **Step 6: Set the immutable cohort timestamp and inspect enrollment**

Set `CAMPAIGN_ENROLLMENT_START_AT` to the recorded form-reopen instant. Set `CAMPAIGN_ENROLLMENT_ENABLED=true` while `CAMPAIGN_ENABLED=false`. Inspect aggregate cohort counts and prove every imported legacy marker is excluded.

- [ ] **Step 7: Enable campaign delivery last**

Start with an internal/allowlisted new contact, set `CAMPAIGN_ENABLED=true`, and verify step 1 exactly once. Then allow the small new post-cutover cohort. Stop immediately on duplicate acceptance, unknown provider outcome, reply/suppression bypass, unexpected recipient, or legacy-contact enrollment.

- [ ] **Step 8: Verify rollback invariants remain available**

Before declaring success, confirm the documented firewall rule still targets exactly the three POST routes, the prior deployment cannot receive those requests without the rule, and the operator worksheet can reconcile every Neon acceptance/provider effect since forms reopened. If rollback is needed, execute the fixed order from Task 10 Step 7 and keep forms blocked until a Neon-only deployment is restored.

- [ ] **Step 9: Close the cutover only with evidence**

Record aggregate verification results, merged commit, deployment identifiers, timestamps, and switch state without secrets or PII. Confirm the firewall is removed, legacy schedules are zero, the synthetic fixture is cleaned, callbacks are healthy, and the campaign cohort contains only eligible post-cutover contacts.

## Completion criteria

- One reviewed and green pull request contains only the approved hard-cutover scope.
- All imported Resend contacts have durable legacy exclusion markers.
- All outstanding legacy scheduled messages are cancelled and reconciled before their safety deadline.
- Production forms write only to Neon and never execute the removed legacy side effects.
- Whitepaper fulfillment works exactly once through Dawn and Resend.
- Webhook, signed unsubscribe, founder stop, and Google reply paths durably suppress later campaign steps.
- Campaign enrollment begins at the immutable reopen timestamp and excludes all imported contacts.
- Neon contains the operational and reporting trail needed for the next enrichment/reporting arc.
