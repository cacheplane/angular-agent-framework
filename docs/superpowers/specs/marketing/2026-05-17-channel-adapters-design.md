---
workstream: channel-adapters
status: approved
owner: brian
phase: 1
spec: docs/superpowers/specs/marketing/2026-05-17-channel-adapters-design.md
plan: docs/superpowers/plans/marketing/2026-05-17-channel-adapters.md
parent: docs/superpowers/specs/marketing/2026-05-17-marketing-meta-design.md
---

# Channel Adapters (Design)

> Sub-spec 2 of the marketing umbrella. Replace the `@ngaf/marketing-channels` skeleton with a real X adapter, full validation, dry-run mode, and an OAuth 2.0 bootstrapper CLI. LinkedIn, Dev.to, and Reddit land as follow-up commits against the same package — no re-spec required.

## 1. Goal

Ship a production-ready X adapter behind the `ChannelAdapter` interface defined in the marketing-meta. The adapter handles validation, auth (OAuth 2.0 User Context with PKCE), media upload, threading, dry-run, and an automatic access-token refresh path. Stub `metrics()` since the team's X tier has no read endpoints; the stub becomes real when the tier upgrades.

This sub-spec also lays the floor for the other three adapters: a shared `validation.ts`, `http.ts`, and `registry.ts` that any new adapter reuses.

## 2. Context

- Parent: `docs/superpowers/specs/marketing/2026-05-17-marketing-meta-design.md`. The meta defines the `Draft`, `PostResult`, `PostMetrics`, and `ChannelAdapter` interfaces.
- Existing skeleton: `marketing/channels/src/index.ts` currently exports the types + a `getAdapter()` that throws. This sub-spec replaces it with real implementations.
- X API state (verified May 2026):
  - Media upload is `POST https://api.x.com/2/media/upload` (v2), **not** the v1.1 `upload.twitter.com` endpoint. The v1.1 endpoint is deprecated.
  - Auth is OAuth 2.0 User Context with PKCE for both `/2/tweets` and `/2/media/upload`. Required scopes: `tweet.read tweet.write users.read offline.access media.write`.
  - "Free tier" no longer exists for new developers (Feb 2026 change). Pay-per-use is the default; legacy Basic/Pro tiers continue for existing subscribers. Free has write but no read; Basic adds read.
  - Brian's account: write access only; `metrics()` is a stub.

## 3. Scope

**In scope:**

- Real implementation of `XAdapter` (replaces the skeleton).
- Shared infra used by every future adapter:
  - `validation.ts` — channel-aware `validateDraft(draft)` with hard-reject behavior.
  - `http.ts` — `fetch` wrapper with timeout (default 20s), retry on 5xx (max 2, exp backoff: 500ms, 1500ms), and a 401-refresh hook the adapter wires up.
  - `registry.ts` — `getAdapter(id)` resolves from a static map; unknown id throws with the list of available adapters.
  - `dry-run.ts` — `writeDryRunResult(draft)` writes to `marketing/cowork/outbox/dry-runs/<id>.json`, returns synthetic `PostResult`.
  - `types.ts` — `Draft`, `PostResult`, `PostMetrics`, `ChannelAdapter`, `ChannelId` (moved out of `index.ts`).
- X adapter pieces:
  - `x/auth.ts` — token state, `getAccessToken()` (refreshes on demand), `refreshAccessToken()`.
  - `x/auth-cli.ts` — `marketing channels x auth` one-time bootstrapper. Opens browser, listens on `localhost:8723/callback`, exchanges code for tokens, prints them with copy-paste instructions.
  - `x/media.ts` — `uploadMedia(png, alt)` → returns `media_id`. Single multipart request to `/2/media/upload`. PNG only (≤ 5MB). Sets `alt_text` via `POST /2/media/metadata` immediately after upload.
  - `x/post.ts` — single-tweet path + thread path. Composes the body for `POST /2/tweets`. Returns `PostResult`.
  - `x/index.ts` — `XAdapter` class implementing `ChannelAdapter`. Constructed eagerly in `registry.ts` (env vars read at construction; missing vars throw with the list of missing names).
- `marketing/channels/MANUAL-SMOKE.md` — 5-step recipe for a live post-and-delete.
- `marketing/channels/README.md` — what channels exist, how to add one, how to bootstrap auth, dry-run mode.
- `marketing/.env.example` updated to replace the X OAuth 1.0a placeholder set with the OAuth 2.0 + PKCE set.
- `package.json` script: `"marketing:channels:x:auth": "tsx marketing/channels/src/x/auth-cli.ts"`.
- Unit tests with `msw/node` covering every path documented in §6.

**Out of scope (deferred to follow-up commits against this same package — no re-spec):**

- LinkedIn adapter — `src/linkedin/{index,auth,post}.ts`. LinkedIn Marketing Developer Platform app, OAuth 2.0. Lands next after X.
- Dev.to adapter — `src/devto/{index,post}.ts`. Single API key, no OAuth. **Land second after X** (per user direction).
- Reddit adapter — `src/reddit/{index,auth,post}.ts`. Script-app password grant. Lands last.
- Real X metrics — when tier upgrades to Basic+.
- Posting from CI / cron — cowork-loop sub-spec.
- Media types other than PNG (e.g., MP4, animated GIF) — defer until a post actually needs one.

## 4. Architecture

```
marketing/channels/
├── README.md                 # NEW: package charter
├── MANUAL-SMOKE.md           # NEW: live smoke recipe
├── package.json              # add tsx + msw deps; new script
├── project.json              # add test target
├── tsconfig.json             # unchanged
├── tsconfig.lib.json         # unchanged
├── vite.config.mts           # NEW: vitest config (jsdom not needed; node env)
└── src/
    ├── index.ts              # CHANGED: re-exports from types + registry
    ├── types.ts              # NEW: Draft, PostResult, PostMetrics, ChannelAdapter, ChannelId
    ├── registry.ts           # NEW: getAdapter(id) + adapter map
    ├── validation.ts         # NEW: validateDraft(draft)
    ├── validation.spec.ts    # NEW
    ├── http.ts               # NEW: fetch wrapper
    ├── http.spec.ts          # NEW
    ├── dry-run.ts            # NEW: writeDryRunResult(draft)
    ├── dry-run.spec.ts       # NEW
    └── x/
        ├── index.ts          # NEW: XAdapter class
        ├── auth.ts           # NEW
        ├── auth.spec.ts      # NEW
        ├── auth-cli.ts       # NEW (executable, not exported)
        ├── post.ts           # NEW
        ├── post.spec.ts      # NEW
        └── media.ts          # NEW
```

Component responsibilities:

| File | Responsibility | Depends on |
|------|----------------|------------|
| `types.ts` | Sole source of truth for all public types | — |
| `validation.ts` | Channel-aware draft validation; throws on failure | `types.ts` |
| `http.ts` | Generic HTTP wrapper with retry + 401-hook | — |
| `dry-run.ts` | Writes synthetic results to outbox | `types.ts` |
| `registry.ts` | Eager adapter instantiation; lookup by id | adapter classes |
| `x/auth.ts` | Token state machine; refresh logic | `http.ts` |
| `x/auth-cli.ts` | One-time OAuth dance bootstrapper | nothing exported from package |
| `x/media.ts` | Upload PNG + set alt text | `x/auth.ts`, `http.ts` |
| `x/post.ts` | Compose `/2/tweets` request(s) for single + thread | `x/auth.ts`, `x/media.ts`, `http.ts` |
| `x/index.ts` | `XAdapter` orchestrates validate → media → post + dry-run gate | everything above |

## 5. Public API (what consumers import)

```ts
// index.ts exports
export type { Draft, PostResult, PostMetrics, ChannelAdapter, ChannelId } from './types';
export { validateDraft, ValidationError } from './validation';
export { getAdapter } from './registry';
```

Nothing else is exported. Internal modules (`http.ts`, `dry-run.ts`, `x/*`) are package-private — consumers go through `getAdapter('x')`.

`XAdapter`, `LinkedInAdapter`, etc. are NOT exported by class. The registry is the only construction path.

## 6. X adapter contract

### 6.1 `validateDraft(draft)` — rejection rules

Hard reject (throws `ValidationError`) when:

1. `draft.channel !== 'x'` when passed to the X adapter — sanity check.
2. Both `text` and `threadParts` set, or neither set.
3. `text` (if set) length > 280 characters (Unicode code-point count, not byte count).
4. Any `threadParts[i]` length > 280 characters.
5. `threadParts.length < 2` (a single-part "thread" is just `text`; force the caller to use the right field).
6. `media.length > 4`.
7. Any `media[i].alt` empty or > 1000 characters.
8. Any `media[i].png` size > 5 MB.

### 6.2 `post(draft)` — happy path

1. `validateDraft(draft)` first.
2. If `process.env.DRY_RUN === '1'`:
   - `writeDryRunResult(draft)` → returns synthetic `PostResult`.
   - No HTTP. No token state touched.
   - Return immediately.
3. If `draft.media?.length`:
   - For each media item: `uploadMedia(png, alt)` → `media_id`. Sequential (X has rate limits; parallel buys nothing for ≤4 items).
4. Compose request body:
   - Single tweet: `{ text: draft.text, media: { media_ids: [...] } | undefined }`
   - Thread: post tweet 0 with text=`threadParts[0]` and any media; capture returned `id`. For `i ≥ 1`: post `{ text: threadParts[i], reply: { in_reply_to_tweet_id: <previous-id> } }`. No media on continuation parts.
5. POST `https://api.x.com/2/tweets` with `Authorization: Bearer <access_token>` and JSON body.
6. Return:
   ```ts
   {
     channel: 'x',
     postId: <first-tweet-id>,
     url: `https://x.com/${process.env.X_USER_HANDLE}/status/${postId}`,
     postedAt: <ISO string from response or new Date().toISOString()>
   }
   ```

### 6.3 `metrics(postId)` — Free-tier stub

```ts
async metrics(postId: string): Promise<PostMetrics> {
  return { postId, fetchedAt: new Date().toISOString() };
}
```

Adds a comment in the source pointing at this section so the next implementer knows where to wire in `/2/tweets/:id?tweet.fields=public_metrics` when the tier upgrades.

### 6.4 Auth state machine

In-memory state (per `XAdapter` instance, eagerly constructed at first `getAdapter('x')` call):

```ts
{
  clientId: process.env.X_CLIENT_ID,
  clientSecret: process.env.X_CLIENT_SECRET,
  accessToken: process.env.X_ACCESS_TOKEN,
  refreshToken: process.env.X_REFRESH_TOKEN,
  userHandle: process.env.X_USER_HANDLE,
}
```

If any of the five are missing at construction, throw with the list of missing names.

**On 401 from any X endpoint:**

1. `http.ts` calls the registered refresh hook.
2. Refresh hook POSTs `https://api.x.com/2/oauth2/token` with `grant_type=refresh_token`, the refresh token, and HTTP Basic auth (`clientId:clientSecret`).
3. On success: in-memory `accessToken` and `refreshToken` updated. The new refresh token is **printed to stderr** so Brian can update `.env` for the next process restart. (We don't write `.env` from code — bad-citizen behavior.)
4. Original request retried once with the new token.
5. On refresh failure: throw `Error('X access token expired and refresh failed — re-run \`pnpm marketing:channels:x:auth\`')`.

### 6.5 Auth bootstrapper CLI (`x/auth-cli.ts`)

Run via `pnpm marketing:channels:x:auth`. Behavior:

1. Read `X_CLIENT_ID` and `X_CLIENT_SECRET` from env. If missing, print the X developer-portal URL and instructions for creating a v2 app, then exit 1.
2. Generate PKCE `code_verifier` + `code_challenge` (S256).
3. Print + `open` (cross-platform via `child_process.exec('open' | 'xdg-open' | 'start')`) the authorize URL:
   ```
   https://x.com/i/oauth2/authorize?
     response_type=code&
     client_id={clientId}&
     redirect_uri=http://localhost:8723/callback&
     scope=tweet.read tweet.write users.read offline.access media.write&
     state={random}&
     code_challenge={challenge}&
     code_challenge_method=S256
   ```
4. Start an HTTP server on `localhost:8723`. On `/callback?code=...&state=...`:
   - Verify state matches.
   - POST `/2/oauth2/token` with `grant_type=authorization_code`, code, code_verifier, redirect_uri, HTTP Basic.
   - Print:
     ```
     ✓ Got tokens. Add these to .env:
     
     X_ACCESS_TOKEN=<access>
     X_REFRESH_TOKEN=<refresh>
     X_USER_HANDLE=<handle from /2/users/me>
     ```
   - Send a 200 "You can close this tab" HTML response.
   - Stop the server. Exit 0.
5. Timeout of 5 minutes; exit 1 with message.

## 7. Validation infrastructure (shared with future adapters)

`validation.ts` exports `validateDraft(draft: Draft, opts?: { adapterId?: ChannelId })`. Switches on `draft.channel` to apply channel-specific rules. Initial rules:

- `'x'`: per §6.1.
- `'linkedin'`, `'devto'`, `'reddit'`: thrown error message says "adapter not yet implemented" until each adapter ships.

Per-channel rules live in `validation.ts` (not split into per-channel files) until the file grows past ~150 lines. Then split.

`ValidationError` is a `class extends Error` with a `field?: string` and `rule: string` for programmatic handling.

## 8. HTTP wrapper

`http.ts` exports:

```ts
export interface HttpOpts {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  url: string;
  headers?: Record<string, string>;
  body?: BodyInit;
  timeoutMs?: number;            // default 20000
  retryOn5xx?: boolean;          // default true
  on401?: () => Promise<{ retry: true } | { retry: false }>;
}

export async function http<T>(opts: HttpOpts): Promise<T>;
```

Behavior:

- `AbortController` timeout.
- On 5xx + `retryOn5xx`: exponential backoff (500ms, 1500ms), max 2 retries.
- On 401 + `on401`: call hook; if it returns `{ retry: true }`, retry the original request once (no further retries on the retried request).
- Parses JSON response. On non-JSON, throws.
- On non-2xx after retries, throws with response body in the message.

## 9. Dry-run

`dry-run.ts`:

```ts
export async function writeDryRunResult(draft: Draft): Promise<PostResult> {
  const id = `dry-${crypto.randomUUID()}`;
  const outDir = path.join(process.cwd(), 'marketing', 'cowork', 'outbox', 'dry-runs');
  await fs.promises.mkdir(outDir, { recursive: true });
  const file = path.join(outDir, `${id}.json`);
  await fs.promises.writeFile(file, JSON.stringify({ draft, simulatedAt: new Date().toISOString() }, null, 2));
  return {
    channel: draft.channel,
    postId: id,
    url: `https://dry-run.local/${draft.channel}/${id}`,
    postedAt: new Date().toISOString(),
  };
}
```

`.gitkeep` lives at `marketing/cowork/outbox/dry-runs/.gitkeep`.

## 10. Testing

### 10.1 Unit tests (msw)

- `validation.spec.ts` — one test per §6.1 rule (8 tests). Each asserts `validateDraft` throws and the error has the expected `rule` and `field`.
- `http.spec.ts` — timeout, 5xx retry succeeds, 5xx retry exhausts, 401 hook returns retry, 401 hook returns no-retry (throws), non-JSON response throws.
- `dry-run.spec.ts` — given a valid draft, writes a file at the right path, returns a `PostResult` with `dry-` prefix.
- `x/auth.spec.ts` — refresh succeeds (token updated, new refresh token printed to stderr), refresh fails (throws with bootstrapper message), missing env throws at construction.
- `x/post.spec.ts` — single tweet with no media, single tweet with 1 media (verifies media upload happens first and `media_ids` are in body), thread with 3 parts (verifies `reply.in_reply_to_tweet_id` chain), thread with media on part 0 only, dry-run path (no HTTP).
- Optional coverage: registry returns same instance on repeated calls.

Target ≥ 90% line coverage on `validation.ts` and `x/post.ts`.

### 10.2 Manual smoke (documented, not automated)

`marketing/channels/MANUAL-SMOKE.md`:

```
# X adapter — manual smoke

After running `pnpm marketing:channels:x:auth` and pasting tokens into .env:

1. From repo root: `DRY_RUN=1 npx tsx marketing/channels/scripts/smoke.ts`
   → expect a JSON file under marketing/cowork/outbox/dry-runs/

2. Drop DRY_RUN, run again. A real test post lands on @<handle>.
   → expect a URL printed; visit it.

3. Delete the test post from the X UI.

4. Variant: change the smoke script to attach a 1×1 transparent PNG. Re-run.
   → expect the post to have a media attachment.

5. Variant: change the smoke script to send threadParts of length 2. Re-run.
   → expect two tweets posted with the second replying to the first.

If any step fails, capture the error message + the response body before deleting the test post.
```

`marketing/channels/scripts/smoke.ts` is a small standalone file (NOT exported by the package) that imports `getAdapter('x')` and calls `.post()` with a hardcoded draft. Useful for the manual recipe.

## 11. Risks + non-goals

| # | Risk | Mitigation |
|--:|------|------------|
| 1 | X's v2 media upload still has stability issues (403s reported May 2026) | The adapter throws clearly when media upload fails; recipe to fall back to text-only post. If the issue persists, drop media support and rely on link previews. |
| 2 | OAuth refresh tokens rotate on use; if the process crashes between refresh and `.env` update, the next run fails | Refresh hook prints the new token to stderr immediately so Brian can update `.env` before the next invocation. CI is expected to source tokens from secrets, not `.env`. |
| 3 | Rate limits hit during manual smoke | The smoke recipe explicitly says "delete the test post"; rate limits at this volume are not a real concern. |
| 4 | Adapter constructed eagerly means missing env var throws at app startup, not at `post()` call | Acceptable. We want loud, early failures. |
| 5 | `validation.ts` central file grows unwieldy as adapters land | Threshold: when it exceeds ~150 lines, split per-channel into `validation/{x,linkedin,devto,reddit}.ts`. Not done here. |

**Non-goals (v1):**

- Posting from CI. The cowork-loop sub-spec handles that.
- Auto-generating media. The assets sub-spec produces media; this adapter consumes pre-rendered PNGs.
- Scheduled posting via X's native scheduler (X v2 doesn't expose it; we'd schedule client-side).
- Multi-account support. One Cacheplane account only.

## 12. Phases

1. **Phase 0 — Shared infra.** `types.ts`, `validation.ts`, `http.ts`, `dry-run.ts`, `registry.ts`. TDD; tests use msw where HTTP is involved. ~6-8 commits.
2. **Phase 1 — X auth.** `x/auth.ts`, `x/auth-cli.ts`. Auth dance + refresh path. ~3-4 commits.
3. **Phase 2 — X media.** `x/media.ts`. ~2 commits.
4. **Phase 3 — X post.** `x/post.ts`, `x/index.ts`. Single + thread + media composition. ~3-4 commits.
5. **Phase 4 — Docs + env example + manual smoke.** `README.md`, `MANUAL-SMOKE.md`, `.env.example`, `scripts/smoke.ts`. ~2 commits.
6. **Phase 5 — Verification.** Run unit tests; Brian runs the manual smoke. No commit.

Total: ~17-21 commits.

## 13. Deliverables

- ☐ `marketing/channels/src/types.ts`
- ☐ `marketing/channels/src/validation.ts` + spec
- ☐ `marketing/channels/src/http.ts` + spec
- ☐ `marketing/channels/src/dry-run.ts` + spec
- ☐ `marketing/channels/src/registry.ts`
- ☐ `marketing/channels/src/x/auth.ts` + spec
- ☐ `marketing/channels/src/x/auth-cli.ts`
- ☐ `marketing/channels/src/x/media.ts`
- ☐ `marketing/channels/src/x/post.ts` + spec
- ☐ `marketing/channels/src/x/index.ts`
- ☐ `marketing/channels/src/index.ts` rewritten as re-exports
- ☐ `marketing/channels/scripts/smoke.ts`
- ☐ `marketing/channels/vite.config.mts` (vitest)
- ☐ `marketing/channels/project.json` test target
- ☐ `marketing/channels/MANUAL-SMOKE.md`
- ☐ `marketing/channels/README.md`
- ☐ `marketing/.env.example` updated to OAuth 2.0 vars
- ☐ Root `package.json` script: `marketing:channels:x:auth`
- ☐ `marketing/cowork/outbox/dry-runs/.gitkeep`
- ☐ `nx run marketing-channels:build` green
- ☐ `nx run marketing-channels:test` green; ≥ 90% line coverage on `validation.ts` and `x/post.ts`
- ☐ Manual smoke run by Brian; results captured in PR description

## 14. References

- Parent: `docs/superpowers/specs/marketing/2026-05-17-marketing-meta-design.md`
- X v2 media upload announcement: `https://devcommunity.x.com/t/announcing-media-upload-endpoints-in-the-x-api-v2/234175`
- X API pricing 2026: `https://postproxy.dev/blog/x-api-pricing-2026/`
- X OAuth 2.0 tutorial: `https://zernio.com/blog/x-api`
