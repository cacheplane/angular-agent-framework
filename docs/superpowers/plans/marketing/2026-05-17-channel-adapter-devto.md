# Dev.to Channel Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Dev.to adapter behind the existing `ChannelAdapter` interface, extend `Draft` with an `article` sub-object that Dev.to (and future LinkedIn) needs, and ship real `metrics()` since Dev.to's read API is free.

**Architecture:** TDD throughout. Phase 0 adds the type + validation extension. Phase 1 adds adapter `post()`. Phase 2 adds `metrics()`. Phase 3 wires the registry + smoke script. Phase 4 docs. Phase 5 verification + PR. Tests use `msw/node` to mock dev.to's API.

**Tech Stack:** TypeScript 5.x, Vitest 4.x, `msw@^2`, Node 22. No new runtime dependencies.

**Spec reference:** `docs/superpowers/specs/marketing/2026-05-17-channel-adapter-devto-design.md`. Branch: `marketing-channel-devto` (stacked on `marketing-channel-adapters` PR #425). When PR #425 merges to main, rebase this branch on main; if it merges cleanly there should be no conflicts.

---

## File Structure

**Modified (all live in PR #425's diff if it hasn't merged yet — this branch stacks on top):**

- `marketing/channels/src/types.ts` — add `DraftArticle` + optional `Draft.article`
- `marketing/channels/src/validation.ts` — add `validateDevTo` branch
- `marketing/channels/src/validation.spec.ts` — append Dev.to test block
- `marketing/channels/src/registry.ts` — instantiate `DevToAdapter`, remove `devto` from the not-implemented branch
- `marketing/channels/scripts/smoke.ts` — accept `--channel=devto`
- `marketing/channels/README.md` — Dev.to section
- `marketing/channels/MANUAL-SMOKE.md` — Dev.to recipe
- `package.json` (root) — add `marketing:channels:devto:smoke` script

**New:**

- `marketing/channels/src/devto/index.ts`
- `marketing/channels/src/devto/post.ts` + `post.spec.ts`
- `marketing/channels/src/devto/metrics.ts` + `metrics.spec.ts`

---

## Task 1: Extend `types.ts` with `DraftArticle`

**Files:**
- Modify: `marketing/channels/src/types.ts`

- [ ] **Step 1: Add the `DraftArticle` interface and `Draft.article?` field**

Append `DraftArticle` after the existing `DraftMedia` interface, and add `article?: DraftArticle` to `Draft`. The final file should read:

```ts
// SPDX-License-Identifier: MIT
//
// @ngaf/marketing-channels — public types.

export type ChannelId = 'x' | 'linkedin' | 'devto' | 'reddit';

export interface DraftMedia {
  png: Buffer;
  alt: string;
}

export interface DraftArticle {
  /** 1-128 chars. */
  title: string;
  /** Channel-specific limits. Dev.to: ^[a-z0-9]+$, ≤ 4 items, each ≤ 30 chars. */
  tags?: string[];
  /** Absolute https: URL — origin post location. Tells search engines where the canonical version lives. */
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
  article?: DraftArticle;
}

export interface PostResult {
  channel: ChannelId;
  postId: string;
  url: string;
  postedAt: string;
}

export interface PostMetrics {
  postId: string;
  impressions?: number;
  clicks?: number;
  replies?: number;
  shares?: number;
  fetchedAt: string;
}

export interface ChannelAdapter {
  readonly id: ChannelId;
  post(draft: Draft): Promise<PostResult>;
  metrics(postId: string): Promise<PostMetrics>;
}
```

- [ ] **Step 2: Verify nothing breaks**

```bash
npx nx run marketing-channels:build
```

Expected: green. The X adapter doesn't set `article` so adding an optional field is backwards-compatible.

- [ ] **Step 3: Commit**

```bash
git add marketing/channels/src/types.ts
git commit -m "feat(marketing/channels): add DraftArticle sub-type to Draft"
```

---

## Task 2: Add Dev.to validation rules (TDD)

**Files:**
- Modify: `marketing/channels/src/validation.ts`
- Modify: `marketing/channels/src/validation.spec.ts`

- [ ] **Step 1: Add failing tests**

Append a new `describe` block to `marketing/channels/src/validation.spec.ts` (after the existing X + "other channels" blocks). Also update the existing "other channels" test to no longer include `devto`:

Find the existing test:

```ts
describe('validateDraft (other channels)', () => {
  it('throws not-yet-implemented for linkedin/devto/reddit', () => {
    for (const channel of ['linkedin', 'devto', 'reddit'] as const) {
```

And change `['linkedin', 'devto', 'reddit']` to `['linkedin', 'reddit']` and the description to `'throws not-yet-implemented for linkedin/reddit'`.

Append:

```ts
describe('validateDraft (Dev.to)', () => {
  function baseDevTo(): Draft {
    return {
      channel: 'devto',
      text: '# Title\n\nBody content here.',
      article: {
        title: 'My Article',
        tags: ['angular', 'tutorial'],
        canonicalUrl: 'https://cacheplane.ai/blog/my-article',
        description: 'A description.',
      },
    };
  }

  it('accepts a minimal valid devto draft', () => {
    expect(() => validateDraft(baseDevTo())).not.toThrow();
  });

  it('rejects missing text', () => {
    const d = baseDevTo();
    delete d.text;
    expect(() => validateDraft(d)).toThrow(/body markdown is required/i);
  });

  it('rejects empty text', () => {
    const d = baseDevTo();
    d.text = '';
    expect(() => validateDraft(d)).toThrow(/body markdown is required/i);
  });

  it('rejects missing article', () => {
    const d = baseDevTo();
    delete d.article;
    expect(() => validateDraft(d)).toThrow(/article is required/i);
  });

  it('rejects missing title', () => {
    const d = baseDevTo();
    d.article!.title = '';
    expect(() => validateDraft(d)).toThrow(/title must be 1-128/i);
  });

  it('rejects title > 128 chars', () => {
    const d = baseDevTo();
    d.article!.title = 'a'.repeat(129);
    expect(() => validateDraft(d)).toThrow(/title must be 1-128/i);
  });

  it('rejects > 4 tags', () => {
    const d = baseDevTo();
    d.article!.tags = ['a', 'b', 'c', 'd', 'e'];
    expect(() => validateDraft(d)).toThrow(/at most 4 tags/i);
  });

  it('rejects tag with hyphen', () => {
    const d = baseDevTo();
    d.article!.tags = ['lang-graph'];
    expect(() => validateDraft(d)).toThrow(/tag "lang-graph"/);
  });

  it('rejects tag with uppercase', () => {
    const d = baseDevTo();
    d.article!.tags = ['Angular'];
    expect(() => validateDraft(d)).toThrow(/tag "Angular"/);
  });

  it('rejects tag with underscore', () => {
    const d = baseDevTo();
    d.article!.tags = ['lang_graph'];
    expect(() => validateDraft(d)).toThrow(/tag "lang_graph"/);
  });

  it('rejects tag > 30 chars', () => {
    const d = baseDevTo();
    d.article!.tags = ['a'.repeat(31)];
    expect(() => validateDraft(d)).toThrow(/tag .* must match/);
  });

  it('rejects non-https canonical URL', () => {
    const d = baseDevTo();
    d.article!.canonicalUrl = 'http://insecure.example.com';
    expect(() => validateDraft(d)).toThrow(/must use https:/);
  });

  it('rejects invalid canonical URL', () => {
    const d = baseDevTo();
    d.article!.canonicalUrl = 'not-a-url';
    expect(() => validateDraft(d)).toThrow(/not a valid URL/);
  });

  it('rejects threadParts set on devto draft', () => {
    const d = baseDevTo();
    d.threadParts = ['part 1', 'part 2'];
    expect(() => validateDraft(d)).toThrow(/does not support threads/i);
  });

  it('rejects media set on devto draft', () => {
    const d = baseDevTo();
    d.media = [{ png: Buffer.from('a'), alt: 'a' }];
    expect(() => validateDraft(d)).toThrow(/does not accept media uploads/i);
  });

  it('accepts draft with no tags', () => {
    const d = baseDevTo();
    delete d.article!.tags;
    expect(() => validateDraft(d)).not.toThrow();
  });

  it('accepts draft with no canonical URL', () => {
    const d = baseDevTo();
    delete d.article!.canonicalUrl;
    expect(() => validateDraft(d)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run tests — they fail (or some pre-existing ones break on the `delete devto` line)**

```bash
npx nx run marketing-channels:test
```

Expected: validation.spec.ts has multiple failures because (a) `validateDevTo` doesn't exist yet, and (b) the "linkedin/devto/reddit" loop changed to "linkedin/reddit".

- [ ] **Step 3: Implement `validateDevTo`**

Edit `marketing/channels/src/validation.ts`. Add the `validateDevTo` function and wire it into the `switch` statement. The final file should read:

```ts
// SPDX-License-Identifier: MIT
import type { ChannelId, Draft } from './types';

export class ValidationError extends Error {
  public readonly rule: string;
  public readonly field?: string;
  constructor(message: string, opts: { rule: string; field?: string }) {
    super(message);
    this.name = 'ValidationError';
    this.rule = opts.rule;
    this.field = opts.field;
  }
}

const MAX_X_CHARS = 280;
const MAX_X_MEDIA = 4;
const MAX_ALT = 1000;
const MAX_PNG_BYTES = 5 * 1024 * 1024;

const MAX_DEVTO_TITLE = 128;
const MAX_DEVTO_TAGS = 4;
const MAX_DEVTO_TAG_LEN = 30;
const DEVTO_TAG_RE = /^[a-z0-9]+$/;

function codePointLength(s: string): number {
  return [...s].length;
}

function validateX(draft: Draft): void {
  const hasText = typeof draft.text === 'string';
  const hasThread = Array.isArray(draft.threadParts);

  if (hasText && hasThread) {
    throw new ValidationError('Draft cannot have both text and threadParts.', {
      rule: 'exclusive-text-thread',
    });
  }
  if (!hasText && !hasThread) {
    throw new ValidationError('Draft must have either text or threadParts.', {
      rule: 'missing-text-or-thread',
    });
  }

  if (hasText && codePointLength(draft.text!) > MAX_X_CHARS) {
    throw new ValidationError(
      `X text exceeds 280 characters (got ${codePointLength(draft.text!)}).`,
      { rule: 'text-too-long', field: 'text' },
    );
  }

  if (hasThread) {
    if (draft.threadParts!.length < 2) {
      throw new ValidationError('threadParts must contain at least 2 entries.', {
        rule: 'thread-too-short',
        field: 'threadParts',
      });
    }
    for (let i = 0; i < draft.threadParts!.length; i++) {
      const part = draft.threadParts![i];
      if (codePointLength(part) > MAX_X_CHARS) {
        throw new ValidationError(
          `threadParts[${i}] exceeds 280 characters (got ${codePointLength(part)}).`,
          { rule: 'thread-part-too-long', field: `threadParts[${i}]` },
        );
      }
    }
  }

  if (draft.media && draft.media.length > MAX_X_MEDIA) {
    throw new ValidationError(
      `X accepts at most 4 media items per post (got ${draft.media.length}).`,
      { rule: 'too-many-media', field: 'media' },
    );
  }

  for (let i = 0; i < (draft.media?.length ?? 0); i++) {
    const m = draft.media![i];
    if (!m.alt || m.alt.length === 0) {
      throw new ValidationError(`media[${i}] alt text is required.`, {
        rule: 'alt-required',
        field: `media[${i}].alt`,
      });
    }
    if (m.alt.length > MAX_ALT) {
      throw new ValidationError(
        `media[${i}] alt text exceeds 1000 characters (got ${m.alt.length}).`,
        { rule: 'alt-too-long', field: `media[${i}].alt` },
      );
    }
    if (m.png.byteLength > MAX_PNG_BYTES) {
      throw new ValidationError(
        `media[${i}] PNG exceeds 5MB (got ${m.png.byteLength} bytes).`,
        { rule: 'png-too-large', field: `media[${i}].png` },
      );
    }
  }
}

function validateDevTo(draft: Draft): void {
  if (typeof draft.text !== 'string' || draft.text.length === 0) {
    throw new ValidationError('Dev.to draft.text (body markdown) is required.', {
      rule: 'devto-body-required',
      field: 'text',
    });
  }
  if (!draft.article) {
    throw new ValidationError('Dev.to draft.article is required.', {
      rule: 'devto-article-required',
      field: 'article',
    });
  }
  const t = draft.article.title;
  if (typeof t !== 'string' || t.length === 0 || t.length > MAX_DEVTO_TITLE) {
    throw new ValidationError(
      `Dev.to article.title must be 1-128 characters (got ${t?.length ?? 0}).`,
      { rule: 'devto-title-length', field: 'article.title' },
    );
  }
  if (draft.article.tags) {
    if (draft.article.tags.length > MAX_DEVTO_TAGS) {
      throw new ValidationError(
        `Dev.to accepts at most 4 tags (got ${draft.article.tags.length}).`,
        { rule: 'devto-too-many-tags', field: 'article.tags' },
      );
    }
    for (let i = 0; i < draft.article.tags.length; i++) {
      const tag = draft.article.tags[i];
      if (!DEVTO_TAG_RE.test(tag) || tag.length > MAX_DEVTO_TAG_LEN) {
        throw new ValidationError(
          `Dev.to tag "${tag}" must match ^[a-z0-9]+$ and be ≤ 30 chars.`,
          { rule: 'devto-tag-format', field: `article.tags[${i}]` },
        );
      }
    }
  }
  if (draft.article.canonicalUrl !== undefined) {
    let parsed: URL;
    try {
      parsed = new URL(draft.article.canonicalUrl);
    } catch {
      throw new ValidationError(
        `Dev.to article.canonicalUrl is not a valid URL: ${draft.article.canonicalUrl}.`,
        { rule: 'devto-canonical-invalid', field: 'article.canonicalUrl' },
      );
    }
    if (parsed.protocol !== 'https:') {
      throw new ValidationError(
        `Dev.to article.canonicalUrl must use https: (got ${parsed.protocol}).`,
        { rule: 'devto-canonical-protocol', field: 'article.canonicalUrl' },
      );
    }
  }
  if (draft.threadParts) {
    throw new ValidationError('Dev.to does not support threads. Use a single text body.', {
      rule: 'devto-no-threads',
      field: 'threadParts',
    });
  }
  if (draft.media && draft.media.length > 0) {
    throw new ValidationError(
      'Dev.to does not accept media uploads. Inline image URLs in the markdown body instead.',
      { rule: 'devto-no-media', field: 'media' },
    );
  }
}

export function validateDraft(
  draft: Draft,
  opts: { adapterId?: ChannelId } = {},
): void {
  if (opts.adapterId && opts.adapterId !== draft.channel) {
    throw new ValidationError(
      `Channel mismatch: adapter is "${opts.adapterId}" but draft.channel is "${draft.channel}".`,
      { rule: 'channel-mismatch', field: 'channel' },
    );
  }
  switch (draft.channel) {
    case 'x':
      return validateX(draft);
    case 'devto':
      return validateDevTo(draft);
    case 'linkedin':
    case 'reddit':
      throw new ValidationError(
        `Channel "${draft.channel}" adapter is not yet implemented.`,
        { rule: 'not-implemented', field: 'channel' },
      );
    default: {
      const _exhaustive: never = draft.channel;
      throw new ValidationError(`Unknown channel: ${String(_exhaustive)}.`, {
        rule: 'unknown-channel',
        field: 'channel',
      });
    }
  }
}
```

- [ ] **Step 4: Run tests — they pass**

```bash
npx nx run marketing-channels:test
```

Expected: PASS. All previously-passing X tests still pass; new Dev.to tests pass.

- [ ] **Step 5: Commit**

```bash
git add marketing/channels/src/validation.ts marketing/channels/src/validation.spec.ts
git commit -m "feat(marketing/channels): add Dev.to validation rules"
```

---

## Task 3: `devto/post.ts` + tests (TDD)

**Files:**
- Create: `marketing/channels/src/devto/post.ts`
- Create: `marketing/channels/src/devto/post.spec.ts`

- [ ] **Step 1: Write failing tests**

`marketing/channels/src/devto/post.spec.ts`:

```ts
import { describe, expect, it, beforeAll, afterAll, afterEach, beforeEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http as mswHttp, HttpResponse } from 'msw';
import { postDevTo } from './post';
import type { Draft } from '../types';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const apiKey = 'devto-key-123';

function baseDraft(): Draft {
  return {
    channel: 'devto',
    text: '# Hello\n\nBody',
    article: {
      title: 'Hello',
      tags: ['angular', 'tutorial'],
      canonicalUrl: 'https://cacheplane.ai/blog/hello',
      description: 'A hello article.',
    },
  };
}

describe('postDevTo', () => {
  it('POSTs the full article shape and returns a PostResult', async () => {
    let receivedBody: unknown;
    let receivedHeaders: Headers | undefined;
    server.use(
      mswHttp.post('https://dev.to/api/articles', async ({ request }) => {
        receivedBody = await request.json();
        receivedHeaders = request.headers;
        return HttpResponse.json({
          id: 42,
          url: 'https://dev.to/brian/hello-1abc',
          published_at: '2026-05-17T12:00:00Z',
        });
      }),
    );

    const result = await postDevTo(apiKey, baseDraft());

    expect(receivedHeaders?.get('api-key')).toBe(apiKey);
    expect(receivedHeaders?.get('content-type')).toMatch(/application\/json/);
    expect(receivedHeaders?.get('user-agent')).toBe('cacheplane-marketing/1.0');
    expect(receivedBody).toEqual({
      article: {
        title: 'Hello',
        body_markdown: '# Hello\n\nBody',
        published: true,
        tags: ['angular', 'tutorial'],
        canonical_url: 'https://cacheplane.ai/blog/hello',
        description: 'A hello article.',
      },
    });
    expect(result).toEqual({
      channel: 'devto',
      postId: '42',
      url: 'https://dev.to/brian/hello-1abc',
      postedAt: '2026-05-17T12:00:00Z',
    });
  });

  it('omits optional fields when not set', async () => {
    let receivedBody: { article: Record<string, unknown> } | undefined;
    server.use(
      mswHttp.post('https://dev.to/api/articles', async ({ request }) => {
        receivedBody = (await request.json()) as typeof receivedBody;
        return HttpResponse.json({
          id: 7,
          url: 'https://dev.to/brian/min-7',
          published_at: '2026-05-17T12:00:00Z',
        });
      }),
    );

    const draft: Draft = {
      channel: 'devto',
      text: 'Just body.',
      article: { title: 'Minimal' },
    };
    await postDevTo(apiKey, draft);

    expect(receivedBody?.article).toEqual({
      title: 'Minimal',
      body_markdown: 'Just body.',
      published: true,
    });
    expect(Object.keys(receivedBody!.article)).not.toContain('tags');
    expect(Object.keys(receivedBody!.article)).not.toContain('canonical_url');
    expect(Object.keys(receivedBody!.article)).not.toContain('description');
  });

  it('falls back to current time when published_at is missing in response', async () => {
    server.use(
      mswHttp.post('https://dev.to/api/articles', () =>
        HttpResponse.json({ id: 1, url: 'https://dev.to/brian/x' }),
      ),
    );
    const result = await postDevTo(apiKey, baseDraft());
    expect(result.postedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('throws with regenerate hint on 401', async () => {
    server.use(
      mswHttp.post('https://dev.to/api/articles', () =>
        new HttpResponse('{"error":"unauthorized"}', { status: 401 }),
      ),
    );
    await expect(postDevTo(apiKey, baseDraft())).rejects.toThrow(
      /Dev\.to API key rejected.*re-generate/i,
    );
  });

  it('throws with response body on 422 validation error', async () => {
    server.use(
      mswHttp.post('https://dev.to/api/articles', () =>
        new HttpResponse(
          '{"error":"Tag is not allowed: bad_tag","status":422}',
          { status: 422 },
        ),
      ),
    );
    await expect(postDevTo(apiKey, baseDraft())).rejects.toThrow(/bad_tag/);
  });

  it('writes a dry-run file and skips HTTP when DRY_RUN=1', async () => {
    server.use(
      mswHttp.post('https://dev.to/api/articles', () => {
        throw new Error('should not be called during dry-run');
      }),
    );
    process.env.DRY_RUN = '1';
    try {
      const result = await postDevTo(apiKey, baseDraft());
      expect(result.postId).toMatch(/^dry-/);
      expect(result.channel).toBe('devto');
      expect(result.url).toMatch(/dry-run\.local/);
    } finally {
      delete process.env.DRY_RUN;
    }
  });
});
```

- [ ] **Step 2: Run tests — they fail (module not found)**

```bash
npx nx run marketing-channels:test
```

- [ ] **Step 3: Implement `post.ts`**

```ts
// SPDX-License-Identifier: MIT
import { http } from '../http';
import { writeDryRunResult } from '../dry-run';
import type { Draft, PostResult } from '../types';

const ARTICLES_URL = 'https://dev.to/api/articles';

interface DevToArticleResponse {
  id: number;
  url: string;
  published_at?: string;
}

interface ArticleBody {
  title: string;
  body_markdown: string;
  published: boolean;
  tags?: string[];
  canonical_url?: string;
  description?: string;
}

export async function postDevTo(apiKey: string, draft: Draft): Promise<PostResult> {
  if (process.env.DRY_RUN === '1') {
    return writeDryRunResult(draft);
  }

  const article: ArticleBody = {
    title: draft.article!.title,
    body_markdown: draft.text!,
    published: true,
  };
  if (draft.article!.tags !== undefined) article.tags = draft.article!.tags;
  if (draft.article!.canonicalUrl !== undefined) article.canonical_url = draft.article!.canonicalUrl;
  if (draft.article!.description !== undefined) article.description = draft.article!.description;

  let response: DevToArticleResponse;
  try {
    response = await http<DevToArticleResponse>({
      method: 'POST',
      url: ARTICLES_URL,
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        'User-Agent': 'cacheplane-marketing/1.0',
      },
      body: JSON.stringify({ article }),
      retryOn5xx: true,
    });
  } catch (err) {
    const message = (err as Error).message;
    if (message.startsWith('HTTP 401')) {
      throw new Error(
        'Dev.to API key rejected — re-generate at https://dev.to/settings/extensions and update DEVTO_API_KEY.',
      );
    }
    throw err;
  }

  return {
    channel: 'devto',
    postId: String(response.id),
    url: response.url,
    postedAt: response.published_at ?? new Date().toISOString(),
  };
}
```

- [ ] **Step 4: Run tests — they pass**

```bash
npx nx run marketing-channels:test
```

Expected: 6 new tests pass; everything previously passing still passes.

- [ ] **Step 5: Commit**

```bash
git add marketing/channels/src/devto/post.ts marketing/channels/src/devto/post.spec.ts
git commit -m "feat(marketing/channels): Dev.to post()"
```

---

## Task 4: `devto/metrics.ts` + tests (TDD)

**Files:**
- Create: `marketing/channels/src/devto/metrics.ts`
- Create: `marketing/channels/src/devto/metrics.spec.ts`

- [ ] **Step 1: Write failing tests**

`marketing/channels/src/devto/metrics.spec.ts`:

```ts
import { describe, expect, it, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http as mswHttp, HttpResponse } from 'msw';
import { fetchDevToMetrics } from './metrics';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const apiKey = 'devto-key-123';

describe('fetchDevToMetrics', () => {
  it('maps Dev.to response fields to PostMetrics', async () => {
    server.use(
      mswHttp.get('https://dev.to/api/articles/42', () =>
        HttpResponse.json({
          id: 42,
          page_views_count: 1234,
          comments_count: 5,
          public_reactions_count: 17,
        }),
      ),
    );
    const metrics = await fetchDevToMetrics(apiKey, '42');
    expect(metrics.postId).toBe('42');
    expect(metrics.impressions).toBe(1234);
    expect(metrics.replies).toBe(5);
    expect(metrics.shares).toBe(17);
    expect(metrics.clicks).toBeUndefined();
    expect(metrics.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('sends api-key + user-agent headers', async () => {
    let receivedHeaders: Headers | undefined;
    server.use(
      mswHttp.get('https://dev.to/api/articles/9', ({ request }) => {
        receivedHeaders = request.headers;
        return HttpResponse.json({
          id: 9,
          page_views_count: 0,
          comments_count: 0,
          public_reactions_count: 0,
        });
      }),
    );
    await fetchDevToMetrics(apiKey, '9');
    expect(receivedHeaders?.get('api-key')).toBe(apiKey);
    expect(receivedHeaders?.get('user-agent')).toBe('cacheplane-marketing/1.0');
  });

  it('throws a clear error on 404', async () => {
    server.use(
      mswHttp.get('https://dev.to/api/articles/999', () =>
        new HttpResponse('{"error":"not found"}', { status: 404 }),
      ),
    );
    await expect(fetchDevToMetrics(apiKey, '999')).rejects.toThrow(
      /Dev\.to article 999 not found/,
    );
  });

  it('returns zeroes when fields are missing in response', async () => {
    server.use(
      mswHttp.get('https://dev.to/api/articles/1', () =>
        HttpResponse.json({ id: 1 }),
      ),
    );
    const metrics = await fetchDevToMetrics(apiKey, '1');
    expect(metrics.impressions).toBe(0);
    expect(metrics.replies).toBe(0);
    expect(metrics.shares).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests — they fail (module not found)**

```bash
npx nx run marketing-channels:test
```

- [ ] **Step 3: Implement `metrics.ts`**

```ts
// SPDX-License-Identifier: MIT
import { http } from '../http';
import type { PostMetrics } from '../types';

interface DevToArticleDetail {
  id: number;
  page_views_count?: number;
  comments_count?: number;
  public_reactions_count?: number;
}

export async function fetchDevToMetrics(
  apiKey: string,
  postId: string,
): Promise<PostMetrics> {
  let response: DevToArticleDetail;
  try {
    response = await http<DevToArticleDetail>({
      method: 'GET',
      url: `https://dev.to/api/articles/${postId}`,
      headers: {
        'api-key': apiKey,
        'User-Agent': 'cacheplane-marketing/1.0',
      },
    });
  } catch (err) {
    const message = (err as Error).message;
    if (message.startsWith('HTTP 404')) {
      throw new Error(`Dev.to article ${postId} not found.`);
    }
    throw err;
  }

  return {
    postId,
    impressions: response.page_views_count ?? 0,
    replies: response.comments_count ?? 0,
    shares: response.public_reactions_count ?? 0,
    clicks: undefined,
    fetchedAt: new Date().toISOString(),
  };
}
```

- [ ] **Step 4: Run tests — they pass**

```bash
npx nx run marketing-channels:test
```

- [ ] **Step 5: Commit**

```bash
git add marketing/channels/src/devto/metrics.ts marketing/channels/src/devto/metrics.spec.ts
git commit -m "feat(marketing/channels): Dev.to metrics() — real read API"
```

---

## Task 5: `devto/index.ts` — DevToAdapter class

**Files:**
- Create: `marketing/channels/src/devto/index.ts`

- [ ] **Step 1: Implement DevToAdapter**

```ts
// SPDX-License-Identifier: MIT
import type { ChannelAdapter, Draft, PostMetrics, PostResult } from '../types';
import { validateDraft } from '../validation';
import { postDevTo } from './post';
import { fetchDevToMetrics } from './metrics';

export class DevToAdapter implements ChannelAdapter {
  readonly id = 'devto' as const;
  private readonly apiKey: string;

  constructor() {
    const key = process.env.DEVTO_API_KEY;
    if (!key || key.length === 0) {
      throw new Error(
        'Dev.to adapter missing env var: DEVTO_API_KEY. Generate one at https://dev.to/settings/extensions and add to .env.',
      );
    }
    this.apiKey = key;
  }

  async post(draft: Draft): Promise<PostResult> {
    validateDraft(draft, { adapterId: 'devto' });
    return postDevTo(this.apiKey, draft);
  }

  async metrics(postId: string): Promise<PostMetrics> {
    return fetchDevToMetrics(this.apiKey, postId);
  }
}
```

- [ ] **Step 2: Verify typecheck + build**

```bash
npx nx run marketing-channels:build
```

Expected: green.

- [ ] **Step 3: Commit**

```bash
git add marketing/channels/src/devto/index.ts
git commit -m "feat(marketing/channels): add DevToAdapter class"
```

---

## Task 6: Wire `DevToAdapter` into the registry

**Files:**
- Modify: `marketing/channels/src/registry.ts`

- [ ] **Step 1: Update registry**

Replace `marketing/channels/src/registry.ts` with:

```ts
// SPDX-License-Identifier: MIT
import type { ChannelAdapter, ChannelId } from './types';
import { XAdapter } from './x';
import { DevToAdapter } from './devto';

const KNOWN: ChannelId[] = ['x', 'linkedin', 'devto', 'reddit'];

const instances = new Map<ChannelId, ChannelAdapter>();

function buildAdapter(id: ChannelId): ChannelAdapter {
  switch (id) {
    case 'x':
      return new XAdapter();
    case 'devto':
      return new DevToAdapter();
    case 'linkedin':
    case 'reddit':
      throw new Error(
        `Channel "${id}" adapter is not yet implemented. Known channels with implementations: x, devto.`,
      );
    default: {
      const _exhaustive: never = id;
      throw new Error(
        `Unknown channel "${String(_exhaustive)}". Known: ${KNOWN.join(', ')}.`,
      );
    }
  }
}

export function getAdapter(id: ChannelId): ChannelAdapter {
  if (!KNOWN.includes(id)) {
    throw new Error(`Unknown channel "${id}". Known: ${KNOWN.join(', ')}.`);
  }
  let inst = instances.get(id);
  if (!inst) {
    inst = buildAdapter(id);
    instances.set(id, inst);
  }
  return inst;
}
```

- [ ] **Step 2: Verify build**

```bash
npx nx run marketing-channels:build
```

Expected: green.

- [ ] **Step 3: Commit**

```bash
git add marketing/channels/src/registry.ts
git commit -m "feat(marketing/channels): wire DevToAdapter into registry"
```

---

## Task 7: Extend `scripts/smoke.ts` for `--channel=devto`

**Files:**
- Modify: `marketing/channels/scripts/smoke.ts`

- [ ] **Step 1: Read current smoke.ts to confirm shape**

```bash
cat marketing/channels/scripts/smoke.ts | head -20
```

- [ ] **Step 2: Replace `marketing/channels/scripts/smoke.ts`**

```ts
// Standalone smoke runner for channel adapters. NOT exported by the package.
//
// Usage:
//   pnpm marketing:channels:x:auth                                    # one-time, fills .env (X only)
//   DRY_RUN=1 pnpm marketing:channels:x:smoke
//   pnpm marketing:channels:x:smoke
//   SMOKE_MEDIA=1 pnpm marketing:channels:x:smoke
//   SMOKE_THREAD=1 pnpm marketing:channels:x:smoke
//   DRY_RUN=1 pnpm marketing:channels:devto:smoke
//   pnpm marketing:channels:devto:smoke
//
// The default channel is 'x'. Override with --channel=devto.

import fs from 'node:fs';
import path from 'node:path';
import { getAdapter, type ChannelId, type Draft } from '../src';

const PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=',
  'base64',
);

function parseChannel(): ChannelId {
  const arg = process.argv.find((a) => a.startsWith('--channel='));
  if (!arg) return 'x';
  const value = arg.split('=')[1];
  if (value !== 'x' && value !== 'devto') {
    throw new Error(`smoke.ts: --channel=${value} not supported. Use x or devto.`);
  }
  return value;
}

function buildXDraft(): Draft {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  if (process.env.SMOKE_THREAD === '1') {
    return {
      channel: 'x',
      threadParts: [
        `Marketing pipeline smoke test — please ignore. (${stamp}) [1/2]`,
        'This is the second tweet of the smoke thread. [2/2]',
      ],
    };
  }
  if (process.env.SMOKE_MEDIA === '1') {
    return {
      channel: 'x',
      text: `Marketing pipeline smoke test with media — please ignore. (${stamp})`,
      media: [{ png: PIXEL_PNG, alt: 'A 1x1 transparent pixel — test image.' }],
    };
  }
  return {
    channel: 'x',
    text: `Marketing pipeline smoke test — please ignore. (${stamp})`,
  };
}

function buildDevToDraft(): Draft {
  const stamp = new Date().toISOString();
  return {
    channel: 'devto',
    text: [
      '# Marketing Pipeline Smoke Test',
      '',
      'This is an automated smoke test of the @ngaf/marketing-channels Dev.to adapter.',
      '',
      `Posted at ${stamp}. Please ignore — this article will be deleted.`,
      '',
      '## Why this exists',
      '',
      'The Cacheplane marketing pipeline syndicates blog content to Dev.to. This run verifies the live wire works end-to-end.',
    ].join('\n'),
    article: {
      title: `Marketing Pipeline Smoke Test — ${stamp}`,
      tags: ['test'],
      canonicalUrl: 'https://cacheplane.ai',
      description: 'Automated smoke test of the Cacheplane marketing pipeline Dev.to adapter.',
    },
  };
}

async function main(): Promise<void> {
  const channel = parseChannel();
  const adapter = getAdapter(channel);
  const draft = channel === 'devto' ? buildDevToDraft() : buildXDraft();
  const result = await adapter.post(draft);
  console.log(JSON.stringify(result, null, 2));

  if (result.url.startsWith('https://dry-run.local')) {
    const outFile = path.join(
      process.cwd(),
      'marketing',
      'cowork',
      'outbox',
      'dry-runs',
      `${result.postId}.json`,
    );
    if (fs.existsSync(outFile)) console.log(`Dry-run file written: ${outFile}`);
  } else if (channel === 'devto' && process.env.SMOKE_METRICS !== '0') {
    // Brief wait so Dev.to has time to index the article before fetching metrics.
    console.log('Sleeping 5s before fetching metrics…');
    await new Promise((r) => setTimeout(r, 5000));
    const metrics = await adapter.metrics(result.postId);
    console.log('Metrics:', JSON.stringify(metrics, null, 2));
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
```

- [ ] **Step 3: Add npm script**

Edit root `package.json` `scripts` block. Find the existing `marketing:channels:x:smoke` line and add immediately after:

```json
"marketing:channels:devto:smoke": "tsx --env-file=.env marketing/channels/scripts/smoke.ts --channel=devto",
```

- [ ] **Step 4: Dry-run sanity check**

```bash
DRY_RUN=1 pnpm marketing:channels:devto:smoke
```

Expected: prints a `PostResult` with `postId` starting `dry-`, `channel: 'devto'`, and a `Dry-run file written:` line.

- [ ] **Step 5: Commit**

```bash
git add marketing/channels/scripts/smoke.ts package.json
git commit -m "feat(marketing/channels): smoke script supports --channel=devto"
```

---

## Task 8: Update `README.md` + `MANUAL-SMOKE.md`

**Files:**
- Modify: `marketing/channels/README.md`
- Modify: `marketing/channels/MANUAL-SMOKE.md`

- [ ] **Step 1: Update README**

In `marketing/channels/README.md`, find the `## Implemented` section and replace it with:

```markdown
## Implemented

- **X** (`getAdapter('x')`) — post single tweets, threads, and image media (PNG ≤ 5MB, alt text required). `metrics()` is a stub until the X tier upgrades to Basic+.
- **Dev.to** (`getAdapter('devto')`) — post articles with title, tags, canonical URL, description. Real `metrics()` (Dev.to's read API is free).
```

In the `## Planned` section, remove `- Dev.to — next` (Dev.to is implemented now). Final list should read:

```markdown
## Planned (follow-up commits in this package — no separate spec)

- LinkedIn
- Reddit
```

Append a new section after the `## Auth (X)` section:

```markdown
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
```

- [ ] **Step 2: Update MANUAL-SMOKE.md**

Append a new section to `marketing/channels/MANUAL-SMOKE.md`:

```markdown

# Dev.to adapter — manual smoke

Run after `DEVTO_API_KEY` is in `.env`.

## 1. Dry-run (no API calls)

```bash
DRY_RUN=1 pnpm marketing:channels:devto:smoke
```

Expect: a JSON `PostResult` with `postId` prefixed `dry-`, `channel: "devto"`, and a file under `marketing/cowork/outbox/dry-runs/`.

## 2. Live article

```bash
pnpm marketing:channels:devto:smoke
```

Expect: a real `https://dev.to/<handle>/<slug>` URL. Open it; confirm the article is published. The script also fetches metrics after a 5-second pause — expect a `Metrics:` block with near-zero counts. **Then delete the article from Dev.to** (Dashboard → ⋯ → Delete).

## If anything fails

Capture the printed error and the part of the JSON response surfaced in the error message. File the result in the PR description.
```

- [ ] **Step 3: Commit**

```bash
git add marketing/channels/README.md marketing/channels/MANUAL-SMOKE.md
git commit -m "docs(marketing/channels): document Dev.to adapter"
```

---

## Task 9: Final build + test verification

**Files:** none (verification only)

- [ ] **Step 1: Build**

```bash
npx nx run marketing-channels:build
```

Expected: green.

- [ ] **Step 2: Run all tests**

```bash
npx nx run marketing-channels:test
```

Expected: green; test count ≥ 45 (33 from PR #425 + ~17 new from this branch — 17 validation tests including the modified existing test, 6 post tests, 4 metrics tests).

- [ ] **Step 3: Confirm website still builds**

```bash
npx nx run website:build
```

Expected: green.

- [ ] **Step 4: Dry-run smoke (sanity check)**

```bash
DRY_RUN=1 pnpm marketing:channels:devto:smoke
```

Expected: prints a `PostResult` with `channel: "devto"` and `postId` starting `dry-`.

- [ ] **Step 5: No commit** — verification only.

---

## Task 10: Push + PR

**Files:** none (PR creation)

- [ ] **Step 1: Confirm PR #425 status before pushing**

```bash
gh pr view 425 --json state,mergedAt
```

- If `state: MERGED`: rebase this branch on main (`git fetch origin main && git rebase origin/main`). Resolve any conflicts (unlikely — this branch only touches files PR #425 created or modified in known patterns).
- If `state: OPEN`: push as-is. The PR will appear as stacked on PR #425.

- [ ] **Step 2: Push**

```bash
git push -u origin marketing-channel-devto
```

- [ ] **Step 3: Open PR**

```bash
gh pr create --title "feat(marketing/channels): Dev.to adapter" --body "$(cat <<'EOF'
## Summary

Follow-up to PR #425 (X channel adapter). Implements the Dev.to adapter behind the same ChannelAdapter interface.

**Changes:**
- Extends \`Draft\` with optional \`article: DraftArticle\` (title, tags, canonicalUrl, description). Future LinkedIn long-form posts will reuse this shape.
- New \`DevToAdapter\` class: single API key auth (\`DEVTO_API_KEY\`), single POST endpoint, real \`metrics()\` (Dev.to's read API is free).
- \`post()\` publishes immediately (\`published: true\`) — Cowork approval is the human gate.
- \`metrics()\` maps \`page_views_count\` → impressions, \`comments_count\` → replies, \`public_reactions_count\` → shares.
- Validation enforces Dev.to's tag rules (\`^[a-z0-9]+$\`, ≤ 4 tags, ≤ 30 chars), 1-128 char title, https-only canonical URL.

**Stacking:** This branch is stacked on \`marketing-channel-adapters\` (PR #425). Merge #425 first, then rebase this branch on main.

Spec: \`docs/superpowers/specs/marketing/2026-05-17-channel-adapter-devto-design.md\`
Plan: \`docs/superpowers/plans/marketing/2026-05-17-channel-adapter-devto.md\`

## Test plan
- [x] \`npx nx run marketing-channels:build\` green
- [x] \`npx nx run marketing-channels:test\` green (~17 new tests, total ≥ 45)
- [x] \`npx nx run website:build\` green
- [x] Dry-run smoke green
- [ ] Brian runs live Dev.to smoke; result pasted below before auto-merge

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: Wait for Brian to run the live smoke**

The controller pauses here and asks Brian to run:

```bash
pnpm marketing:channels:devto:smoke
```

Then delete the test article from Dev.to. Once Brian confirms, enable auto-merge.

- [ ] **Step 5: Enable auto-merge (only after Brian confirms)**

```bash
gh pr merge --auto --squash
```

---

## Self-review

**Spec coverage** (against §13 deliverables):

- ✅ `types.ts` updated with `DraftArticle` — Task 1
- ✅ `validation.ts` adds Dev.to branch — Task 2
- ✅ `validation.spec.ts` adds Dev.to tests — Task 2
- ✅ `devto/index.ts` — Task 5
- ✅ `devto/post.ts` + spec — Task 3
- ✅ `devto/metrics.ts` + spec — Task 4
- ✅ `registry.ts` updated — Task 6
- ✅ `scripts/smoke.ts` extended — Task 7
- ✅ `package.json` script `marketing:channels:devto:smoke` — Task 7
- ✅ `README.md` Dev.to section — Task 8
- ✅ `MANUAL-SMOKE.md` Dev.to section — Task 8
- ✅ Build + test verification — Task 9
- ✅ Live smoke verification — Task 10 PR test plan

**Placeholder scan:** Every code block complete. The only `not yet implemented` strings are intentional (`linkedin`, `reddit`).

**Type consistency:**
- `DraftArticle` defined Task 1; consumed in validation (Task 2), post.ts (Task 3), and smoke script (Task 7).
- `postDevTo(apiKey, draft)` signature consistent between Task 3 (definition) and Task 5 (consumer).
- `fetchDevToMetrics(apiKey, postId)` signature consistent between Task 4 and Task 5.
- All env var names: `DEVTO_API_KEY`.
- Channel id string `'devto'` consistent across Tasks 2, 5, 6, 7.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/marketing/2026-05-17-channel-adapter-devto.md`. Two execution options:

**1. Subagent-Driven (recommended)** — Fresh subagent per task with two-stage review.

**2. Inline Execution** — Execute tasks in this session with batch checkpoints.

Which approach?
