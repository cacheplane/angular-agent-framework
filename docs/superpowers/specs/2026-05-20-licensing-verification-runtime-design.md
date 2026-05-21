# PR C — Licensing Verification Runtime + Minting Deploy

**Status:** Design approved, ready for implementation plan.
**Owner:** apps/minting-service (deploy wiring) + libs/licensing (one bug fix) + .github/workflows (secret injection + deploy step) + docs.
**Affects:** CI workflows, Vercel deploy config, `libs/licensing/src/lib/run-license-check.ts`, `libs/chat/README.md` (one doc section), one example wiring.

## Goal

Close the loop on the `@ngaf/chat` relicense: get the production public key into the published bundle, deploy the existing minting service so it actually receives Stripe webhooks and emails license tokens, fix a known idempotency bug in `runLicenseCheck`, document the `provideChat({ license })` convention, and exercise the verify path through one example app so it's part of routine CI.

This is **mostly an operational PR**. The crypto is already there. The minting code is already there. The keys exist. We're just wiring them.

## Decisions locked from brainstorm + investigation

| Topic | Decision |
|---|---|
| Enforcement policy | **Advisory only** — console.warn on missing/expired/tampered/mismatched. No nag UI. No render-blocking. Same as today. |
| `LicenseClaims` schema | **Unchanged.** `{ sub, tier, iat, exp, seats }`. Origin allowlist deferred to a future PR. |
| Token source at runtime | **`ChatConfig.license` only.** No env-var fallback. Documented convention; buyer pastes the token into their app config. |
| Public key in published bundle | **Wire existing GH secret `CACHEPLANE_LICENSE_PUBLIC_KEY` into `publish.yml`** so the prebuild script bakes it in. |
| Private signing key | **Already on Vercel project `threadplane-minting-service`** as `LICENSE_SIGNING_PRIVATE_KEY_HEX`. Confirmed via Vercel API. |
| Minting service deploy | **Add to `.github/workflows/ci.yml`** (parallel to website/cockpit deploys). Needs new GH secret `VERCEL_MINTING_PROJECT_ID = prj_3x6SBua2bmAk374uFrp0MdqZSe9u`. |
| Prod domain for minting | **`minting.threadplane.ai`** assigned in Vercel UI (one-time manual). |
| `runLicenseCheck` idempotency bug | **Fix.** Currently second call with no token short-circuits to `'licensed'`. |
| Smoke testing | **Use `examples/chat/angular/` (local `demo.threadplane.ai` source)** with temporary license-string injection. **All injections reverted before commit; demo stays unlicensed in main.** |

## Out of scope

- Pricing page changes (PR B already landed).
- Stripe Checkout wiring (PR B-Stripe).
- Origin allowlist / appId / claims schema changes.
- Nag UI / banner component / license-state signal exposed to consumers.
- Token revocation, renewal, or grace-period UX.
- Rotating the dev fixture public key.
- Minting service code changes beyond what's necessary to make CI deploy succeed.

## File map

- **Modify:** `.github/workflows/publish.yml` — add `env: CACHEPLANE_LICENSE_PUBLIC_KEY` to the build step that runs `nx build licensing` so `generate-public-key.mjs` picks up the prod key.
- **Modify:** `.github/workflows/ci.yml` — add a `minting-deploy` job (parallel to existing website/cockpit deploys) gated on `github.ref == 'refs/heads/main'`. Uses `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and the new `VERCEL_MINTING_PROJECT_ID` secret.
- **Add GH secret (operational, not code):** `VERCEL_MINTING_PROJECT_ID = prj_3x6SBua2bmAk374uFrp0MdqZSe9u`.
- **Vercel UI (operational, not code):** assign `minting.threadplane.ai` to the `threadplane-minting-service` project; add `STRIPE_WEBHOOK_SECRET` env var (production + preview). The other 19 env vars are already set.
- **Modify:** `libs/licensing/src/lib/run-license-check.ts` — fix the idempotency bug. On a second call with the same `(packageName, token, publicKey)` triple, return the *cached actual status*, not the literal `'licensed'`.
- **Add:** `libs/licensing/src/lib/run-license-check.spec.ts` (or extend existing spec) — regression test for the idempotency fix.
- **Modify:** `libs/chat/README.md` — add a short "Using a commercial license" section showing the `provideChat({ license: '...' })` snippet and pointing to the pricing page for tokens.
- **Modify:** *one example app's* `app.config.ts` to read a license string from a Vite build-time define and pass it to `provideChat({ license })`. Likely `examples/chat/angular/` since that's already where smoke-testing happens. The token is set via env (`NGAF_LICENSE_TOKEN`) at build time; if unset, `license: undefined` is passed and behavior is identical to today. This means the verify path is *runnable* in CI smoke when we choose to set the env, but the example doesn't *require* a license to run.

No changes to `libs/chat` source code, `@ngaf/render`, `@ngaf/agent`, `@ngaf/langgraph`, `@ngaf/ag-ui`, `@ngaf/a2ui`, `@ngaf/telemetry`, `@ngaf/design-tokens`, the website's pricing page, or any cockpit demo.

## The idempotency bug

Investigation found (`libs/licensing/src/lib/run-license-check.ts` — current behavior):

> The idempotency guard has a bug: if called the second time with no token, it short-circuits and returns `'licensed'` regardless.

The cause: the dedup `Set` keyed by `package|status` only fires the warn once, but the function's *return value* falls through to `'licensed'` on the cached-path branch. The fix is to cache the computed `LicenseStatus` on the dedup record itself and return *that*, not the constant `'licensed'`.

Test must assert: with no token, a single call returns `'missing'` (or `'noncommercial'` per `inferNoncommercial`) — and a second call with the same args returns the *same value*, not `'licensed'`.

## CI workflow changes

### `publish.yml` — public-key injection

Find the step that runs `nx build licensing` (or `nx run-many ... build ... licensing`) and add:

```yaml
      env:
        CACHEPLANE_LICENSE_PUBLIC_KEY: ${{ secrets.CACHEPLANE_LICENSE_PUBLIC_KEY }}
```

The existing `libs/licensing/scripts/generate-public-key.mjs` already reads this env var; no script change needed.

### `ci.yml` — minting deploy job

Add a new job mirroring the website's deploy job pattern (whichever pattern that uses — likely `vercel pull` + `vercel build` + `vercel deploy --prebuilt --prod`). The deploy job:

- Triggers only on push to `main` (not on PR builds).
- Uses `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and the new `VERCEL_MINTING_PROJECT_ID`.
- Targets `apps/minting-service/`.
- Runs after the `library` and `cockpit` jobs pass (`needs:`).

The minting service's `vercel.json` already has `"rootDirectory": "apps/minting-service"` and Vercel knows what to do; we just need the workflow to invoke `vercel deploy` against the right project.

## End-to-end smoke test runbook (post-merge, operational, no code committed)

This is the combined PR-B-Stripe + PR-C smoke. **Every temporary code change made during this runbook is reverted before the session ends.** The chat demo stays unlicensed in main.

### Prep

- Stripe test mode enabled; `STRIPE_SECRET_KEY=sk_test_...` set in local `apps/website/.env.local`.
- Minting service deployed and reachable at its preview URL (or `minting.threadplane.ai` if domain is live).
- Stripe Dashboard webhook → minting service `/api/stripe-webhook` configured for test mode.
- Local terminal in worktree root.

### Step 1 — Full Stripe → mint → email loop

- [ ] `node scripts/stripe/sync-products.ts` (test mode). Confirm 3 prices created/updated.
- [ ] Boot `apps/website` dev server. Open `/pricing` in Chrome MCP (`mcp__Claude_Preview__preview_start` → `mcp__Claude_in_Chrome__navigate`).
- [ ] Click "Buy indie license" → complete Checkout with `4242 4242 4242 4242`.
- [ ] Wait ~30 seconds. Check the test email inbox (`EMAIL_FROM` recipient) for a license-token email. Copy the token.
- [ ] (If using `stripe trigger` CLI: optionally trigger `customer.subscription.deleted` for revocation behavior — but with one-time payments, this is N/A. Skip.)

### Step 2 — Verify the token in the chat demo (temporary, reverted)

- [ ] Open `examples/chat/angular/src/app/app.config.ts`. Find the `provideChat({...})` call.
- [ ] **Temporarily** add `license: '<token-from-email>'` to the config. Note the file in your git status so you remember to revert.
- [ ] `npx nx serve examples-chat-angular`. Open `http://localhost:4400` in Chrome MCP.
- [ ] Inspect the browser console. With a valid license: **no warnings**. With no license: console.warn line about advisory mode.
- [ ] **Revert.** `git checkout -- examples/chat/angular/src/app/app.config.ts`. Confirm `git diff` is empty for that file before committing anything else.

### Step 3 — Verify error states (each one temporary, reverted)

For each state, edit the demo `app.config.ts`, observe console, revert.

- [ ] **Tampered:** chop one character off the token. Expected console: warn with `status: 'tampered'`.
- [ ] **Expired:** mint a token via the minting service with `exp` in the past (use a Node REPL + `signLicense()` from `@ngaf/licensing`). Expected console: warn with `status: 'expired'`. **Within the 14-day grace window:** `status: 'grace'`.
- [ ] **Wrong key:** use a token signed with a different keypair (e.g., test keypair from `libs/licensing/src/lib/testing/keypair.ts`). Expected console: warn with `status: 'tampered'` (verify fails before claim parsing).
- [ ] **Missing license + noncommercial detection:** remove the license entry entirely. If `NODE_ENV !== 'production'`, expected `status: 'noncommercial'`; in a production build, expected `status: 'missing'`.

After each test, `git diff examples/chat/angular/` MUST be empty.

### Step 4 — Confirm published bundle picks up prod key (verify before publish)

- [ ] On a clean checkout of `main` after this PR lands, run `npx nx build chat`. Read `dist/libs/licensing/fesm2022/*.mjs` (or the equivalent .js) and grep for the public-key hex. Confirm it's the prod hex from the GH secret, **not** the dev fixture `793132582f3d39dcd46cc6fd010c6c4b10f1225132e7de71fbcb45788ea5afde`.
- [ ] (Optional, future) Wire this check into CI as a guard step that fails the publish if the bundled key matches the dev fixture.

### Step 5 — Final scrub

- [ ] `git status` in worktree shows no untracked changes in `examples/chat/`, `apps/website/`, `libs/chat/`, or `libs/licensing/`.
- [ ] Smoke test successful → close the loop with a short report in the PR description.

## Acceptance criteria

1. `publish.yml` includes `CACHEPLANE_LICENSE_PUBLIC_KEY` in the env for the licensing build step.
2. `ci.yml` includes a `minting-deploy` job that runs only on push to `main` and deploys the `threadplane-minting-service` Vercel project.
3. GH secret `VERCEL_MINTING_PROJECT_ID` is set (operational, not in code; confirm with `gh secret list`).
4. `libs/licensing/src/lib/run-license-check.ts` returns the cached `LicenseStatus`, not the constant `'licensed'`, on repeat calls. Unit test asserts this for the no-token path.
5. `libs/chat/README.md` has a "Using a commercial license" section with a `provideChat({ license: '...' })` snippet.
6. `examples/chat/angular/src/app/app.config.ts` reads `NGAF_LICENSE_TOKEN` from a build-time define and passes it through `provideChat({ license })`. When unset, the demo behaves identically to today.
7. `npx nx run-many -t lint,test,build --projects=licensing,chat` passes.
8. Smoke test runbook (above) was executed once and reported in the PR description with screenshots/console captures. **All temporary code changes are reverted; `git status` is clean on the demo files at PR open.**

## Risks

- **Public-key/private-key mismatch.** The GH secret was set 2026-04-30; the Vercel private key was set in roughly the same window. Likely match, but unverifiable from secrets alone. Mitigation: do an explicit derive-from-private check during the smoke test runbook (Vercel CLI `env pull` → derive public via `@noble/ed25519` → compare to GH secret value pasted in by hand).
- **Demo pollution.** The smoke test runbook explicitly calls out revert-before-commit on every step. The minting flow itself doesn't touch the demo; only manual config edits do.
- **Minting service unhealthy after deploy.** If env vars are missing or the Resend key has expired, tokens won't be emailed. Mitigation: the existing `/api/health` endpoint should be hit immediately after first deploy.
- **publish.yml change is silent.** If `CACHEPLANE_LICENSE_PUBLIC_KEY` happens to be empty (secret accidentally cleared), the prebuild falls back to the dev fixture silently. Optional follow-up: add the CI guard mentioned in smoke step 4.
- **No example wiring change visible to demo users.** Setting `NGAF_LICENSE_TOKEN` at build time is a CI/maintainer concern; demo viewers won't see any behavior change.
