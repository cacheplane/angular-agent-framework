---
workstream: channel-adapter-devto
status: approved
owner: brian
phase: 1
spec: docs/superpowers/specs/marketing/2026-05-17-channel-adapter-devto-design.md
plan: docs/superpowers/plans/marketing/2026-05-17-channel-adapter-devto.md
parent: docs/superpowers/specs/marketing/2026-05-17-channel-adapters-design.md
---

# Channel Adapter — Dev.to (Design)

> Follow-up to the channel-adapters sub-spec. Implements the Dev.to adapter behind the same `ChannelAdapter` interface. Single API key auth, single endpoint, real `metrics()` (Dev.to's read API is free). Extends `Draft` with an optional `article` sub-object that LinkedIn will reuse.

## 1. Goal

Ship a working Dev.to adapter that turns a markdown-bearing `Draft` into a published Dev.to article. Real metrics included. Adds the article-shaped fields to the shared `Draft` type so LinkedIn long-form posts can land later without another type refactor.

## 2. Context

- Parent: `docs/superpowers/specs/marketing/2026-05-17-channel-adapters-design.md`. The shared infra (`validation.ts`, `http.ts`, `dry-run.ts`, `registry.ts`) is already in place; this sub-spec only adds Dev.to-specific code + extends `Draft`.
- Pipeline shape: direct syndication. The content-agent (separate sub-spec) takes a `apps/website/content/blog/<slug>.mdx` file, strips MDX-only components, builds a `Draft` with the blog body + title + tags + canonical URL pointing at `cacheplane.ai/blog/<slug>`, and calls `getAdapter('devto').post(draft)`.
- Auth model: single API key in `DEVTO_API_KEY`. Sent via `api-key` request header. No OAuth, no refresh, no bootstrapper CLI.
- Dev.to API quirks worth knowing:
  - Tags must be lowercase alphanumeric only — `^[a-z0-9]+$`. No hyphens, no underscores. (`langgraph` ✓; `lang-graph` ✗.)
  - Max 4 tags. Excess tags → 422 with validation error.
  - `canonical_url` tells Google the post originated at the URL provided (the cacheplane blog), so duplicate-content penalties don't apply.
  - `published: false` lands the post as a Dev.to-side draft; `published: true` publishes immediately. We use `true` because Cowork approval is the human gate.
  - No media-upload endpoint. Images must live at external URLs and be referenced via standard markdown `![alt](https://...)` in the body. Our pipeline hosts images via `@ngaf/marketing-assets` and references them by URL.

## 3. Scope

**In scope:**

- `DevToAdapter` class implementing `ChannelAdapter`.
- `Draft` type extension: optional `article: DraftArticle` sub-object with `title`, `tags?`, `canonicalUrl?`, `description?`.
- `validateDraft` rules for `'devto'`:
  - `text` required, non-empty
  - `article` required
  - `article.title` 1-128 chars
  - `article.tags`, if present: length ≤ 4, each `^[a-z0-9]+$`, each 1-30 chars
  - `article.canonicalUrl`, if present, parses as `https:` URL
  - `threadParts` and `media` must not be set (sanity)
- `post()` POSTs `https://dev.to/api/articles` with `published: true`. Returns `PostResult` with the Dev.to article ID + URL.
- `metrics()` GETs `https://dev.to/api/articles/<id>` and maps:
  - `page_views_count` → `PostMetrics.impressions`
  - `comments_count` → `PostMetrics.replies`
  - `public_reactions_count` → `PostMetrics.shares`
- Dry-run via existing `DRY_RUN=1` (inherits behavior — adapter delegates to `writeDryRunResult`).
- Unit tests with `msw/node` (~12 new tests).
- Update `marketing/channels/README.md` with a Dev.to section (auth + tag rules + quickstart).
- Update `marketing/channels/MANUAL-SMOKE.md` with a Dev.to smoke recipe (dry-run + live).
- Extend `marketing/channels/scripts/smoke.ts` to accept `--channel=devto` (default `x`).

**Out of scope:**

- MDX → markdown conversion. Content-agent sub-spec.
- Updates / edits to already-posted articles (Dev.to supports `PUT /api/articles/<id>`). v1 is post-once. The adapter throws if asked to update; that's a future feature.
- Series / cover image / video-embed fields. All supported by Dev.to but not in v1.
- LinkedIn long-form using the same `article` sub-object. LinkedIn ships next sub-spec.

**Out of scope (X-related, called out for clarity):**

- The `Draft.article` field MUST NOT be set on X drafts. The X validator rejects it. This is enforced by the adapter-mismatch sanity check, not a separate rule.

## 4. Architecture

```
marketing/channels/src/
├── types.ts                     # MODIFY: add DraftArticle + Draft.article?
├── validation.ts                # MODIFY: add 'devto' branch with rules
├── registry.ts                  # MODIFY: instantiate DevToAdapter; remove devto from buildAdapter throw branch
└── devto/                       # NEW
    ├── index.ts                 # DevToAdapter class
    ├── post.ts                  # postDevTo(adapter, draft) → PostResult
    ├── post.spec.ts             # 5+ msw tests
    ├── metrics.ts               # fetchDevToMetrics(adapter, postId) → PostMetrics
    └── metrics.spec.ts          # 2+ msw tests
```

No `auth.ts` / `auth-cli.ts` for Dev.to — single API key read in `DevToAdapter` constructor. No state machine. No refresh path.

## 5. Public API delta

```ts
// types.ts (additions):

export interface DraftArticle {
  /** 1-128 chars. */
  title: string;
  /** Channel-specific limits; for Dev.to, lowercase alphanumeric, ≤ 4 items, each ≤ 30 chars. */
  tags?: string[];
  /** Absolute URL — origin post location. Tells search engines where the canonical version lives. */
  canonicalUrl?: string;
  /** Meta description; falls through to the platform's SEO subtitle. */
  description?: string;
}

export interface Draft {
  channel: ChannelId;
  text?: string;
  threadParts?: string[];
  media?: DraftMedia[];
  link?: { url: string; previewTitle?: string };
  scheduledAt?: string;
  article?: DraftArticle;          // NEW
}
```

No existing X usage breaks: X drafts never set `article`. Validation enforces this.

## 6. Dev.to adapter contract

### 6.1 Construction

`DevToAdapter` constructor reads `DEVTO_API_KEY` from env. If missing or empty, throws:

```
Dev.to adapter missing env var: DEVTO_API_KEY. Generate one at https://dev.to/settings/extensions and add to .env.
```

### 6.2 `post(draft)` flow

1. `validateDraft(draft, { adapterId: 'devto' })`.
2. If `process.env.DRY_RUN === '1'`: `return writeDryRunResult(draft)`.
3. Build request body:
   ```ts
   {
     article: {
       title: draft.article!.title,
       body_markdown: draft.text!,
       published: true,
       tags: draft.article!.tags,                 // omit key if undefined
       canonical_url: draft.article!.canonicalUrl, // omit key if undefined
       description: draft.article!.description,    // omit key if undefined
     }
   }
   ```
   Omit keys whose values are `undefined` (don't ship `{tags: undefined}` in JSON).
4. `POST https://dev.to/api/articles` with headers:
   - `api-key: <DEVTO_API_KEY>`
   - `Content-Type: application/json`
   - `User-Agent: cacheplane-marketing/1.0`
5. On non-2xx: throw with full response body in the message. Specific error wrapper for 401 status: "Dev.to API key rejected — re-generate at https://dev.to/settings/extensions and update DEVTO_API_KEY."
6. Map response → `PostResult`:
   ```ts
   {
     channel: 'devto',
     postId: String(response.id),
     url: response.url,
     postedAt: response.published_at ?? new Date().toISOString(),
   }
   ```

### 6.3 `metrics(postId)`

1. `GET https://dev.to/api/articles/<postId>` with `api-key` header.
2. Map to `PostMetrics`:
   ```ts
   {
     postId,
     impressions: response.page_views_count,
     replies: response.comments_count,
     shares: response.public_reactions_count,
     clicks: undefined,                 // Dev.to doesn't expose link-click counts
     fetchedAt: new Date().toISOString(),
   }
   ```
3. On 404: throw "Dev.to article <postId> not found." On other non-2xx: throw with response body.

## 7. Validation rules (per §4 of the brainstorm)

In `validation.ts`, replace the `'devto'` branch of the switch with:

```ts
function validateDevTo(draft: Draft): void {
  if (typeof draft.text !== 'string' || draft.text.length === 0) {
    throw new ValidationError('Dev.to draft.text (body markdown) is required.', {
      rule: 'devto-body-required', field: 'text',
    });
  }
  if (!draft.article) {
    throw new ValidationError('Dev.to draft.article is required.', {
      rule: 'devto-article-required', field: 'article',
    });
  }
  const t = draft.article.title;
  if (typeof t !== 'string' || t.length === 0 || t.length > 128) {
    throw new ValidationError(
      `Dev.to article.title must be 1-128 characters (got ${t?.length ?? 0}).`,
      { rule: 'devto-title-length', field: 'article.title' },
    );
  }
  if (draft.article.tags) {
    if (draft.article.tags.length > 4) {
      throw new ValidationError(
        `Dev.to accepts at most 4 tags (got ${draft.article.tags.length}).`,
        { rule: 'devto-too-many-tags', field: 'article.tags' },
      );
    }
    for (let i = 0; i < draft.article.tags.length; i++) {
      const tag = draft.article.tags[i];
      if (!/^[a-z0-9]+$/.test(tag) || tag.length > 30) {
        throw new ValidationError(
          `Dev.to tag "${tag}" must match ^[a-z0-9]+$ and be ≤ 30 chars.`,
          { rule: 'devto-tag-format', field: `article.tags[${i}]` },
        );
      }
    }
  }
  if (draft.article.canonicalUrl !== undefined) {
    try {
      const u = new URL(draft.article.canonicalUrl);
      if (u.protocol !== 'https:') {
        throw new ValidationError(
          `Dev.to canonicalUrl must use https: (got ${u.protocol}).`,
          { rule: 'devto-canonical-protocol', field: 'article.canonicalUrl' },
        );
      }
    } catch (err) {
      if (err instanceof ValidationError) throw err;
      throw new ValidationError(
        `Dev.to canonicalUrl is not a valid URL: ${draft.article.canonicalUrl}.`,
        { rule: 'devto-canonical-invalid', field: 'article.canonicalUrl' },
      );
    }
  }
  if (draft.threadParts) {
    throw new ValidationError('Dev.to does not support threads. Use a single text body.', {
      rule: 'devto-no-threads', field: 'threadParts',
    });
  }
  if (draft.media && draft.media.length > 0) {
    throw new ValidationError(
      'Dev.to does not accept media uploads. Inline image URLs in the markdown body instead.',
      { rule: 'devto-no-media', field: 'media' },
    );
  }
}
```

The `'linkedin'` and `'reddit'` branches stay on the existing "not yet implemented" error. The `'devto'` branch is the one that flips from stub to real.

## 8. Auth getting-started (for the README)

The README gains a new section:

```
## Dev.to setup

1. Sign in to Dev.to as the author account.
2. Settings → Extensions → DEV Community API Keys → "Generate API Key".
   Name it "cacheplane-marketing".
3. Copy the key.
4. Paste into `.env`:

   DEVTO_API_KEY=<paste>

5. (Optional) Verify with a dry-run:

   DRY_RUN=1 pnpm marketing:channels:devto:smoke
```

The npm script `marketing:channels:devto:smoke` is added in the plan.

## 9. Testing

### 9.1 `devto/post.spec.ts`

- Valid full draft → assert request URL, headers, body shape, returned `PostResult`.
- Valid minimal draft (no tags, no canonical, no description) → assert these keys are omitted from request body.
- 401 from API → throws with "re-generate" hint.
- 422 with validation error → throws with response body included.
- `DRY_RUN=1` → no HTTP, file written, synthetic `PostResult`.

### 9.2 `devto/metrics.spec.ts`

- Maps fields correctly (`page_views_count` → `impressions`, etc.).
- 404 → throws "article <id> not found".

### 9.3 `validation.spec.ts` additions

One test per §7 rule. Existing "linkedin/devto/reddit throw not yet implemented" test gets pared down: `devto` is removed from the loop, `linkedin` and `reddit` continue to throw.

Approximate new test count: 12.

## 10. Manual smoke recipe addition

`marketing/channels/MANUAL-SMOKE.md` gains a Dev.to section:

```
## Dev.to

### 1. Dry-run

DRY_RUN=1 pnpm marketing:channels:devto:smoke

Expect: PostResult with dry- prefix; JSON in marketing/cowork/outbox/dry-runs/.

### 2. Live post (publishes to your Dev.to)

pnpm marketing:channels:devto:smoke

Expect: a real https://dev.to/<handle>/<slug> URL. Open it; confirm the post is published.
Then DELETE the post from the Dev.to UI (Dashboard → ⋯ → Delete).

### 3. Metrics fetch

The smoke prints metrics for the post just made (sleeps 5s first to give Dev.to time to index).
Expect: { impressions: 0, replies: 0, shares: 0, fetchedAt: <iso> } or near-zero counts.
```

## 11. Risks + non-goals

| # | Risk | Mitigation |
|--:|------|------------|
| 1 | Dev.to tag rules reject content the agent generates (e.g., agent suggests `dev-to` for the meta-tag) | Validation catches it before any API call; agent can retry with sanitized tags. Document the regex in the README. |
| 2 | The smoke creates real noise on Dev.to during testing | The recipe explicitly says "delete after verifying." A test post stays up for ~30 seconds. |
| 3 | `Draft.article` could be misused (set on X drafts) | Validation catches it (X rules don't allow article); error message names the rule. |
| 4 | Future LinkedIn long-form might want extra fields (`subtitle`, `coverImage`) not in `DraftArticle` | We add them when LinkedIn ships. v1 keeps `DraftArticle` minimal — title/tags/canonical/description is enough for both channels' v1 needs. |
| 5 | Image hosting for inlined markdown images requires a CDN/URL outside the assets package's current scope | Out of scope for this sub-spec. Assets sub-spec ships `renderCard()` to bytes; the content-agent or asset-host sub-spec handles upload-to-URL. v1 Dev.to posts that need images either use the cacheplane blog's existing image URLs or skip images. |

**Non-goals:**
- Dev.to comment-fetching / reply-posting.
- Cross-posting / unlisted / private articles.
- Series management.

## 12. Phases

1. **Phase 0 — Types + validation.** Extend `Draft.article`, add `validateDevTo`, run existing tests + 7 new validation tests green. ~2 commits.
2. **Phase 1 — Adapter post.** `devto/post.ts` + spec; `devto/index.ts` skeleton. ~2 commits.
3. **Phase 2 — Metrics.** `devto/metrics.ts` + spec. ~1 commit.
4. **Phase 3 — Registry + smoke.** Wire into `registry.ts`; extend `scripts/smoke.ts` for `--channel=devto`. Add npm script `marketing:channels:devto:smoke`. ~2 commits.
5. **Phase 4 — Docs.** README + MANUAL-SMOKE updates. ~1 commit.
6. **Phase 5 — Verification.** Build + tests green; Brian runs live smoke; PR. No commit.

Total: ~8 commits.

## 13. Deliverables

- ☐ `marketing/channels/src/types.ts` updated with `DraftArticle`
- ☐ `marketing/channels/src/validation.ts` adds Dev.to branch
- ☐ `marketing/channels/src/validation.spec.ts` adds 7+ Dev.to tests
- ☐ `marketing/channels/src/devto/index.ts`
- ☐ `marketing/channels/src/devto/post.ts` + `post.spec.ts`
- ☐ `marketing/channels/src/devto/metrics.ts` + `metrics.spec.ts`
- ☐ `marketing/channels/src/registry.ts` updated to construct `DevToAdapter`
- ☐ `marketing/channels/scripts/smoke.ts` extended for `--channel=devto`
- ☐ Root `package.json` script: `marketing:channels:devto:smoke`
- ☐ `marketing/channels/README.md` Dev.to section
- ☐ `marketing/channels/MANUAL-SMOKE.md` Dev.to section
- ☐ `marketing/.env.example` already has `DEVTO_API_KEY=` from the meta-spec (no change)
- ☐ `nx run marketing-channels:build` green
- ☐ `nx run marketing-channels:test` green (≥ 45 total tests, up from 33)
- ☐ Brian runs live Dev.to smoke; captures result in PR

## 14. References

- Parent: `docs/superpowers/specs/marketing/2026-05-17-channel-adapters-design.md`
- Dev.to API docs: `https://developers.forem.com/api/v1` (Forem is Dev.to's OSS engine)
- Article POST schema: `https://developers.forem.com/api/v1#tag/articles/operation/createArticle`
- API key management: `https://dev.to/settings/extensions`
