# Channel Adapters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `@ngaf/marketing-channels` skeleton with a production-ready X adapter behind the meta's `ChannelAdapter` interface, plus the shared infra (validation, HTTP wrapper, dry-run, registry) that all future adapters reuse.

**Architecture:** TDD throughout. Shared infra ships first (Phase 0), then X auth (1), X media (2), X post + adapter class (3), docs + smoke (4), verification + PR (5). Tests use `msw/node` to mock the X API. One-time OAuth bootstrapper CLI prints tokens to stderr for paste-into-`.env`.

**Tech Stack:** TypeScript 5.x, Vitest 4.x, `msw@^2`, `tsx@^4`, Node 22, npm workspaces. No new runtime deps inside the package (only devDeps for testing).

**Spec reference:** `docs/superpowers/specs/marketing/2026-05-17-channel-adapters-design.md`. Branch: `marketing-channel-adapters` (already created in worktree off main).

---

## File Structure

**Existing (from meta-spec, replaced):**

- `marketing/channels/package.json` — modified (add deps, test script)
- `marketing/channels/project.json` — modified (add test target)
- `marketing/channels/src/index.ts` — replaced (currently the skeleton stub; becomes re-exports)

**New:**

- `marketing/channels/vite.config.mts`
- `marketing/channels/src/types.ts`
- `marketing/channels/src/validation.ts` + `.spec.ts`
- `marketing/channels/src/http.ts` + `.spec.ts`
- `marketing/channels/src/dry-run.ts` + `.spec.ts`
- `marketing/channels/src/registry.ts`
- `marketing/channels/src/x/auth.ts` + `.spec.ts`
- `marketing/channels/src/x/auth-cli.ts`
- `marketing/channels/src/x/media.ts`
- `marketing/channels/src/x/post.ts` + `.spec.ts`
- `marketing/channels/src/x/index.ts`
- `marketing/channels/scripts/smoke.ts`
- `marketing/channels/README.md`
- `marketing/channels/MANUAL-SMOKE.md`
- `marketing/cowork/outbox/dry-runs/.gitkeep`

**Modified:**

- `marketing/.env.example` — replace X 1.0a vars with OAuth 2.0 vars
- `package.json` (root) — add `marketing:channels:x:auth` script + `msw` devDep

---

## Task 1: Add devDeps + verify msw

**Files:**
- Modify: `package.json` (root)

- [ ] **Step 1: Confirm msw is in lockfile transitively**

```bash
node -e "console.log(require('msw/package.json').version)"
```

If it errors, install msw as a direct devDep:

```bash
npm install --save-dev msw@^2.4.9 --package-lock-only
npm install --no-audit --no-fund
```

If it prints a version (≥ 2.4.9), still hoist to direct devDep so we don't break when an upstream removes it. Add `"msw": "^2.4.9"` to `devDependencies` in root `package.json` (alphabetical with existing entries).

- [ ] **Step 2: Verify import works**

```bash
node -e "console.log(typeof require('msw/node').setupServer)"
```

Expected: `function`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: hoist msw as direct devDep for channel-adapter tests"
```

---

## Task 2: Vitest config + Nx test target for `marketing-channels`

**Files:**
- Create: `marketing/channels/vite.config.mts`
- Modify: `marketing/channels/project.json`

- [ ] **Step 1: Create `vite.config.mts`**

```ts
import { defineConfig } from 'vite';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

export default defineConfig({
  plugins: [nxViteTsPaths()],
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.spec.ts'],
  },
});
```

- [ ] **Step 2: Add `test` target to `project.json`**

Replace the existing `marketing/channels/project.json` `targets` block with:

```json
"targets": {
  "build": {
    "executor": "@nx/js:tsc",
    "outputs": ["{workspaceRoot}/dist/marketing/channels"],
    "options": {
      "outputPath": "dist/marketing/channels",
      "main": "marketing/channels/src/index.ts",
      "tsConfig": "marketing/channels/tsconfig.lib.json"
    }
  },
  "test": {
    "executor": "@nx/vitest:test",
    "options": {
      "configFile": "marketing/channels/vite.config.mts"
    }
  },
  "lint": {
    "executor": "@nx/eslint:lint"
  }
}
```

(The `build` and `lint` entries are unchanged from the skeleton; the only addition is `test`.)

- [ ] **Step 3: Verify Nx sees the target**

```bash
npx nx show project marketing-channels --json | node -e "let s=''; process.stdin.on('data',c=>s+=c).on('end',()=>console.log(Object.keys(JSON.parse(s).targets)))"
```

Expected: `[ 'build', 'test', 'lint' ]`.

- [ ] **Step 4: Run the empty test target**

```bash
npx nx run marketing-channels:test
```

Expected: "no tests found" success (or similar — vitest exits 0 when no spec files match yet).

- [ ] **Step 5: Commit**

```bash
git add marketing/channels/vite.config.mts marketing/channels/project.json
git commit -m "feat(marketing/channels): add vitest config + Nx test target"
```

---

## Task 3: Extract `types.ts`

**Files:**
- Create: `marketing/channels/src/types.ts`

- [ ] **Step 1: Create `types.ts`**

```ts
// SPDX-License-Identifier: MIT
//
// @ngaf/marketing-channels — public types.

export type ChannelId = 'x' | 'linkedin' | 'devto' | 'reddit';

export interface DraftMedia {
  png: Buffer;
  alt: string;
}

export interface Draft {
  channel: ChannelId;
  text?: string;
  threadParts?: string[];
  media?: DraftMedia[];
  link?: { url: string; previewTitle?: string };
  scheduledAt?: string;
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

- [ ] **Step 2: Commit**

```bash
git add marketing/channels/src/types.ts
git commit -m "feat(marketing/channels): extract types module"
```

---

## Task 4: `validation.ts` + tests (TDD)

**Files:**
- Create: `marketing/channels/src/validation.ts`
- Create: `marketing/channels/src/validation.spec.ts`

- [ ] **Step 1: Write failing tests**

`marketing/channels/src/validation.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { validateDraft, ValidationError } from './validation';
import type { Draft } from './types';

function baseX(): Draft {
  return { channel: 'x', text: 'hello' };
}

describe('validateDraft (X)', () => {
  it('accepts a minimal valid single-tweet draft', () => {
    expect(() => validateDraft(baseX())).not.toThrow();
  });

  it('rejects when both text and threadParts are set', () => {
    const d: Draft = { channel: 'x', text: 'hi', threadParts: ['a', 'b'] };
    expect(() => validateDraft(d)).toThrow(ValidationError);
    try {
      validateDraft(d);
    } catch (e) {
      expect((e as ValidationError).rule).toBe('exclusive-text-thread');
    }
  });

  it('rejects when neither text nor threadParts is set', () => {
    const d: Draft = { channel: 'x' };
    expect(() => validateDraft(d)).toThrow(/either text or threadParts/i);
  });

  it('rejects text > 280 chars', () => {
    const d: Draft = { channel: 'x', text: 'a'.repeat(281) };
    expect(() => validateDraft(d)).toThrow(/280/);
  });

  it('accepts text of exactly 280 chars', () => {
    const d: Draft = { channel: 'x', text: 'a'.repeat(280) };
    expect(() => validateDraft(d)).not.toThrow();
  });

  it('counts Unicode code points, not bytes, for length', () => {
    // 4-byte UTF-8 emoji is 1 code point. 280 of them = 280 code points.
    const d: Draft = { channel: 'x', text: '🎉'.repeat(280) };
    expect(() => validateDraft(d)).not.toThrow();
  });

  it('rejects threadParts length < 2', () => {
    const d: Draft = { channel: 'x', threadParts: ['only one'] };
    expect(() => validateDraft(d)).toThrow(/at least 2/i);
  });

  it('rejects any threadParts[i] > 280 chars', () => {
    const d: Draft = { channel: 'x', threadParts: ['ok', 'a'.repeat(281)] };
    expect(() => validateDraft(d)).toThrow(/280/);
  });

  it('rejects > 4 media', () => {
    const m = { png: Buffer.from('a'), alt: 'x' };
    const d: Draft = { channel: 'x', text: 'hi', media: [m, m, m, m, m] };
    expect(() => validateDraft(d)).toThrow(/at most 4 media/i);
  });

  it('rejects empty alt text', () => {
    const d: Draft = {
      channel: 'x',
      text: 'hi',
      media: [{ png: Buffer.from('a'), alt: '' }],
    };
    expect(() => validateDraft(d)).toThrow(/alt text/i);
  });

  it('rejects alt text > 1000 chars', () => {
    const d: Draft = {
      channel: 'x',
      text: 'hi',
      media: [{ png: Buffer.from('a'), alt: 'a'.repeat(1001) }],
    };
    expect(() => validateDraft(d)).toThrow(/1000/);
  });

  it('rejects PNG > 5 MB', () => {
    const d: Draft = {
      channel: 'x',
      text: 'hi',
      media: [{ png: Buffer.alloc(5 * 1024 * 1024 + 1), alt: 'x' }],
    };
    expect(() => validateDraft(d)).toThrow(/5 ?MB/i);
  });

  it('rejects unknown channel for X adapter sanity check', () => {
    const d: Draft = { channel: 'linkedin' as 'x', text: 'hi' };
    expect(() => validateDraft(d, { adapterId: 'x' })).toThrow(/channel mismatch/i);
  });
});

describe('validateDraft (other channels)', () => {
  it('throws not-yet-implemented for linkedin/devto/reddit', () => {
    for (const channel of ['linkedin', 'devto', 'reddit'] as const) {
      const d: Draft = { channel, text: 'hi' };
      expect(() => validateDraft(d)).toThrow(/not yet implemented/i);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx nx run marketing-channels:test
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `validation.ts`**

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

function codePointLength(s: string): number {
  // Counts Unicode code points (handles surrogate pairs correctly).
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
    case 'linkedin':
    case 'devto':
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

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx nx run marketing-channels:test
```

Expected: PASS, 14 tests.

- [ ] **Step 5: Commit**

```bash
git add marketing/channels/src/validation.ts marketing/channels/src/validation.spec.ts
git commit -m "feat(marketing/channels): add validateDraft + ValidationError"
```

---

## Task 5: `http.ts` + tests (TDD)

**Files:**
- Create: `marketing/channels/src/http.ts`
- Create: `marketing/channels/src/http.spec.ts`

- [ ] **Step 1: Write failing tests**

`marketing/channels/src/http.spec.ts`:

```ts
import { describe, expect, it, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http as mswHttp, HttpResponse } from 'msw';
import { http } from './http';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('http()', () => {
  it('returns parsed JSON on 2xx', async () => {
    server.use(
      mswHttp.get('https://api.example.test/ping', () =>
        HttpResponse.json({ ok: true }),
      ),
    );
    const result = await http<{ ok: boolean }>({
      method: 'GET',
      url: 'https://api.example.test/ping',
    });
    expect(result).toEqual({ ok: true });
  });

  it('retries on 5xx then succeeds', async () => {
    let calls = 0;
    server.use(
      mswHttp.get('https://api.example.test/flaky', () => {
        calls++;
        if (calls < 2) return new HttpResponse(null, { status: 503 });
        return HttpResponse.json({ ok: true });
      }),
    );
    const result = await http<{ ok: boolean }>({
      method: 'GET',
      url: 'https://api.example.test/flaky',
    });
    expect(result).toEqual({ ok: true });
    expect(calls).toBe(2);
  });

  it('exhausts retries on persistent 5xx and throws', async () => {
    let calls = 0;
    server.use(
      mswHttp.get('https://api.example.test/dead', () => {
        calls++;
        return new HttpResponse(null, { status: 500 });
      }),
    );
    await expect(
      http({ method: 'GET', url: 'https://api.example.test/dead' }),
    ).rejects.toThrow(/HTTP 500/);
    expect(calls).toBe(3); // initial + 2 retries
  });

  it('calls on401 hook and retries when hook returns retry: true', async () => {
    let calls = 0;
    let hookCalled = 0;
    server.use(
      mswHttp.get('https://api.example.test/auth', () => {
        calls++;
        if (calls === 1) return new HttpResponse(null, { status: 401 });
        return HttpResponse.json({ ok: true });
      }),
    );
    const result = await http<{ ok: boolean }>({
      method: 'GET',
      url: 'https://api.example.test/auth',
      on401: async () => {
        hookCalled++;
        return { retry: true };
      },
    });
    expect(result).toEqual({ ok: true });
    expect(hookCalled).toBe(1);
    expect(calls).toBe(2);
  });

  it('throws when on401 hook returns retry: false', async () => {
    server.use(
      mswHttp.get('https://api.example.test/auth2', () =>
        new HttpResponse(null, { status: 401 }),
      ),
    );
    await expect(
      http({
        method: 'GET',
        url: 'https://api.example.test/auth2',
        on401: async () => ({ retry: false }),
      }),
    ).rejects.toThrow(/HTTP 401/);
  });

  it('throws on non-JSON response with non-2xx', async () => {
    server.use(
      mswHttp.get('https://api.example.test/html', () =>
        new HttpResponse('<html>error</html>', { status: 500 }),
      ),
    );
    await expect(
      http({
        method: 'GET',
        url: 'https://api.example.test/html',
        retryOn5xx: false,
      }),
    ).rejects.toThrow(/HTTP 500/);
  });

  it('respects timeoutMs', async () => {
    server.use(
      mswHttp.get('https://api.example.test/slow', async () => {
        await new Promise((r) => setTimeout(r, 200));
        return HttpResponse.json({ ok: true });
      }),
    );
    await expect(
      http({
        method: 'GET',
        url: 'https://api.example.test/slow',
        timeoutMs: 50,
        retryOn5xx: false,
      }),
    ).rejects.toThrow(/aborted|timeout/i);
  });
});
```

- [ ] **Step 2: Run tests — they fail (module not found)**

```bash
npx nx run marketing-channels:test
```

- [ ] **Step 3: Implement `http.ts`**

```ts
// SPDX-License-Identifier: MIT

export interface HttpOpts {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  url: string;
  headers?: Record<string, string>;
  body?: BodyInit;
  timeoutMs?: number;
  retryOn5xx?: boolean;
  on401?: () => Promise<{ retry: true } | { retry: false }>;
}

const DEFAULT_TIMEOUT_MS = 20_000;
const RETRY_DELAYS_MS = [500, 1500];

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function doFetch(opts: HttpOpts): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    return await fetch(opts.url, {
      method: opts.method,
      headers: opts.headers,
      body: opts.body,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function http<T = unknown>(opts: HttpOpts): Promise<T> {
  const retryOn5xx = opts.retryOn5xx !== false;
  let lastError: Error | undefined;

  // Initial attempt + retries on 5xx
  const maxAttempts = retryOn5xx ? RETRY_DELAYS_MS.length + 1 : 1;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let res: Response;
    try {
      res = await doFetch(opts);
    } catch (err) {
      lastError = err as Error;
      if (attempt < maxAttempts - 1) {
        await sleep(RETRY_DELAYS_MS[attempt]);
        continue;
      }
      throw lastError;
    }

    if (res.status === 401 && opts.on401) {
      const result = await opts.on401();
      if (result.retry) {
        const retryRes = await doFetch(opts);
        return await parseOrThrow<T>(retryRes);
      }
      throw await toError(retryRes ?? res);
    }

    if (res.status >= 500 && retryOn5xx && attempt < maxAttempts - 1) {
      await sleep(RETRY_DELAYS_MS[attempt]);
      lastError = await toError(res);
      continue;
    }

    return await parseOrThrow<T>(res);
  }

  throw lastError ?? new Error('http: exhausted retries without an error');
}

async function parseOrThrow<T>(res: Response): Promise<T> {
  if (res.status >= 200 && res.status < 300) {
    const text = await res.text();
    if (text.length === 0) return undefined as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(`HTTP ${res.status}: non-JSON response: ${text.slice(0, 200)}`);
    }
  }
  throw await toError(res);
}

async function toError(res: Response): Promise<Error> {
  const body = await res.text().catch(() => '');
  return new Error(`HTTP ${res.status}: ${body.slice(0, 500)}`);
}
```

- [ ] **Step 4: Run tests — they pass**

```bash
npx nx run marketing-channels:test
```

Expected: PASS, all http + previous validation tests.

- [ ] **Step 5: Commit**

```bash
git add marketing/channels/src/http.ts marketing/channels/src/http.spec.ts
git commit -m "feat(marketing/channels): add http() wrapper with retry + 401 hook"
```

---

## Task 6: `dry-run.ts` + tests (TDD)

**Files:**
- Create: `marketing/channels/src/dry-run.ts`
- Create: `marketing/channels/src/dry-run.spec.ts`

- [ ] **Step 1: Write failing tests**

`marketing/channels/src/dry-run.spec.ts`:

```ts
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { writeDryRunResult } from './dry-run';
import type { Draft } from './types';

let cwd: string;
let origCwd: string;

beforeEach(() => {
  origCwd = process.cwd();
  cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'dry-run-test-'));
  process.chdir(cwd);
});

afterEach(() => {
  process.chdir(origCwd);
  fs.rmSync(cwd, { recursive: true, force: true });
});

describe('writeDryRunResult', () => {
  it('writes a JSON file under marketing/cowork/outbox/dry-runs and returns a synthetic PostResult', async () => {
    const draft: Draft = { channel: 'x', text: 'hello' };
    const result = await writeDryRunResult(draft);

    expect(result.channel).toBe('x');
    expect(result.postId).toMatch(/^dry-[0-9a-f-]{36}$/);
    expect(result.url).toBe(`https://dry-run.local/x/${result.postId}`);
    expect(typeof result.postedAt).toBe('string');

    const outFile = path.join(
      cwd,
      'marketing',
      'cowork',
      'outbox',
      'dry-runs',
      `${result.postId}.json`,
    );
    expect(fs.existsSync(outFile)).toBe(true);
    const parsed = JSON.parse(fs.readFileSync(outFile, 'utf8'));
    expect(parsed.draft).toEqual({ channel: 'x', text: 'hello' });
    expect(typeof parsed.simulatedAt).toBe('string');
  });

  it('serializes Buffer media as base64 strings to keep the file portable', async () => {
    const draft: Draft = {
      channel: 'x',
      text: 'hi',
      media: [{ png: Buffer.from('hello'), alt: 'h' }],
    };
    const result = await writeDryRunResult(draft);
    const outFile = path.join(
      cwd,
      'marketing',
      'cowork',
      'outbox',
      'dry-runs',
      `${result.postId}.json`,
    );
    const parsed = JSON.parse(fs.readFileSync(outFile, 'utf8'));
    expect(parsed.draft.media[0].png).toBe('aGVsbG8='); // base64('hello')
    expect(parsed.draft.media[0].alt).toBe('h');
  });
});
```

- [ ] **Step 2: Run tests — fail**

```bash
npx nx run marketing-channels:test
```

- [ ] **Step 3: Implement `dry-run.ts`**

```ts
// SPDX-License-Identifier: MIT
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import type { Draft, PostResult } from './types';

function serializeDraft(draft: Draft): unknown {
  if (!draft.media || draft.media.length === 0) return draft;
  return {
    ...draft,
    media: draft.media.map((m) => ({
      png: m.png.toString('base64'),
      alt: m.alt,
    })),
  };
}

export async function writeDryRunResult(draft: Draft): Promise<PostResult> {
  const id = `dry-${crypto.randomUUID()}`;
  const outDir = path.join(process.cwd(), 'marketing', 'cowork', 'outbox', 'dry-runs');
  await fs.mkdir(outDir, { recursive: true });
  const file = path.join(outDir, `${id}.json`);
  await fs.writeFile(
    file,
    JSON.stringify(
      { draft: serializeDraft(draft), simulatedAt: new Date().toISOString() },
      null,
      2,
    ),
  );
  return {
    channel: draft.channel,
    postId: id,
    url: `https://dry-run.local/${draft.channel}/${id}`,
    postedAt: new Date().toISOString(),
  };
}
```

- [ ] **Step 4: Run tests — pass**

```bash
npx nx run marketing-channels:test
```

- [ ] **Step 5: Commit**

```bash
git add marketing/channels/src/dry-run.ts marketing/channels/src/dry-run.spec.ts
git commit -m "feat(marketing/channels): add writeDryRunResult"
```

---

## Task 7: `x/auth.ts` + tests (TDD)

**Files:**
- Create: `marketing/channels/src/x/auth.ts`
- Create: `marketing/channels/src/x/auth.spec.ts`

- [ ] **Step 1: Write failing tests**

`marketing/channels/src/x/auth.spec.ts`:

```ts
import { describe, expect, it, beforeAll, afterAll, afterEach, beforeEach, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { http as mswHttp, HttpResponse } from 'msw';
import { XAuth } from './auth';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const env = {
  X_CLIENT_ID: 'cid',
  X_CLIENT_SECRET: 'csec',
  X_ACCESS_TOKEN: 'access-1',
  X_REFRESH_TOKEN: 'refresh-1',
  X_USER_HANDLE: 'brian',
};

let origEnv: NodeJS.ProcessEnv;
beforeEach(() => {
  origEnv = { ...process.env };
  Object.assign(process.env, env);
});
afterEach(() => {
  process.env = origEnv;
});

describe('XAuth construction', () => {
  it('reads required env vars', () => {
    const auth = new XAuth();
    expect(auth.userHandle).toBe('brian');
    expect(auth.accessToken).toBe('access-1');
  });

  it('throws with the list of missing env vars', () => {
    delete process.env.X_ACCESS_TOKEN;
    delete process.env.X_USER_HANDLE;
    expect(() => new XAuth()).toThrow(/X_ACCESS_TOKEN, X_USER_HANDLE/);
  });
});

describe('XAuth.refresh', () => {
  it('refreshes on demand and updates in-memory tokens', async () => {
    server.use(
      mswHttp.post('https://api.x.com/2/oauth2/token', async ({ request }) => {
        const body = await request.text();
        expect(body).toContain('grant_type=refresh_token');
        expect(body).toContain('refresh_token=refresh-1');
        const authHeader = request.headers.get('authorization');
        expect(authHeader).toMatch(/^Basic /);
        return HttpResponse.json({
          access_token: 'access-2',
          refresh_token: 'refresh-2',
          token_type: 'bearer',
          expires_in: 7200,
        });
      }),
    );
    const auth = new XAuth();
    await auth.refresh();
    expect(auth.accessToken).toBe('access-2');
    expect(auth.refreshToken).toBe('refresh-2');
  });

  it('prints the new refresh token to stderr after a successful refresh', async () => {
    server.use(
      mswHttp.post('https://api.x.com/2/oauth2/token', () =>
        HttpResponse.json({
          access_token: 'access-2',
          refresh_token: 'refresh-2',
          token_type: 'bearer',
          expires_in: 7200,
        }),
      ),
    );
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const auth = new XAuth();
    await auth.refresh();
    expect(spy).toHaveBeenCalled();
    const written = spy.mock.calls.map((c) => String(c[0])).join('');
    expect(written).toContain('refresh-2');
    spy.mockRestore();
  });

  it('throws with bootstrapper hint when refresh fails', async () => {
    server.use(
      mswHttp.post('https://api.x.com/2/oauth2/token', () =>
        new HttpResponse('{"error":"invalid_grant"}', { status: 400 }),
      ),
    );
    const auth = new XAuth();
    await expect(auth.refresh()).rejects.toThrow(/marketing:channels:x:auth/);
  });
});
```

- [ ] **Step 2: Run tests — fail**

```bash
npx nx run marketing-channels:test
```

- [ ] **Step 3: Implement `x/auth.ts`**

```ts
// SPDX-License-Identifier: MIT
import { http } from '../http';

const TOKEN_URL = 'https://api.x.com/2/oauth2/token';

const REQUIRED_ENV = [
  'X_CLIENT_ID',
  'X_CLIENT_SECRET',
  'X_ACCESS_TOKEN',
  'X_REFRESH_TOKEN',
  'X_USER_HANDLE',
] as const;

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type: 'bearer';
  expires_in: number;
};

export class XAuth {
  public accessToken: string;
  public refreshToken: string;
  public readonly userHandle: string;
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor() {
    const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
    if (missing.length > 0) {
      throw new Error(`X adapter missing env vars: ${missing.join(', ')}`);
    }
    this.clientId = process.env.X_CLIENT_ID!;
    this.clientSecret = process.env.X_CLIENT_SECRET!;
    this.accessToken = process.env.X_ACCESS_TOKEN!;
    this.refreshToken = process.env.X_REFRESH_TOKEN!;
    this.userHandle = process.env.X_USER_HANDLE!;
  }

  async refresh(): Promise<void> {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: this.refreshToken,
    });
    const basic = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    let tokens: TokenResponse;
    try {
      tokens = await http<TokenResponse>({
        method: 'POST',
        url: TOKEN_URL,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${basic}`,
        },
        body: params.toString(),
        retryOn5xx: false,
      });
    } catch (err) {
      throw new Error(
        `X access token expired and refresh failed — re-run \`pnpm marketing:channels:x:auth\`. Underlying: ${(err as Error).message}`,
      );
    }
    this.accessToken = tokens.access_token;
    this.refreshToken = tokens.refresh_token;
    process.stderr.write(
      `\n✓ X refresh successful. Update your .env to keep the new refresh token across restarts:\n  X_ACCESS_TOKEN=${tokens.access_token}\n  X_REFRESH_TOKEN=${tokens.refresh_token}\n\n`,
    );
  }
}
```

- [ ] **Step 4: Run tests — pass**

```bash
npx nx run marketing-channels:test
```

- [ ] **Step 5: Commit**

```bash
git add marketing/channels/src/x/auth.ts marketing/channels/src/x/auth.spec.ts
git commit -m "feat(marketing/channels): X auth state machine with refresh"
```

---

## Task 8: `x/auth-cli.ts` (one-time bootstrapper)

**Files:**
- Create: `marketing/channels/src/x/auth-cli.ts`

- [ ] **Step 1: Implement the CLI**

```ts
// SPDX-License-Identifier: MIT
// One-time OAuth 2.0 bootstrapper for the X adapter.
// Run via: pnpm marketing:channels:x:auth

import http from 'node:http';
import crypto from 'node:crypto';
import { exec } from 'node:child_process';

const PORT = 8723;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;
const SCOPES = 'tweet.read tweet.write users.read offline.access media.write';
const AUTHORIZE_URL = 'https://x.com/i/oauth2/authorize';
const TOKEN_URL = 'https://api.x.com/2/oauth2/token';
const USERS_ME_URL = 'https://api.x.com/2/users/me';
const TIMEOUT_MS = 5 * 60 * 1000;

function fail(msg: string): never {
  process.stderr.write(`✗ ${msg}\n`);
  process.exit(1);
}

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function openInBrowser(url: string): void {
  const cmd =
    process.platform === 'darwin'
      ? `open "${url}"`
      : process.platform === 'win32'
        ? `start "" "${url}"`
        : `xdg-open "${url}"`;
  exec(cmd, () => {
    /* best-effort; user can copy-paste */
  });
}

async function main(): Promise<void> {
  const clientId = process.env.X_CLIENT_ID;
  const clientSecret = process.env.X_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    fail(
      'X_CLIENT_ID and X_CLIENT_SECRET must be set in your environment.\n' +
        'Create an app at https://developer.x.com/en/portal/dashboard and copy the OAuth 2.0 Client ID and Secret to your .env.',
    );
  }

  const verifier = b64url(crypto.randomBytes(32));
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
  const state = b64url(crypto.randomBytes(16));

  const authorizeUrl = new URL(AUTHORIZE_URL);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('client_id', clientId);
  authorizeUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authorizeUrl.searchParams.set('scope', SCOPES);
  authorizeUrl.searchParams.set('state', state);
  authorizeUrl.searchParams.set('code_challenge', challenge);
  authorizeUrl.searchParams.set('code_challenge_method', 'S256');

  process.stdout.write(`\nOpening browser to authorize Cacheplane marketing app...\n${authorizeUrl.toString()}\n\n`);
  openInBrowser(authorizeUrl.toString());

  const result = await new Promise<{ code: string }>((resolve, reject) => {
    const timer = setTimeout(() => {
      server.close();
      reject(new Error('Timed out waiting for OAuth callback after 5 minutes.'));
    }, TIMEOUT_MS);

    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
      if (url.pathname !== '/callback') {
        res.writeHead(404).end();
        return;
      }
      const code = url.searchParams.get('code');
      const returnedState = url.searchParams.get('state');
      if (returnedState !== state) {
        res.writeHead(400).end('state mismatch');
        clearTimeout(timer);
        server.close();
        reject(new Error('OAuth state parameter mismatch.'));
        return;
      }
      if (!code) {
        res.writeHead(400).end('missing code');
        clearTimeout(timer);
        server.close();
        reject(new Error('OAuth callback missing code parameter.'));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' }).end(
        '<html><body><h1>Got it — you can close this tab.</h1></body></html>',
      );
      clearTimeout(timer);
      server.close();
      resolve({ code });
    });
    server.listen(PORT);
  });

  const tokenParams = new URLSearchParams({
    grant_type: 'authorization_code',
    code: result.code,
    redirect_uri: REDIRECT_URI,
    code_verifier: verifier,
    client_id: clientId,
  });
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const tokenRes = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basic}`,
    },
    body: tokenParams.toString(),
  });
  if (!tokenRes.ok) {
    fail(`Token exchange failed: HTTP ${tokenRes.status} ${await tokenRes.text()}`);
  }
  const tokens = (await tokenRes.json()) as {
    access_token: string;
    refresh_token: string;
  };

  const meRes = await fetch(USERS_ME_URL, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!meRes.ok) {
    fail(`Failed to fetch /users/me: HTTP ${meRes.status}`);
  }
  const me = (await meRes.json()) as { data: { username: string } };

  process.stdout.write(
    `\n✓ Got tokens. Add these to .env:\n\n` +
      `X_ACCESS_TOKEN=${tokens.access_token}\n` +
      `X_REFRESH_TOKEN=${tokens.refresh_token}\n` +
      `X_USER_HANDLE=${me.data.username}\n\n`,
  );
  process.exit(0);
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
```

- [ ] **Step 2: Add script to root `package.json`**

In root `package.json` `scripts` block (alphabetical with existing entries), add:

```json
"marketing:channels:x:auth": "tsx marketing/channels/src/x/auth-cli.ts",
```

- [ ] **Step 3: Sanity-check the CLI loads (doesn't crash on missing env)**

```bash
unset X_CLIENT_ID
unset X_CLIENT_SECRET
npx tsx marketing/channels/src/x/auth-cli.ts || echo "exit=$?"
```

Expected: prints `✗ X_CLIENT_ID and X_CLIENT_SECRET must be set...` and exits 1. (`exit=1`.)

- [ ] **Step 4: Commit**

```bash
git add marketing/channels/src/x/auth-cli.ts package.json
git commit -m "feat(marketing/channels): X OAuth 2.0 bootstrapper CLI"
```

---

## Task 9: `x/media.ts`

**Files:**
- Create: `marketing/channels/src/x/media.ts`

- [ ] **Step 1: Implement media upload**

```ts
// SPDX-License-Identifier: MIT
import { http } from '../http';
import type { XAuth } from './auth';

const UPLOAD_URL = 'https://api.x.com/2/media/upload';
const METADATA_URL = 'https://api.x.com/2/media/metadata';

interface UploadResponse {
  data: { id: string; media_key: string };
}

export async function uploadMedia(
  auth: XAuth,
  png: Buffer,
  alt: string,
): Promise<string> {
  const form = new FormData();
  form.append('media_category', 'tweet_image');
  form.append('media', new Blob([png], { type: 'image/png' }), 'image.png');

  const response = await http<UploadResponse>({
    method: 'POST',
    url: UPLOAD_URL,
    headers: { Authorization: `Bearer ${auth.accessToken}` },
    body: form,
    on401: async () => {
      await auth.refresh();
      return { retry: true };
    },
  });

  const mediaId = response.data.id;

  await http({
    method: 'POST',
    url: METADATA_URL,
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id: mediaId, metadata: { alt_text: { text: alt } } }),
    on401: async () => {
      await auth.refresh();
      return { retry: true };
    },
  });

  return mediaId;
}
```

- [ ] **Step 2: Verify typecheck**

```bash
npx tsc --noEmit -p marketing/channels/tsconfig.lib.json
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add marketing/channels/src/x/media.ts
git commit -m "feat(marketing/channels): X media upload via /2/media/upload"
```

---

## Task 10: `x/post.ts` + tests (TDD)

**Files:**
- Create: `marketing/channels/src/x/post.ts`
- Create: `marketing/channels/src/x/post.spec.ts`

- [ ] **Step 1: Write failing tests**

`marketing/channels/src/x/post.spec.ts`:

```ts
import { describe, expect, it, beforeAll, afterAll, afterEach, beforeEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http as mswHttp, HttpResponse } from 'msw';
import { postX } from './post';
import { XAuth } from './auth';
import type { Draft } from '../types';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

let origEnv: NodeJS.ProcessEnv;
beforeEach(() => {
  origEnv = { ...process.env };
  Object.assign(process.env, {
    X_CLIENT_ID: 'cid',
    X_CLIENT_SECRET: 'csec',
    X_ACCESS_TOKEN: 'access-1',
    X_REFRESH_TOKEN: 'refresh-1',
    X_USER_HANDLE: 'brian',
  });
});
afterEach(() => {
  process.env = origEnv;
});

describe('postX', () => {
  it('posts a single tweet with no media', async () => {
    let receivedBody: unknown;
    server.use(
      mswHttp.post('https://api.x.com/2/tweets', async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json({ data: { id: '1001', text: 'hello' } });
      }),
    );
    const auth = new XAuth();
    const draft: Draft = { channel: 'x', text: 'hello' };
    const result = await postX(auth, draft);
    expect(receivedBody).toEqual({ text: 'hello' });
    expect(result.postId).toBe('1001');
    expect(result.url).toBe('https://x.com/brian/status/1001');
    expect(result.channel).toBe('x');
  });

  it('posts a single tweet with media (uploads first, attaches media_ids)', async () => {
    let mediaCalls = 0;
    let metadataCalls = 0;
    let tweetBody: { text: string; media?: { media_ids: string[] } } | undefined;
    server.use(
      mswHttp.post('https://api.x.com/2/media/upload', () => {
        mediaCalls++;
        return HttpResponse.json({ data: { id: 'media-7', media_key: 'mk' } });
      }),
      mswHttp.post('https://api.x.com/2/media/metadata', () => {
        metadataCalls++;
        return HttpResponse.json({ data: { ok: true } });
      }),
      mswHttp.post('https://api.x.com/2/tweets', async ({ request }) => {
        tweetBody = (await request.json()) as typeof tweetBody;
        return HttpResponse.json({ data: { id: '1002', text: 'hi' } });
      }),
    );
    const auth = new XAuth();
    const draft: Draft = {
      channel: 'x',
      text: 'hi',
      media: [{ png: Buffer.from('a'), alt: 'alt-1' }],
    };
    const result = await postX(auth, draft);
    expect(mediaCalls).toBe(1);
    expect(metadataCalls).toBe(1);
    expect(tweetBody).toEqual({ text: 'hi', media: { media_ids: ['media-7'] } });
    expect(result.postId).toBe('1002');
  });

  it('posts a thread with 3 parts, chaining reply.in_reply_to_tweet_id', async () => {
    const tweetBodies: { text: string; reply?: { in_reply_to_tweet_id: string } }[] = [];
    let counter = 100;
    server.use(
      mswHttp.post('https://api.x.com/2/tweets', async ({ request }) => {
        const body = (await request.json()) as (typeof tweetBodies)[0];
        tweetBodies.push(body);
        counter++;
        return HttpResponse.json({ data: { id: String(counter), text: body.text } });
      }),
    );
    const auth = new XAuth();
    const draft: Draft = {
      channel: 'x',
      threadParts: ['part-0', 'part-1', 'part-2'],
    };
    const result = await postX(auth, draft);
    expect(tweetBodies).toEqual([
      { text: 'part-0' },
      { text: 'part-1', reply: { in_reply_to_tweet_id: '101' } },
      { text: 'part-2', reply: { in_reply_to_tweet_id: '102' } },
    ]);
    expect(result.postId).toBe('101'); // first tweet
    expect(result.url).toBe('https://x.com/brian/status/101');
  });

  it('attaches media only to the first tweet in a thread', async () => {
    const tweetBodies: { text: string; media?: { media_ids: string[] }; reply?: { in_reply_to_tweet_id: string } }[] = [];
    let counter = 200;
    server.use(
      mswHttp.post('https://api.x.com/2/media/upload', () =>
        HttpResponse.json({ data: { id: 'm-1', media_key: 'mk' } }),
      ),
      mswHttp.post('https://api.x.com/2/media/metadata', () =>
        HttpResponse.json({ data: { ok: true } }),
      ),
      mswHttp.post('https://api.x.com/2/tweets', async ({ request }) => {
        const body = (await request.json()) as (typeof tweetBodies)[0];
        tweetBodies.push(body);
        counter++;
        return HttpResponse.json({ data: { id: String(counter), text: body.text } });
      }),
    );
    const auth = new XAuth();
    const draft: Draft = {
      channel: 'x',
      threadParts: ['p0', 'p1'],
      media: [{ png: Buffer.from('a'), alt: 'a' }],
    };
    await postX(auth, draft);
    expect(tweetBodies[0].media).toEqual({ media_ids: ['m-1'] });
    expect(tweetBodies[1].media).toBeUndefined();
  });

  it('returns a dry-run result when DRY_RUN=1 and skips HTTP', async () => {
    server.use(
      mswHttp.post('https://api.x.com/2/tweets', () => {
        throw new Error('should not be called during dry-run');
      }),
    );
    process.env.DRY_RUN = '1';
    try {
      const auth = new XAuth();
      const draft: Draft = { channel: 'x', text: 'hello' };
      const result = await postX(auth, draft);
      expect(result.postId).toMatch(/^dry-/);
      expect(result.url).toMatch(/dry-run\.local/);
    } finally {
      delete process.env.DRY_RUN;
    }
  });
});
```

- [ ] **Step 2: Run tests — fail**

```bash
npx nx run marketing-channels:test
```

- [ ] **Step 3: Implement `post.ts`**

```ts
// SPDX-License-Identifier: MIT
import { http } from '../http';
import { writeDryRunResult } from '../dry-run';
import type { Draft, PostResult } from '../types';
import type { XAuth } from './auth';
import { uploadMedia } from './media';

const TWEETS_URL = 'https://api.x.com/2/tweets';

interface TweetResponse {
  data: { id: string; text: string };
}

interface TweetRequestBody {
  text: string;
  media?: { media_ids: string[] };
  reply?: { in_reply_to_tweet_id: string };
}

async function postTweet(auth: XAuth, body: TweetRequestBody): Promise<string> {
  const response = await http<TweetResponse>({
    method: 'POST',
    url: TWEETS_URL,
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    on401: async () => {
      await auth.refresh();
      return { retry: true };
    },
  });
  return response.data.id;
}

export async function postX(auth: XAuth, draft: Draft): Promise<PostResult> {
  if (process.env.DRY_RUN === '1') {
    return writeDryRunResult(draft);
  }

  let mediaIds: string[] = [];
  if (draft.media && draft.media.length > 0) {
    for (const m of draft.media) {
      mediaIds.push(await uploadMedia(auth, m.png, m.alt));
    }
  }

  let firstId: string;

  if (draft.threadParts) {
    const firstBody: TweetRequestBody = { text: draft.threadParts[0] };
    if (mediaIds.length > 0) firstBody.media = { media_ids: mediaIds };
    firstId = await postTweet(auth, firstBody);

    let prevId = firstId;
    for (let i = 1; i < draft.threadParts.length; i++) {
      prevId = await postTweet(auth, {
        text: draft.threadParts[i],
        reply: { in_reply_to_tweet_id: prevId },
      });
    }
  } else {
    const body: TweetRequestBody = { text: draft.text! };
    if (mediaIds.length > 0) body.media = { media_ids: mediaIds };
    firstId = await postTweet(auth, body);
  }

  return {
    channel: 'x',
    postId: firstId,
    url: `https://x.com/${auth.userHandle}/status/${firstId}`,
    postedAt: new Date().toISOString(),
  };
}
```

- [ ] **Step 4: Run tests — pass**

```bash
npx nx run marketing-channels:test
```

Expected: all post tests + earlier tests pass.

- [ ] **Step 5: Commit**

```bash
git add marketing/channels/src/x/post.ts marketing/channels/src/x/post.spec.ts
git commit -m "feat(marketing/channels): X post + thread + media composition"
```

---

## Task 11: `x/index.ts` — XAdapter class

**Files:**
- Create: `marketing/channels/src/x/index.ts`

- [ ] **Step 1: Implement XAdapter**

```ts
// SPDX-License-Identifier: MIT
import type { ChannelAdapter, Draft, PostMetrics, PostResult } from '../types';
import { validateDraft } from '../validation';
import { XAuth } from './auth';
import { postX } from './post';

export class XAdapter implements ChannelAdapter {
  readonly id = 'x' as const;
  private readonly auth: XAuth;

  constructor() {
    this.auth = new XAuth();
  }

  async post(draft: Draft): Promise<PostResult> {
    validateDraft(draft, { adapterId: 'x' });
    return postX(this.auth, draft);
  }

  async metrics(postId: string): Promise<PostMetrics> {
    // X read endpoints unavailable on Free/pay-per-use tier (May 2026).
    // When tier upgrades to Basic+, replace with GET /2/tweets/{id}?tweet.fields=public_metrics.
    return { postId, fetchedAt: new Date().toISOString() };
  }
}
```

- [ ] **Step 2: Verify typecheck**

```bash
npx tsc --noEmit -p marketing/channels/tsconfig.lib.json
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add marketing/channels/src/x/index.ts
git commit -m "feat(marketing/channels): add XAdapter class"
```

---

## Task 12: `registry.ts`

**Files:**
- Create: `marketing/channels/src/registry.ts`

- [ ] **Step 1: Implement registry**

```ts
// SPDX-License-Identifier: MIT
import type { ChannelAdapter, ChannelId } from './types';
import { XAdapter } from './x';

const KNOWN: ChannelId[] = ['x', 'linkedin', 'devto', 'reddit'];

const instances = new Map<ChannelId, ChannelAdapter>();

function buildAdapter(id: ChannelId): ChannelAdapter {
  switch (id) {
    case 'x':
      return new XAdapter();
    case 'linkedin':
    case 'devto':
    case 'reddit':
      throw new Error(
        `Channel "${id}" adapter is not yet implemented. Known channels with implementations: x.`,
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

- [ ] **Step 2: Commit**

```bash
git add marketing/channels/src/registry.ts
git commit -m "feat(marketing/channels): registry + getAdapter()"
```

---

## Task 13: Rewrite `src/index.ts` as re-exports

**Files:**
- Modify: `marketing/channels/src/index.ts`

- [ ] **Step 1: Replace skeleton with re-exports**

Overwrite `marketing/channels/src/index.ts`:

```ts
// SPDX-License-Identifier: MIT
//
// @ngaf/marketing-channels — public API.
// See docs/superpowers/specs/marketing/2026-05-17-channel-adapters-design.md

export type {
  Draft,
  DraftMedia,
  PostResult,
  PostMetrics,
  ChannelAdapter,
  ChannelId,
} from './types';

export { validateDraft, ValidationError } from './validation';

export { getAdapter } from './registry';
```

- [ ] **Step 2: Verify nothing breaks**

```bash
npx nx run marketing-channels:build
```

Expected: green. `dist/marketing/channels/index.js` exports the listed symbols.

- [ ] **Step 3: Commit**

```bash
git add marketing/channels/src/index.ts
git commit -m "feat(marketing/channels): public API surface"
```

---

## Task 14: Update `marketing/.env.example` for OAuth 2.0

**Files:**
- Modify: `marketing/.env.example`

- [ ] **Step 1: Replace the X section**

Replace the existing X block in `marketing/.env.example`:

```
# X / Twitter
X_API_KEY=
X_API_SECRET=
X_ACCESS_TOKEN=
X_ACCESS_SECRET=
```

with:

```
# X / Twitter (OAuth 2.0 with PKCE — see marketing/channels/README.md)
X_CLIENT_ID=
X_CLIENT_SECRET=
X_ACCESS_TOKEN=
X_REFRESH_TOKEN=
X_USER_HANDLE=
```

Leave the LinkedIn / Dev.to / Reddit blocks untouched (those adapters land later).

- [ ] **Step 2: Commit**

```bash
git add marketing/.env.example
git commit -m "docs(marketing): update X env vars to OAuth 2.0"
```

---

## Task 15: `marketing/channels/README.md`

**Files:**
- Create: `marketing/channels/README.md`

- [ ] **Step 1: Write the README**

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add marketing/channels/README.md
git commit -m "docs(marketing/channels): add package README"
```

---

## Task 16: `marketing/channels/MANUAL-SMOKE.md` + `scripts/smoke.ts`

**Files:**
- Create: `marketing/channels/MANUAL-SMOKE.md`
- Create: `marketing/channels/scripts/smoke.ts`

- [ ] **Step 1: Write smoke script**

`marketing/channels/scripts/smoke.ts`:

```ts
// Standalone smoke runner for the X adapter. NOT exported by the package.
// Usage:
//   pnpm marketing:channels:x:auth          # one-time, fills .env
//   DRY_RUN=1 npx tsx marketing/channels/scripts/smoke.ts
//   npx tsx marketing/channels/scripts/smoke.ts
//   SMOKE_MEDIA=1 npx tsx marketing/channels/scripts/smoke.ts
//   SMOKE_THREAD=1 npx tsx marketing/channels/scripts/smoke.ts

import fs from 'node:fs';
import path from 'node:path';
import { getAdapter, type Draft } from '../src';

// 1x1 transparent PNG.
const PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=',
  'base64',
);

function buildDraft(): Draft {
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

async function main(): Promise<void> {
  const adapter = getAdapter('x');
  const draft = buildDraft();
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
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
```

- [ ] **Step 2: Write `MANUAL-SMOKE.md`**

```markdown
# X adapter — manual smoke

Run after the bootstrapper has populated `.env`.

## 1. Dry-run (no API calls)

```bash
DRY_RUN=1 npx tsx marketing/channels/scripts/smoke.ts
```

Expect: a JSON `PostResult` printed with `postId` prefixed `dry-` and a file under `marketing/cowork/outbox/dry-runs/`.

## 2. Live single tweet

```bash
npx tsx marketing/channels/scripts/smoke.ts
```

Expect: a real `https://x.com/<handle>/status/<id>` URL. Open it; confirm the post is on the timeline. **Then delete the post from the X UI.**

## 3. Live tweet with media

```bash
SMOKE_MEDIA=1 npx tsx marketing/channels/scripts/smoke.ts
```

Expect: the post has a 1×1 transparent pixel attached with the alt text. Delete after verifying.

## 4. Live thread

```bash
SMOKE_THREAD=1 npx tsx marketing/channels/scripts/smoke.ts
```

Expect: two tweets posted; the second is a reply to the first. Delete both.

## If anything fails

Capture the printed error message and any response body in the error. Note which step failed. File the result in the PR description so future maintainers see what shape of breakage they need to handle.
```

- [ ] **Step 3: Commit**

```bash
git add marketing/channels/scripts/smoke.ts marketing/channels/MANUAL-SMOKE.md
git commit -m "docs(marketing/channels): manual smoke recipe + script"
```

---

## Task 17: `dry-runs/.gitkeep`

**Files:**
- Create: `marketing/cowork/outbox/dry-runs/.gitkeep`

- [ ] **Step 1: Create the placeholder**

```bash
mkdir -p marketing/cowork/outbox/dry-runs
touch marketing/cowork/outbox/dry-runs/.gitkeep
```

- [ ] **Step 2: Add a gitignore so generated dry-run JSONs don't get committed**

`marketing/cowork/outbox/dry-runs/.gitignore`:

```
*.json
!.gitkeep
```

- [ ] **Step 3: Commit**

```bash
git add marketing/cowork/outbox/dry-runs/
git commit -m "feat(marketing/cowork): dry-runs dir + gitignore for generated JSON"
```

---

## Task 18: Final build + test verification

**Files:** none (verification only)

- [ ] **Step 1: Build**

```bash
npx nx run marketing-channels:build
```

Expected: green. `dist/marketing/channels/` populated.

- [ ] **Step 2: Run all tests**

```bash
npx nx run marketing-channels:test
```

Expected: all tests pass (≥ 30 tests across validation, http, dry-run, auth, post).

- [ ] **Step 3: Confirm no leftover skeleton throws are reachable**

```bash
grep -rn "renderCard\|getAdapter().*not yet implemented" marketing/channels/src/ | head
```

The only "not yet implemented" should be for `linkedin`/`devto`/`reddit` (intentional). `renderCard` shouldn't appear (that's the assets package).

- [ ] **Step 4: Confirm nothing else in the repo broke**

```bash
npx nx run website:build
```

Expected: green.

- [ ] **Step 5: No commit** — verification only.

---

## Task 19: Push + PR

**Files:** none (PR creation)

- [ ] **Step 1: Push**

```bash
git push -u origin marketing-channel-adapters
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --title "feat(marketing/channels): X adapter (OAuth 2.0, threads, media) + shared infra" --body "$(cat <<'EOF'
## Summary

Sub-spec 2 of the marketing umbrella. Replaces the @ngaf/marketing-channels skeleton with a real X adapter plus shared infra.

**Shared infra (reused by future LinkedIn/Dev.to/Reddit adapters):**
- `types.ts` — Draft, PostResult, PostMetrics, ChannelAdapter, ChannelId
- `validation.ts` — channel-aware `validateDraft()` with hard-reject behavior
- `http.ts` — fetch wrapper with timeout, retry on 5xx, 401-refresh hook
- `dry-run.ts` — DRY_RUN=1 writes to marketing/cowork/outbox/dry-runs/
- `registry.ts` — `getAdapter(id)` resolves from a static map

**X adapter:**
- OAuth 2.0 User Context with PKCE (corrected from initial OAuth 1.0a assumption)
- v2 /2/media/upload endpoint (not v1.1 chunked)
- One-time bootstrapper CLI: `pnpm marketing:channels:x:auth`
- Auto-refresh on 401; new refresh token printed to stderr for `.env` update
- Single tweet + threads + image media (PNG ≤ 5MB, alt text required)
- `metrics()` stubbed (X tier has no read endpoints; comment points at the upgrade path)

**Tests:**
- ≥ 30 unit tests with msw mocking the X API
- Coverage on validation rules + post body composition + 401-refresh path

**Manual smoke:**
- See `marketing/channels/MANUAL-SMOKE.md` for live verification recipe (4 scenarios)

Spec: \`docs/superpowers/specs/marketing/2026-05-17-channel-adapters-design.md\`
Plan: \`docs/superpowers/plans/marketing/2026-05-17-channel-adapters.md\`

## Test plan
- [ ] \`npx nx run marketing-channels:build\` green
- [ ] \`npx nx run marketing-channels:test\` green
- [ ] \`npx nx run website:build\` green
- [ ] Brian runs manual smoke (single tweet + media + thread); paste results below before merge

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Enable auto-merge on green (after Brian confirms manual smoke)**

```bash
gh pr merge --auto --squash
```

---

## Self-review

**Spec coverage** (against §13 deliverables in the spec):

- ✅ `types.ts` — Task 3
- ✅ `validation.ts` + spec — Task 4
- ✅ `http.ts` + spec — Task 5
- ✅ `dry-run.ts` + spec — Task 6
- ✅ `registry.ts` — Task 12
- ✅ `x/auth.ts` + spec — Task 7
- ✅ `x/auth-cli.ts` — Task 8
- ✅ `x/media.ts` — Task 9
- ✅ `x/post.ts` + spec — Task 10
- ✅ `x/index.ts` — Task 11
- ✅ `src/index.ts` rewritten — Task 13
- ✅ `scripts/smoke.ts` — Task 16
- ✅ `vite.config.mts` — Task 2
- ✅ `project.json` test target — Task 2
- ✅ `MANUAL-SMOKE.md` — Task 16
- ✅ `README.md` — Task 15
- ✅ `.env.example` updated — Task 14
- ✅ Root `package.json` script — Task 8 step 2
- ✅ `dry-runs/.gitkeep` — Task 17
- ✅ Build + test verification — Task 18
- ✅ Manual smoke verification — Task 19 PR test plan

**Placeholder scan:** All code blocks complete. All commands explicit. The only `not yet implemented` strings are intentional (the three deferred channels).

**Type consistency:**
- `Draft`, `DraftMedia`, `PostResult`, `PostMetrics`, `ChannelAdapter`, `ChannelId` defined once in Task 3 and consumed unchanged in Tasks 4, 6, 10, 11, 12, 13.
- `XAuth` class defined Task 7; consumed in Tasks 9, 10, 11.
- `validateDraft(draft, opts?)` signature consistent between Task 4 (definition) and Task 11 (consumer).
- `http<T>(opts: HttpOpts)` signature consistent between Task 5 (definition) and Tasks 7, 9, 10 (consumers).
- All env var names consistent across Tasks 7, 8, 14, 15: `X_CLIENT_ID`, `X_CLIENT_SECRET`, `X_ACCESS_TOKEN`, `X_REFRESH_TOKEN`, `X_USER_HANDLE`.
- `getAdapter(id)` and adapter `.id` property are consistent strings (`'x'`).

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/marketing/2026-05-17-channel-adapters.md`. Two execution options:

**1. Subagent-Driven (recommended)** — Fresh subagent per task with two-stage review between each.

**2. Inline Execution** — Execute tasks in this session using executing-plans with batch checkpoints.

Which approach?
