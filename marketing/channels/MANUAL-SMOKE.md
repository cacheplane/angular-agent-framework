# X adapter — manual smoke

Run after the bootstrapper has populated `.env`.

> **Note:** Use the npm scripts below (or pass `--env-file=.env` to tsx directly). Plain `npx tsx ...` does NOT auto-load `.env`, so the adapter will throw "missing env vars".

## 1. Dry-run (no API calls)

```bash
DRY_RUN=1 pnpm marketing:channels:x:smoke
```

Expect: a JSON `PostResult` printed with `postId` prefixed `dry-` and a file under `marketing/cowork/outbox/dry-runs/`.

## 2. Live single tweet

```bash
pnpm marketing:channels:x:smoke
```

Expect: a real `https://x.com/<handle>/status/<id>` URL. Open it; confirm the post is on the timeline. **Then delete the post from the X UI.**

## 3. Live tweet with media

```bash
SMOKE_MEDIA=1 pnpm marketing:channels:x:smoke
```

Expect: the post has a 1×1 transparent pixel attached with the alt text. Delete after verifying.

## 4. Live thread

```bash
SMOKE_THREAD=1 pnpm marketing:channels:x:smoke
```

Expect: two tweets posted; the second is a reply to the first. Delete both.

## If anything fails

Capture the printed error message and any response body in the error. Note which step failed. File the result in the PR description so future maintainers see what shape of breakage they need to handle.
