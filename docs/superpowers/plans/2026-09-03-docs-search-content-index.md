# Docs Search Content Index Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make docs page body text searchable, returning results at heading granularity with anchor deep links and highlighted snippets.

**Architecture:** A pure indexer turns MDX source into per-heading section records. A dynamic API route builds that index once per lambda instance and answers queries. The existing client-side title matcher stays as an instant layer; server content hits merge in beneath it.

**Tech Stack:** Next.js App Router (route handlers, RSC), TypeScript, Nx, Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-03-docs-search-content-index-design.md`

---

## Before you start

Read the spec. Then note these repo facts, which are not guessable:

1. **Website tests need an env var.** `GROWTH_FORM_POLICY=growth_v1` or the app throws at import. Every website command below includes it.
2. **Targeted test runs must start from the project directory.** `cd apps/website` first. From the repo root vitest reports "No test files found" and exits 1 — a wrong CWD, not a broken command.
3. **Unused imports are ESLint ERRORS here,** not warnings.
4. **Route specs run in the node environment.** They start with `// @vitest-environment node`. Component specs use `// @vitest-environment jsdom`. Getting this wrong produces confusing failures.
5. **`next dev` does not exercise output file tracing.** Task 5 exists because of that: a route reading `content/docs` at request time works in dev and fails in a real build unless the config is updated.

### The `checkpointer` test fixture, verified

Tasks 4 and 7 both search for `checkpointer` and assert a hit. That choice was checked against real content before the plan was written, so a failing test there means the pipeline is broken, not that the term was a bad guess:

- It appears **16 times** in `apps/website/content/docs/langgraph/guides/persistence.mdx`, **7 of them outside fenced code** — so it survives the indexer's code stripping.
- It appears in the headings `Python: Checkpointer Setup` and `Checkpoint Recovery`, so there is a real anchor for a deep link to land on.
- It is in **no page title anywhere** in `docs-config.ts` — which is exactly why today's title-only search cannot find it, and why the test proves the feature rather than passing trivially.

If a `checkpointer` assertion fails, fix the pipeline. Do not swap in an easier search term.

### Existing signatures you will use

```ts
// apps/website/src/lib/docs.ts
export function getAllDocSlugs(): { library: string; section: string; slug: string }[]
export function getDocBySlug(library: string, section: string, slug: string): ResolvedDoc | null
export function stripFrontmatter(source: string): string
interface ResolvedDoc { page: DocsPage; content: string; body: string; title: string }

// apps/website/src/lib/extract-headings.ts
export function extractHeadings(source: string): DocHeading[]
interface DocHeading { id: string; text: string; level: number }

// apps/website/src/lib/docs-config.ts
export function getLibraryConfig(libraryId: string): DocsLibrary | undefined  // .title is the display name
```

### File structure

| File | Responsibility | Task |
| --- | --- | --- |
| `apps/website/src/lib/docs-search-tokens.ts` | `searchTokens` + `SEARCH_STOP_WORDS`, shared by client and route | 1 |
| `apps/website/src/lib/docs-search-types.ts` | The wire types (`DocSection`, `DocsSearchHit`). **Imports nothing.** | 2 |
| `apps/website/src/lib/docs-search-index.ts` | Pure: MDX source → `DocSection[]`. No I/O. | 2 |
| `apps/website/src/lib/docs-search-query.ts` | Pure: `DocSection[]` + query → ranked `DocsSearchHit[]` with snippets | 3 |
| `apps/website/src/app/api/docs-search/route.ts` | Builds the index once per instance; HTTP concerns only | 4 |
| `apps/website/next.config.ts` | Traces `content/docs` into the deployed function | 5 |
| `apps/website/src/components/docs/DocsSearch.tsx` | Debounced fetch merged under the instant layer | 6 |
| `apps/website/src/styles/docs.css` | Result rows: heading line, snippet, mark | 6 |
| `apps/website/e2e/docs.spec.ts` | Prose-only term lands on the right anchor | 7 |

Splitting indexing (Task 2) from querying (Task 3) is deliberate: both are pure and independently testable, and the route becomes thin enough to reason about.

**Why the types get their own module.** `DocsSearch.tsx` is a client component and needs `DocsSearchHit`. That type would naturally live beside `searchIndexedDocs` — but `docs-search-query.ts` imports `docs-search-index.ts`, which imports `lib/docs.ts`, which imports `fs`. A type-only import is erased at build time so it would work; the moment someone drops the `type` keyword, Node built-ins get pulled into the client bundle. Putting the shared types in a dependency-free module removes the trap instead of documenting it.

**One refinement from the spec.** The spec sketched `DocSection` carrying `library`, `section`, `slug` and `title` on every record. Those are per-page, not per-section, so repeating them on each of a page's records is duplication. The plan keeps `DocSection` to `{heading, anchor, text}` and lifts the page-level fields into `IndexedDoc`, which owns a `sections` array. Same information, no repetition.

---

### Task 1: Share the tokenizer between client and server

`searchTokens` and `SEARCH_STOP_WORDS` live inside `DocsSearch.tsx`, a client component. The route needs identical tokenisation. Two copies would drift the first time someone adds a stop word, and the symptom — a query behaving differently in the instant layer than in server results — would be baffling.

**Files:**
- Create: `apps/website/src/lib/docs-search-tokens.ts`
- Create: `apps/website/src/lib/docs-search-tokens.spec.ts`
- Modify: `apps/website/src/components/docs/DocsSearch.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/website/src/lib/docs-search-tokens.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { searchTokens } from './docs-search-tokens';

describe('searchTokens', () => {
  it('lowercases and splits on non-token characters', () => {
    expect(searchTokens('Streaming Tool Calls')).toEqual(['streaming', 'tool', 'calls']);
  });

  it('keeps the characters that appear in package and API names', () => {
    // @, . and - are token characters so `@threadplane/ag-ui` survives usefully.
    expect(searchTokens('@threadplane/ag-ui')).toEqual(['@threadplane', 'ag-ui']);
  });

  it('drops stop words so "the agent" searches for "agent"', () => {
    expect(searchTokens('the agent')).toEqual(['agent']);
  });

  it('returns nothing for a query that is only stop words', () => {
    expect(searchTokens('of the')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd apps/website && GROWTH_FORM_POLICY=growth_v1 npx vitest run --config vite.config.mts src/lib/docs-search-tokens.spec.ts
```

Expected: FAIL — cannot resolve `./docs-search-tokens`.

- [ ] **Step 3: Create the shared module**

Create `apps/website/src/lib/docs-search-tokens.ts` by moving the two declarations out of `DocsSearch.tsx` verbatim — do not change their behavior in this task:

```ts
/**
 * Query tokenisation, shared by the client-side instant matcher and the
 * server search route.
 *
 * It lives here rather than in the component because both sides must agree on
 * what a query means. Two copies would drift the first time a stop word is
 * added, and the symptom — the same query behaving differently in the instant
 * results than in the server results — is very hard to read.
 */
export const SEARCH_STOP_WORDS = new Set([
  'a', 'an', 'and', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'with',
]);

export function searchTokens(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9@.-]+/)
    .filter((token) => token.length > 0 && !SEARCH_STOP_WORDS.has(token));
}
```

- [ ] **Step 4: Import it in the component**

In `apps/website/src/components/docs/DocsSearch.tsx`, delete the local `SEARCH_STOP_WORDS` and `searchTokens` declarations and add to the imports:

```ts
import { searchTokens } from '../../lib/docs-search-tokens';
```

Leave `searchableText` and `matchesQuery` exactly where they are — they are client-only concerns and stay in the component.

- [ ] **Step 5: Run the tests to verify they pass**

```bash
cd apps/website && GROWTH_FORM_POLICY=growth_v1 npx vitest run --config vite.config.mts src/lib/docs-search-tokens.spec.ts src/components/docs
```

Expected: PASS. This is a pure move, so every existing `DocsSearch` test must still pass untouched. If any fails, the move changed behavior — fix the move, do not adjust the test.

- [ ] **Step 6: Commit**

```bash
git add apps/website/src/lib/docs-search-tokens.ts apps/website/src/lib/docs-search-tokens.spec.ts apps/website/src/components/docs/DocsSearch.tsx
git commit -m "refactor(docs): share the search tokenizer with the server

The route needs identical tokenisation, and two copies would drift the
first time a stop word is added.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: The pure indexer

Turns MDX source into per-heading section records. No I/O, no framework imports.

**Files:**
- Create: `apps/website/src/lib/docs-search-types.ts`
- Create: `apps/website/src/lib/docs-search-index.ts`
- Create: `apps/website/src/lib/docs-search-index.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/website/src/lib/docs-search-index.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { indexDocSections } from './docs-search-index';
import { extractHeadings } from './extract-headings';
import { getAllDocSlugs, getDocBySlug } from './docs';

const SOURCE = `---
description: Frontmatter must not be indexed.
---

# Streaming

Intro prose above the first heading.

## Token deltas

The adapter merges \`TEXT_MESSAGE_CONTENT\` deltas.

\`\`\`ts
const secretCodeToken = 'should-not-be-indexed';
\`\`\`

<Callout type="tip" title="See it live">
Callout body prose is searchable.
</Callout>

<StackDiagram caption="Backend speaks AG-UI over SSE" />
`;

describe('indexDocSections', () => {
  const sections = indexDocSections(SOURCE);
  const preamble = sections.find((s) => s.heading === null);
  const deltas = sections.find((s) => s.heading === 'Token deltas');

  it('emits an anchor-less record for content above the first heading', () => {
    expect(preamble?.anchor).toBeNull();
    expect(preamble?.text).toContain('Intro prose above the first heading');
  });

  it('splits at each heading and anchors it', () => {
    expect(deltas?.anchor).toBe('token-deltas');
    expect(deltas?.text).toContain('The adapter merges');
  });

  it('never indexes frontmatter', () => {
    expect(sections.map((s) => s.text).join(' ')).not.toContain('must not be indexed');
  });

  it('drops fenced code blocks', () => {
    expect(sections.map((s) => s.text).join(' ')).not.toContain('secretCodeToken');
  });

  it('unwraps inline code so API names are searchable as words', () => {
    expect(deltas?.text).toContain('TEXT_MESSAGE_CONTENT');
    expect(deltas?.text).not.toContain('`');
  });

  it('keeps component body prose and caption attributes, not markup', () => {
    const all = sections.map((s) => s.text).join(' ');
    expect(all).toContain('Callout body prose is searchable');
    expect(all).toContain('Backend speaks AG-UI over SSE');
    expect(all).not.toContain('StackDiagram');
    expect(all).not.toContain('data-tone');
  });
});

describe('anchor parity with the rendered table of contents', () => {
  // The load-bearing test. extract-headings hand-rolls slugification, so the
  // only guarantee that a search deep link resolves is that the index and the
  // TOC derive anchors from the same function over the same source. Running it
  // across real content means a heading either tool sections differently fails
  // here rather than shipping a link to nowhere.
  it('emits only anchors the TOC also produces, for every real doc', () => {
    const mismatches: string[] = [];

    for (const { library, section, slug } of getAllDocSlugs()) {
      const doc = getDocBySlug(library, section, slug);
      if (!doc) continue;
      const tocIds = new Set(extractHeadings(doc.body).map((h) => h.id));
      for (const record of indexDocSections(doc.body)) {
        if (record.anchor && !tocIds.has(record.anchor)) {
          mismatches.push(`${library}/${section}/${slug}#${record.anchor}`);
        }
      }
    }

    expect(mismatches).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd apps/website && GROWTH_FORM_POLICY=growth_v1 npx vitest run --config vite.config.mts src/lib/docs-search-index.spec.ts
```

Expected: FAIL — cannot resolve `./docs-search-index`.

- [ ] **Step 3: Create the dependency-free types module**

Create `apps/website/src/lib/docs-search-types.ts`:

```ts
/**
 * Wire types shared by the search route and the client dialog.
 *
 * This module imports nothing on purpose. `DocsSearchHit` would naturally sit
 * beside `searchIndexedDocs`, but that file's dependency chain reaches
 * `lib/docs.ts` and therefore `fs`. A type-only import is erased at build
 * time, so it would work — right up until someone drops the `type` keyword
 * and pulls Node built-ins into the client bundle. Keeping the types here
 * removes that trap rather than commenting on it.
 */

export interface DocSection {
  /** Heading text, or null for content above the first heading. */
  heading: string | null;
  /** Heading id for a deep link, or null for the page preamble. */
  anchor: string | null;
  /** Searchable prose: fenced code removed, inline code unwrapped. */
  text: string;
}

export interface DocsSearchHit {
  href: string;
  title: string;
  heading: string | null;
  libraryTitle: string;
  snippet: string;
  /** [start, end) offsets into `snippet`. The client renders the marks. */
  marks: [number, number][];
}
```

- [ ] **Step 4: Write the indexer**

Create `apps/website/src/lib/docs-search-index.ts`:

```ts
import { stripFrontmatter } from './docs';
import { extractHeadings } from './extract-headings';
import type { DocSection } from './docs-search-types';

export type { DocSection };

/**
 * Fenced code is dropped deliberately: it is roughly half the corpus and
 * mostly noise for ranking. The cost is explicit — an error string that only
 * ever appears inside a code sample will not match. Inline code is kept,
 * because that is where API names appear in sentences.
 */
function toSearchableText(source: string): string {
  return source
    .replace(/```[\s\S]*?```/g, ' ')
    // Self-closing components: keep prose-bearing attributes, drop the rest.
    .replace(/<[A-Z][\w.]*\s[^>]*?\/>/g, (tag) => {
      const prose = [...tag.matchAll(/\b(?:caption|title)="([^"]*)"/g)].map((m) => m[1]);
      return ` ${prose.join(' ')} `;
    })
    // Paired component tags: drop the tags, keep the children between them.
    .replace(/<\/?[A-Z][\w.]*(?:\s[^>]*)?>/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Split a doc body into one record per heading, plus one for the preamble.
 *
 * Anchors come from `extractHeadings` rather than a second slugifier. That
 * file hand-rolls GitHub-style slugification, and having one approximation is
 * a known quantity while two that drift apart is a bug generator.
 */
export function indexDocSections(source: string): DocSection[] {
  const body = stripFrontmatter(source);
  const headings = extractHeadings(body);
  const lines = body.split('\n');

  const sections: DocSection[] = [];
  let current: { heading: string | null; anchor: string | null; lines: string[] } = {
    heading: null,
    anchor: null,
    lines: [],
  };
  let headingIndex = 0;
  let inCodeBlock = false;

  const flush = () => {
    const text = toSearchableText(current.lines.join('\n'));
    if (text.length > 0) {
      sections.push({ heading: current.heading, anchor: current.anchor, text });
    }
  };

  for (const line of lines) {
    // Track fences so a `## ` inside a code sample never starts a section.
    if (line.trim().startsWith('```')) inCodeBlock = !inCodeBlock;

    const match = inCodeBlock ? null : line.match(/^#{2,3}\s+(.+)$/);
    if (match) {
      flush();
      const heading = headings[headingIndex];
      headingIndex += 1;
      current = {
        heading: heading?.text ?? match[1].replace(/`/g, ''),
        anchor: heading?.id ?? null,
        lines: [],
      };
      continue;
    }
    current.lines.push(line);
  }
  flush();

  return sections;
}
```

Note the heading walk consumes `extractHeadings` output positionally. Both functions skip fenced blocks and match the same `^#{2,3}\s+` shape, which is what keeps them aligned — and the anchor-parity test in Step 1 is what proves it over real content rather than by assertion.

- [ ] **Step 5: Run the test to verify it passes**

```bash
cd apps/website && GROWTH_FORM_POLICY=growth_v1 npx vitest run --config vite.config.mts src/lib/docs-search-index.spec.ts
```

Expected: PASS, including the anchor-parity test across all 122 docs.

If anchor parity fails, do NOT relax the assertion — it is the only thing standing between this feature and deep links that 404 to nowhere. Report which files mismatch and why.

- [ ] **Step 6: Commit**

```bash
git add apps/website/src/lib/docs-search-types.ts apps/website/src/lib/docs-search-index.ts apps/website/src/lib/docs-search-index.spec.ts
git commit -m "feat(docs): index doc bodies into per-heading sections

Pure MDX-to-sections indexer: frontmatter and fenced code stripped,
inline code unwrapped, component prose kept. Anchors come from
extract-headings so search deep links cannot drift from the TOC, which
an anchor-parity test pins across all real content.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Ranking and snippets

**Files:**
- Create: `apps/website/src/lib/docs-search-query.ts`
- Create: `apps/website/src/lib/docs-search-query.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/website/src/lib/docs-search-query.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { searchIndexedDocs, type IndexedDoc } from './docs-search-query';

const DOCS: IndexedDoc[] = [
  {
    library: 'langgraph',
    libraryTitle: 'LangGraph',
    section: 'guides',
    slug: 'persistence',
    title: 'Persistence',
    sections: [
      { heading: null, anchor: null, text: 'How threads survive a restart.' },
      {
        heading: 'Production checkpointers',
        anchor: 'production-checkpointers',
        text: 'Use a Postgres checkpointer in production rather than memory.',
      },
    ],
  },
  {
    library: 'chat',
    libraryTitle: 'Chat',
    section: 'guides',
    slug: 'checkpointer',
    title: 'Checkpointer',
    sections: [{ heading: null, anchor: null, text: 'Unrelated prose.' }],
  },
];

describe('searchIndexedDocs', () => {
  it('finds a term that appears only in body prose', () => {
    const hits = searchIndexedDocs(DOCS, 'postgres');
    expect(hits).toHaveLength(1);
    expect(hits[0].href).toBe('/docs/langgraph/guides/persistence#production-checkpointers');
    expect(hits[0].heading).toBe('Production checkpointers');
  });

  it('ranks a title match above a body match', () => {
    const hits = searchIndexedDocs(DOCS, 'checkpointer');
    expect(hits[0].title).toBe('Checkpointer');
  });

  it('links to the page top when the match is in the preamble', () => {
    const hits = searchIndexedDocs(DOCS, 'restart');
    expect(hits[0].href).toBe('/docs/langgraph/guides/persistence');
  });

  it('requires every token, matching the instant layer', () => {
    expect(searchIndexedDocs(DOCS, 'postgres nonexistent')).toEqual([]);
  });

  it('returns nothing for a query of only stop words', () => {
    expect(searchIndexedDocs(DOCS, 'of the')).toEqual([]);
  });

  it('returns a snippet with offsets covering the matched term', () => {
    const [hit] = searchIndexedDocs(DOCS, 'postgres');
    expect(hit.snippet).toContain('Postgres');
    expect(hit.marks.length).toBeGreaterThan(0);
    const [start, end] = hit.marks[0];
    expect(hit.snippet.slice(start, end).toLowerCase()).toBe('postgres');
  });

  it('caps results at eight, matching the existing result list', () => {
    const many: IndexedDoc[] = Array.from({ length: 12 }, (_, i) => ({
      library: 'chat',
      libraryTitle: 'Chat',
      section: 'guides',
      slug: `page-${i}`,
      title: `Page ${i}`,
      sections: [{ heading: null, anchor: null, text: 'streaming prose' }],
    }));
    expect(searchIndexedDocs(many, 'streaming')).toHaveLength(8);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd apps/website && GROWTH_FORM_POLICY=growth_v1 npx vitest run --config vite.config.mts src/lib/docs-search-query.spec.ts
```

Expected: FAIL — cannot resolve `./docs-search-query`.

- [ ] **Step 3: Write the query module**

Create `apps/website/src/lib/docs-search-query.ts`:

```ts
import type { DocSection, DocsSearchHit } from './docs-search-types';
import { searchTokens } from './docs-search-tokens';

export type { DocsSearchHit };

export interface IndexedDoc {
  library: string;
  libraryTitle: string;
  section: string;
  slug: string;
  title: string;
  sections: DocSection[];
}

const MAX_RESULTS = 8;
const SNIPPET_RADIUS = 80;

/** Title matches beat heading matches, which beat body prose. */
const TITLE_WEIGHT = 3;
const HEADING_WEIGHT = 2;
const TEXT_WEIGHT = 1;

function countWeighted(haystack: string, token: string, weight: number): number {
  return haystack.toLowerCase().includes(token) ? weight : 0;
}

/**
 * A window of `text` around the first token match.
 *
 * Offsets are returned rather than HTML so the client wraps the ranges
 * itself — nothing server-built is ever rendered into the page.
 */
function buildSnippet(text: string, tokens: string[]): { snippet: string; marks: [number, number][] } {
  const lower = text.toLowerCase();
  const first = tokens
    .map((token) => lower.indexOf(token))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0] ?? 0;

  const start = Math.max(0, first - SNIPPET_RADIUS);
  const end = Math.min(text.length, first + SNIPPET_RADIUS);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < text.length ? '…' : '';
  const snippet = `${prefix}${text.slice(start, end)}${suffix}`;

  const snippetLower = snippet.toLowerCase();
  const marks: [number, number][] = [];
  for (const token of tokens) {
    let at = snippetLower.indexOf(token);
    while (at >= 0) {
      marks.push([at, at + token.length]);
      at = snippetLower.indexOf(token, at + token.length);
    }
  }
  marks.sort((a, b) => a[0] - b[0]);
  return { snippet, marks };
}

export function searchIndexedDocs(docs: IndexedDoc[], query: string): DocsSearchHit[] {
  const tokens = searchTokens(query);
  if (tokens.length === 0) return [];

  const scored: { score: number; length: number; hit: DocsSearchHit }[] = [];

  for (const doc of docs) {
    for (const section of doc.sections) {
      const haystack = `${doc.title} ${section.heading ?? ''} ${section.text}`.toLowerCase();
      // AND semantics, matching the instant client matcher.
      if (!tokens.every((token) => haystack.includes(token))) continue;

      const score = tokens.reduce(
        (total, token) =>
          total +
          countWeighted(doc.title, token, TITLE_WEIGHT) +
          countWeighted(section.heading ?? '', token, HEADING_WEIGHT) +
          countWeighted(section.text, token, TEXT_WEIGHT),
        0
      );

      const { snippet, marks } = buildSnippet(section.text, tokens);
      scored.push({
        score,
        length: section.text.length,
        hit: {
          href: `/docs/${doc.library}/${doc.section}/${doc.slug}${section.anchor ? `#${section.anchor}` : ''}`,
          title: doc.title,
          heading: section.heading,
          libraryTitle: doc.libraryTitle,
          snippet,
          marks,
        },
      });
    }
  }

  // Higher score first; ties go to the shorter section, which favours a
  // precise heading over a long prose blob.
  scored.sort((a, b) => b.score - a.score || a.length - b.length);
  return scored.slice(0, MAX_RESULTS).map((entry) => entry.hit);
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd apps/website && GROWTH_FORM_POLICY=growth_v1 npx vitest run --config vite.config.mts src/lib/docs-search-query.spec.ts
```

Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/website/src/lib/docs-search-query.ts apps/website/src/lib/docs-search-query.spec.ts
git commit -m "feat(docs): rank indexed doc sections and build snippets

Weighted AND matching over title, heading and prose, capped at eight to
match the existing result list. Snippets return offsets rather than
HTML so the client renders the marks itself.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: The search route

Thin: build the index once per instance, delegate to the query module, set headers.

**Files:**
- Create: `apps/website/src/app/api/docs-search/route.ts`
- Create: `apps/website/src/app/api/docs-search/route.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/website/src/app/api/docs-search/route.spec.ts`:

```ts
// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { GET } from './route';

const call = (q: string) =>
  GET(new Request(`http://localhost/api/docs-search?q=${encodeURIComponent(q)}`));

describe('GET /api/docs-search', () => {
  it('finds a page by a term that appears only in its body prose', async () => {
    // "checkpointer" is prose in the LangGraph persistence guide, and is in no
    // page title — exactly the query the old title-only search could not serve.
    const res = await call('checkpointer');
    expect(res.status).toBe(200);
    const { results } = await res.json();
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r: { href: string }) => r.href.includes('/docs/langgraph/'))).toBe(true);
  });

  it('returns hits that carry a snippet and marks', async () => {
    const { results } = await (await call('checkpointer')).json();
    expect(typeof results[0].snippet).toBe('string');
    expect(Array.isArray(results[0].marks)).toBe(true);
  });

  it('returns empty without scanning for a query under two characters', async () => {
    const { results } = await (await call('a')).json();
    expect(results).toEqual([]);
  });

  it('returns empty for a missing query parameter', async () => {
    const res = await GET(new Request('http://localhost/api/docs-search'));
    const { results } = await res.json();
    expect(results).toEqual([]);
  });

  it('is cacheable, because the corpus only changes on deploy', async () => {
    const res = await call('streaming');
    expect(res.headers.get('cache-control')).toContain('max-age=');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd apps/website && GROWTH_FORM_POLICY=growth_v1 npx vitest run --config vite.config.mts src/app/api/docs-search/route.spec.ts
```

Expected: FAIL — cannot resolve `./route`.

- [ ] **Step 3: Write the route**

Create `apps/website/src/app/api/docs-search/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { getAllDocSlugs, getDocBySlug } from '../../../lib/docs';
import { getLibraryConfig } from '../../../lib/docs-config';
import { indexDocSections } from '../../../lib/docs-search-index';
import { searchIndexedDocs, type IndexedDoc } from '../../../lib/docs-search-query';

const MIN_QUERY_LENGTH = 2;

/**
 * Built once per instance, not per request.
 *
 * This reads MDX from disk at request time, which is why
 * `content/docs/**` has to be traced into the deployed function — see
 * `outputFileTracingIncludes` in next.config.ts. The route cannot be
 * statically generated the way `api/markdown` is, because the query space is
 * unbounded.
 */
let index: IndexedDoc[] | null = null;

function getIndex(): IndexedDoc[] {
  if (index) return index;

  index = getAllDocSlugs().flatMap(({ library, section, slug }) => {
    const doc = getDocBySlug(library, section, slug);
    if (!doc) return [];
    return [
      {
        library,
        libraryTitle: getLibraryConfig(library)?.title ?? library,
        section,
        slug,
        title: doc.title,
        sections: indexDocSections(doc.body),
      },
    ];
  });

  return index;
}

export async function GET(request: Request): Promise<Response> {
  const query = new URL(request.url).searchParams.get('q')?.trim() ?? '';

  if (query.length < MIN_QUERY_LENGTH) {
    return NextResponse.json({ results: [] });
  }

  return NextResponse.json(
    { results: searchIndexedDocs(getIndex(), query) },
    {
      headers: {
        // The corpus only changes on deploy, so repeated queries are served
        // by the CDN rather than waking this function.
        'Cache-Control': 'public, max-age=300',
      },
    }
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd apps/website && GROWTH_FORM_POLICY=growth_v1 npx vitest run --config vite.config.mts src/app/api/docs-search/route.spec.ts
```

Expected: PASS, 5 tests.

If the "checkpointer" test finds nothing, do NOT change the search term to something easier. Confirm the word really is in that guide's prose (`grep -rn "checkpointer" apps/website/content/docs/langgraph/guides/persistence.mdx`) and fix the pipeline. A test tuned until it passes proves nothing.

- [ ] **Step 5: Commit**

```bash
git add apps/website/src/app/api/docs-search/route.ts apps/website/src/app/api/docs-search/route.spec.ts
git commit -m "feat(docs): add the docs content search route

Builds the section index once per instance and answers queries from it.
Short queries return empty without scanning, and responses are
cacheable because the corpus only changes on deploy.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Trace the content into the deployed function

**This is the task that fails in production if skipped, and passes every local test if it is.** `next dev` reads from the working tree, so nothing before this point exercises file tracing.

`apps/website/next.config.ts` traces `cockpit/**` md/py/ts, a Mastra mjs, and `nx.json` — nothing under `apps/website/content`. `api/markdown` reads MDX and deploys fine only because `generateStaticParams()` makes it build-time output. The search route reads at request time.

**Files:**
- Modify: `apps/website/next.config.ts`

- [ ] **Step 1: Add the include**

In `outputFileTracingIncludes`, extend the `'/*'` array with the docs content. Existing entries reach the repo root with `../../`; the content lives inside the app, so it needs no prefix:

```ts
  outputFileTracingIncludes: {
    '/*': [
      '../../cockpit/**/*.md',
      '../../cockpit/**/*.py',
      '../../cockpit/**/*.ts',
      '../../deployments/ag-ui-mastra/*.mjs',
      '../../nx.json',
      // The docs search route reads these at request time. Unlike
      // api/markdown it cannot be statically generated, so without this the
      // route deploys with no corpus and returns empty for every query —
      // silently, and only in production.
      'content/docs/**/*.mdx',
    ],
  },
```

- [ ] **Step 2: Build**

```bash
cd /Users/blove/repos/angular-agent-framework/.claude/worktrees/gallant-clarke-963ed0 && GROWTH_FORM_POLICY=growth_v1 NX_DAEMON=false npx nx build website --outputStyle=static 2>&1 | tail -20
```

Expected: success, with `/api/docs-search` listed as a dynamic (`ƒ`) route rather than static.

- [ ] **Step 3: Verify the trace actually captured the content**

A successful build does not prove the files were traced. Inspect the trace output:

```bash
cd /Users/blove/repos/angular-agent-framework/.claude/worktrees/gallant-clarke-963ed0 && find apps/website/.next -name '*.nft.json' -path '*docs-search*' -exec sh -c 'echo "== $1"; grep -o "content/docs/[^\"]*\.mdx" "$1" | head -3; grep -c "content/docs/" "$1"' _ {} \;
```

Expected: a non-zero count and sample `.mdx` paths. If the count is 0, the glob is wrong — try `./content/docs/**/*.mdx` or an absolute-from-tracing-root form, rebuild, and re-check. **Do not proceed on a successful build alone.**

- [ ] **Step 4: Prove the route works in a production server**

```bash
cd /Users/blove/repos/angular-agent-framework/.claude/worktrees/gallant-clarke-963ed0 && lsof -ti:3100 | xargs -r kill -9
GROWTH_FORM_POLICY=growth_v1 npx next start apps/website --port 3100 &
until curl -sf "http://localhost:3100/api/docs-search?q=checkpointer" >/dev/null 2>&1; do sleep 1; done
curl -s "http://localhost:3100/api/docs-search?q=checkpointer" | head -c 400
```

Expected: JSON with a non-empty `results` array. An empty array here — while the unit test passes — is exactly the tracing failure this task exists to prevent.

Kill the server afterwards: `lsof -ti:3100 | xargs -r kill -9`.

- [ ] **Step 5: Commit**

```bash
git add apps/website/next.config.ts
git commit -m "build(website): trace docs content for the search route

The route reads MDX at request time and cannot be statically generated
the way api/markdown is, so without this it deploys with no corpus and
returns empty for every query -- silently, and only in production.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Merge server hits into the search dialog

The existing client matcher keeps rendering instantly. Server hits arrive underneath.

**Files:**
- Modify: `apps/website/src/components/docs/DocsSearch.tsx`
- Modify: `apps/website/src/styles/docs.css`
- Modify: `apps/website/src/components/docs/DocsSearch.spec.tsx` (create if absent)

- [ ] **Step 1: Write the failing test**

Create or extend `apps/website/src/components/docs/DocsSearch.spec.tsx`:

```tsx
// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DocsSearch } from './DocsSearch';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('../../lib/analytics/client', () => ({ track: vi.fn() }));

const HIT = {
  href: '/docs/langgraph/guides/persistence#production-checkpointers',
  title: 'Persistence',
  heading: 'Production checkpointers',
  libraryTitle: 'LangGraph',
  snippet: 'Use a Postgres checkpointer in production.',
  marks: [[8, 16]] as [number, number][],
};

function openSearch() {
  render(<DocsSearch />);
  fireEvent.keyDown(document, { key: 'k', metaKey: true });
}

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('DocsSearch content results', () => {
  it('renders server hits with their heading and a highlighted snippet', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [HIT] }) })
    );
    openSearch();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'checkpointer' } });

    await waitFor(() => expect(screen.getByText('Production checkpointers')).toBeTruthy());
    // The mark is rendered from offsets, never from server HTML.
    expect(screen.getByText('Postgres').tagName).toBe('MARK');
  });

  it('still shows instant title results when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    openSearch();
    // "quickstart" matches page titles in the client-side index.
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'quickstart' } });

    await waitFor(() => expect(screen.getAllByRole('option').length).toBeGreaterThan(0));
    // A failed search must never surface an error state in the dialog.
    expect(screen.queryByText(/error/i)).toBeNull();
  });

  it('does not request for a query under two characters', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [] }) });
    vi.stubGlobal('fetch', fetchMock);
    openSearch();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'a' } });

    await vi.advanceTimersByTimeAsync(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd apps/website && GROWTH_FORM_POLICY=growth_v1 npx vitest run --config vite.config.mts src/components/docs/DocsSearch.spec.tsx
```

Expected: FAIL — no server results are rendered.

- [ ] **Step 3: Add the fetch and merge**

In `apps/website/src/components/docs/DocsSearch.tsx`, add the imports and state:

```tsx
import type { DocsSearchHit } from '../../lib/docs-search-types';
```

Inside the component, after the existing `results` computation:

```tsx
  const [contentHits, setContentHits] = useState<DocsSearchHit[]>([]);

  // The instant client matcher above renders as you type. These arrive after
  // a round trip and merge in below it, so the fast path stays fast and a
  // slow, failed or offline request degrades to exactly today's behaviour.
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setContentHits([]);
      return undefined;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch(`/api/docs-search?q=${encodeURIComponent(trimmed)}`, {
        signal: controller.signal,
      })
        .then((response) => (response.ok ? response.json() : { results: [] }))
        .then((payload: { results?: DocsSearchHit[] }) => {
          setContentHits(payload.results ?? []);
        })
        .catch(() => {
          // An aborted request means a newer one is already in flight, so
          // clearing here would blank results the new request is about to
          // replace. Only a genuine failure falls back to the instant layer,
          // and it does so silently — search never shows an error state.
          if (!controller.signal.aborted) setContentHits([]);
        });
    }, 150);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);
```

Add the de-duplication and rendering. Place this immediately after the existing `results.map(...)` block, inside the listbox:

```tsx
          {(() => {
            const titleHrefs = new Set(results.map((page) => page.href));
            // A deeper link wins over a page-level one the instant layer
            // already listed; an identical page-level hit is dropped.
            const merged = contentHits.filter(
              (hit) => hit.href.includes('#') || !titleHrefs.has(hit.href)
            );
            if (merged.length === 0) return null;
            return (
              <>
                <div className="docs-search-group-label" role="presentation">
                  In page content
                </div>
                {merged.map((hit, i) => (
                  <button
                    key={hit.href}
                    id={`docs-search-content-opt-${i}`}
                    role="option"
                    aria-selected={false}
                    tabIndex={-1}
                    onClick={() => { router.push(hit.href); setOpen(false); }}
                    className="w-full text-left docs-search-result"
                  >
                    <span className="docs-search-result-title">
                      {hit.heading ?? hit.title}
                    </span>
                    <span className="docs-search-result-lib">
                      {hit.libraryTitle} · {hit.title}
                    </span>
                    <span className="docs-search-result-snippet">
                      {renderSnippet(hit.snippet, hit.marks)}
                    </span>
                  </button>
                ))}
              </>
            );
          })()}
```

Add this helper at module scope in the same file:

```tsx
/**
 * Wrap the matched ranges from server-supplied offsets.
 *
 * The server sends text plus offsets rather than HTML, so nothing it produces
 * is ever rendered as markup.
 */
function renderSnippet(snippet: string, marks: [number, number][]) {
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  for (const [start, end] of marks) {
    if (start < cursor) continue;
    if (start > cursor) parts.push(snippet.slice(cursor, start));
    parts.push(<mark key={start}>{snippet.slice(start, end)}</mark>);
    cursor = end;
  }
  parts.push(snippet.slice(cursor));
  return parts;
}
```

Also change the empty state so it only shows when BOTH lists are empty:

```tsx
          {results.length === 0 && contentHits.length === 0 && (
            <div className="docs-search-empty">
              No results found
            </div>
          )}
```

- [ ] **Step 4: Style the new rows**

Append to `apps/website/src/styles/docs.css`, after the existing `.docs-search-result` rules (find them by name):

```css
/* Content hits: a section heading, its page, and why it matched. */
.docs-search-group-label {
  font-family: var(--font-inter);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-text-muted);
  padding: 10px 14px 4px;
}
.docs-search-result-snippet {
  display: block;
  font-family: var(--font-inter);
  font-size: 12px;
  line-height: 1.5;
  color: var(--color-text-secondary);
  margin-top: 2px;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.docs-search-result-snippet mark {
  background: var(--color-accent-surface);
  color: var(--color-accent);
  border-radius: 3px;
  padding: 0 2px;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
cd apps/website && GROWTH_FORM_POLICY=growth_v1 npx vitest run --config vite.config.mts src/components/docs
```

Expected: PASS, including every pre-existing `DocsSearch` test.

- [ ] **Step 6: Commit**

```bash
git add apps/website/src/components/docs/DocsSearch.tsx apps/website/src/components/docs/DocsSearch.spec.tsx apps/website/src/styles/docs.css
git commit -m "feat(docs): show page-content hits in docs search

Debounced, abortable requests merge server hits beneath the instant
title matches, each showing its section heading and a snippet with the
match highlighted. A failed request falls back to the instant results
rather than surfacing an error.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: End-to-end proof

**Files:**
- Modify: `apps/website/e2e/docs.spec.ts`

- [ ] **Step 1: Write the test**

Append inside the `Docs slug page` describe in `apps/website/e2e/docs.spec.ts`:

```ts
  test('finds a term that appears only in body prose and lands on its section', async ({ page }) => {
    await page.goto(route);
    await page.keyboard.press('Meta+k');

    const dialog = page.getByRole('dialog', { name: 'Search documentation' });
    await expect(dialog).toBeVisible();

    // "checkpointer" is prose inside the persistence guide and is in no page
    // title, so a title-only search returns nothing for it.
    await dialog.getByRole('combobox').fill('checkpointer');

    const hit = dialog.getByRole('option').filter({ hasText: /checkpointer/i }).first();
    await expect(hit).toBeVisible({ timeout: 10000 });
    await hit.click();

    // The deep link must land on a section, not the page top.
    await expect(page).toHaveURL(/\/docs\/langgraph\/.*#.+/);
  });
```

- [ ] **Step 2: Run it**

Free the port first — a stale dev server will either fight Playwright's web server or silently serve an old bundle:

```bash
lsof -ti:3000 | xargs -r kill -9; sleep 1
cd /Users/blove/repos/angular-agent-framework/.claude/worktrees/gallant-clarke-963ed0 && GROWTH_FORM_POLICY=growth_v1 NX_DAEMON=false npx nx e2e website --outputStyle=static --grep "docs" 2>&1 | tail -25
```

Expected: all pass.

If the new test fails on timing, do NOT extend the timeout past 10s to force it green — that hides a real latency problem in the route. Investigate why the response is slow.

- [ ] **Step 3: Commit**

```bash
git add apps/website/e2e/docs.spec.ts
git commit -m "test(website): prove prose-only search reaches its section

Searches a term that exists only in body text and asserts the result
lands on a section anchor rather than the page top.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Full verification

- [ ] **Step 1: Full website suite**

```bash
cd /Users/blove/repos/angular-agent-framework/.claude/worktrees/gallant-clarke-963ed0 && GROWTH_FORM_POLICY=growth_v1 NX_DAEMON=false npx nx test website --outputStyle=static 2>&1 | tail -30
```

Expected: PASS.

- [ ] **Step 2: Lint**

```bash
cd /Users/blove/repos/angular-agent-framework/.claude/worktrees/gallant-clarke-963ed0 && GROWTH_FORM_POLICY=growth_v1 NX_DAEMON=false npx nx lint website --outputStyle=static 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | grep -E "error|problems" | head
```

Strip ANSI before grepping or colored output silently defeats the match. Errors must be zero; pre-existing warnings are fine.

- [ ] **Step 3: Build**

```bash
cd /Users/blove/repos/angular-agent-framework/.claude/worktrees/gallant-clarke-963ed0 && GROWTH_FORM_POLICY=growth_v1 NX_DAEMON=false npx nx build website --outputStyle=static 2>&1 | tail -20
```

Expected: success. If Turbopack panics about the workspace root, a stale dev directory is the cause: `rm -rf apps/website/.next` and re-run.

- [ ] **Step 4: Full e2e**

```bash
lsof -ti:3000 | xargs -r kill -9; sleep 1
cd /Users/blove/repos/angular-agent-framework/.claude/worktrees/gallant-clarke-963ed0 && GROWTH_FORM_POLICY=growth_v1 NX_DAEMON=false npx nx e2e website --outputStyle=static 2>&1 | tail -25
```

Expected: PASS.

- [ ] **Step 5: Confirm the diff**

```bash
cd /Users/blove/repos/angular-agent-framework/.claude/worktrees/gallant-clarke-963ed0 && git status --short && git diff --stat origin/main...HEAD | tail -5
```

`apps/website/.env.local` must NOT appear (it is gitignored). No `.next` or `test-results` artifacts staged.

---

## Notes for the implementer

- **Task order matters once:** Task 1 must land before Tasks 3 and 4, which import the shared tokenizer. Tasks 2 and 3 are independent of each other.
- **Do not weaken the anchor-parity test in Task 2.** It is the only thing preventing deep links to anchors that do not exist.
- **Task 5 cannot be verified by a passing build alone.** Inspect the trace file and hit a production server, as its steps specify.
- **The Browser pane suspends `requestAnimationFrame` and scroll events while hidden**, so a `computer` scroll can time out. Prefer `read_page`, `get_page_text` and `javascript_tool` for verification.
