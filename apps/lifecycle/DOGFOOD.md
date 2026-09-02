# Lifecycle preview dogfood harness

This harness performs the provider-free subset of the lifecycle preview gate.
It creates one closed growth fixture, probes the deployed Dawn surface, and
removes only the exact growth and Dawn selectors from the private manifest.
Keep delivery, campaign enrollment, and campaign execution disabled throughout
the run.

The operator must prepare a private JSON manifest matching the schema in
`scripts/dogfood-harness.mts`. Do not commit, paste, or log that file. It holds
exact synthetic UUID, event-key, idempotency-key, and Dawn thread selectors.
Both `expected_count` values are positive and fixed before setup: growth is
exactly four records and Dawn equals the four closed thread selectors.

Set these values only in the invoking shell:

- `DATABASE_URL`
- `LIFECYCLE_DOGFOOD_INSTANCE_A_ORIGIN`
- `LIFECYCLE_DOGFOOD_INSTANCE_B_ORIGIN`
- `LIFECYCLE_SERVICE_SECRET`

The lifecycle origins must be canonical bare HTTPS origins with no trailing
slash, credentials, path, query, or fragment. The manifest names each exact
Vercel deployment through its `dpl_...` deployment ID. After bearer
authentication, each deployment's `/healthz` response must return its own
Vercel-provided `VERCEL_DEPLOYMENT_ID` in the
`x-threadplane-deployment-id` header. The harness refuses to probe or delete
Dawn state unless both values match the manifest.

The manifest also contains the exact database sentinel
`threadplane:growth-target:<Vercel store id>`. Provision that value as the
target database's database comment. Before growth work, the harness reads it
with `shobj_description(oid, 'pg_database')` for `current_database()` and
requires an exact match. No URL-derived identifier or operator-supplied target
label is accepted.

Run the phases separately and stop on any nonzero exit:

```bash
npx nx run lifecycle:dogfood -- setup --manifest /absolute/private/manifest.json
npx nx run lifecycle:dogfood -- probe --manifest /absolute/private/manifest.json
npx nx run lifecycle:dogfood -- cleanup --manifest /absolute/private/manifest.json
```

Output contains only aliases, bounded counts, closed status values, and the
health response body hash. It never emits URLs, credentials, connection
strings, fixture selectors, provider identifiers, raw response bodies, or raw
error messages. Setup refuses a nonempty fixture preflight. Cleanup preflights
both stores before either is mutated, then deletes growth dependents before
owners. Every Dawn dispatch includes the exact fixture marker in persisted
state. Cleanup reads `/threads/:id/state` and validates that marker before using
Dawn's exact `DELETE /threads/:id` route. A retry can clean the remaining one to
four positively marked threads after a partial deletion; wrong or unmarked
state is never deleted. A fresh instance-B read must return zero fixtures.

The v1 harness deliberately reports mailbox recovery/resume and true
AbortSignal propagation as `BLOCKED`. The current app has no deterministic,
provider-free recovery completion fixture and no safe long-running route seam.
An idle cancel-route check is not represented as abort evidence.

## Disposable rollback integration test

The transaction rollback regression is isolated from the normal lifecycle test
target and is skipped unless `LIFECYCLE_DOGFOOD_ROLLBACK_INTEGRATION` is exactly
`true`. Point `TEST_DATABASE_URL` only at the explicitly disposable, migrated
test database; never use either preview growth or Dawn storage. Set
`LIFECYCLE_DOGFOOD_TEST_DATABASE_SENTINEL` to the exact database comment
sentinel provisioned on that disposable database. It must use the distinct
test-only namespace `threadplane:growth-test-target:<resource id>`. The test
verifies that database-owned value before attempting any temporary DDL. Then
run:

```bash
npx nx run lifecycle:test-dogfood-integration
```

The test installs uniquely named temporary trigger/function DDL. The trigger
adds a fifth exact fixture row during setup, forcing the postflight check to
throw. The test then verifies that the setup transaction left zero exact
fixture rows. A second trigger forces destructive cleanup postflight to fail
after deletion; the test verifies that rollback preserved all four original
rows. Teardown drops only DDL whose installation was attempted after the
database identity check, then safely removes the exact fixture.
