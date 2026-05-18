# @ngaf/marketing-channels

Channel adapters for the Cacheplane marketing pipeline. One adapter per channel, all behind a single `ChannelAdapter` interface.

## Implemented

- **X** (`getAdapter('x')`) — post single tweets, threads, and image media (PNG ≤ 5MB, alt text required). `metrics()` is a stub until the X tier upgrades to Basic+.
- **Dev.to** (`getAdapter('devto')`) — post articles with title, tags, canonical URL, description. Real `metrics()` (Dev.to's read API is free).

## Planned (follow-up commits in this package — no separate spec)

- LinkedIn
- Reddit

## Quickstart

```ts
import { getAdapter } from '@ngaf/marketing-channels';

const x = getAdapter('x');
const result = await x.post({
  channel: 'x',
  text: 'Hello from Cacheplane.',
});
console.log(result.url);
```

## Auth (X)

X uses OAuth 2.0 User Context with PKCE. The first time you set it up, run the bootstrapper:

```bash
pnpm marketing:channels:x:auth
```

It opens your browser, you authorize the app, and it prints the tokens for you to paste into `.env`:

```
X_ACCESS_TOKEN=...
X_REFRESH_TOKEN=...
X_USER_HANDLE=brian
```

Prerequisites: create an X v2 app at <https://developer.x.com/en/portal/dashboard> and set the `X_CLIENT_ID` + `X_CLIENT_SECRET` env vars from the app's OAuth 2.0 section.

When an access token expires, the adapter automatically calls `/2/oauth2/token` to refresh and prints the new refresh token to stderr (X rotates refresh tokens on use; update your `.env` for the next process start).

## Auth (Dev.to)

Dev.to uses a single static API key.

1. Sign in to Dev.to.
2. **Settings** → **Extensions** → **DEV Community API Keys** → **Generate API Key**.
   Name it `cacheplane-marketing` (or anything you like).
3. Copy the key into `.env`:

   ```
   DEVTO_API_KEY=<paste>
   ```

4. Verify with a dry-run:

   ```bash
   DRY_RUN=1 pnpm marketing:channels:devto:smoke
   ```

### Tag rules (Dev.to)

Dev.to is strict about tags. The validator catches violations before the API call:

- Maximum 4 tags per post.
- Each tag: lowercase letters and digits only — `^[a-z0-9]+$`.
- No hyphens (`lang-graph` ✗), underscores (`lang_graph` ✗), or uppercase (`Angular` ✗).
- Each tag ≤ 30 chars.

## Dry-run

Set `DRY_RUN=1` and `post()` writes the draft to `marketing/cowork/outbox/dry-runs/<id>.json` instead of hitting any API. Safe for local development and CI.

```bash
DRY_RUN=1 npx tsx marketing/channels/scripts/smoke.ts
```

## Validation

All adapters call `validateDraft()` first. Drafts that violate per-channel rules throw `ValidationError` before any network call. X rules:

- Single tweet OR thread (mutually exclusive).
- Each tweet/part ≤ 280 code points.
- Threads have ≥ 2 parts.
- Up to 4 media items per post.
- PNG only, ≤ 5MB, alt text required (1-1000 chars).

## Adding a new adapter

1. Create `src/<channel>/{index,auth,post}.ts`.
2. Implement `ChannelAdapter`.
3. Add the per-channel rules to `validation.ts`.
4. Wire into `registry.ts:buildAdapter`.
5. Add an entry to this README.
6. Add env vars to `marketing/.env.example`.
7. Tests use `msw/node` to mock the channel's HTTP API.

## See also

- Spec: `docs/superpowers/specs/marketing/2026-05-17-channel-adapters-design.md`
- Meta: `docs/superpowers/specs/marketing/2026-05-17-marketing-meta-design.md`
- Manual smoke recipe: `MANUAL-SMOKE.md`
