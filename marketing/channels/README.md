# @ngaf/marketing-channels

Channel adapters for the Cacheplane marketing pipeline. One adapter per channel, all behind a single `ChannelAdapter` interface.

## Implemented

- **X** (`getAdapter('x')`) — post single tweets, threads, and image media (PNG ≤ 5MB, alt text required). `metrics()` is a stub until the X tier upgrades to Basic+.

## Planned (follow-up commits in this package — no separate spec)

- Dev.to — next
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
