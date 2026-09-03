# Docs search: index page content — design

Date: 2026-09-03
Status: approved, ready for planning

Docs search matches titles, not documentation. This makes page body text searchable, returns results at heading granularity with anchor deep links, and shows the matching text.

## Why now

PR #986 promoted search to the primary navigation affordance in two places: it leads the control-plane pane on every docs page, and it closes every content page. Before that change search was a `⌘K` shortcut for people who already knew the docs; now it is the front door.

But `DocsSearch` does not search the docs. Its `searchableText()` concatenates `title`, `description`, `slug`, `section` and `libraryTitle` — all of it drawn from `docs-config.ts`. No page body is ever read. Someone searching `checkpointer`, `toAgent`, or an error string pasted from a stack trace gets "No results found" unless the term happens to sit in a page title.

So the front door is a title matcher. That is the gap this closes.

## Constraints found in the codebase

**Content size.** 122 `.mdx` files, ~847KB of raw source. Shipping that to the browser is the thing the delivery decision has to answer.

**`outputFileTracingIncludes` does not cover `content/docs`.** `apps/website/next.config.ts` traces `cockpit/**` md/py/ts, the Mastra deployment mjs, and `nx.json` — nothing under `apps/website/content`. The existing `api/markdown/[library]/[section]/[slug]/route.ts` reads MDX and works anyway *because it declares `generateStaticParams()`*: the files are read at build time and the route ships as static output. A search route cannot be statically generated — the query space is unbounded — so it reads at request time and needs the content traced into the deployed function. This works in `next dev` and fails in production, which makes it the highest-risk item in the change.

**Heading anchors come from an approximation.** `lib/extract-headings.ts` hand-rolls slugification under a comment claiming it matches `rehype-slug`. Real `github-slugger` (which `rehype-slug` uses) de-duplicates repeated headings by appending `-1`, `-2`; this implementation does not. An existing e2e test (`every rail link resolves to a heading in the article`) proves the approximation resolves for today's content, so it is consistent with what actually renders. The index therefore **reuses `extractHeadings`** rather than writing a second slugger — one approximation is a known quantity, two that drift apart is a bug generator.

**No search dependency is installed**, and the existing matcher is hand-rolled token-AND. The design stays in that idiom.

## Decisions

| Question | Decision |
| --- | --- |
| How the index reaches the browser | It does not. A dynamic API route answers queries. |
| Result granularity | Heading-level, deep-linked to the section anchor. |
| What is indexed | Prose and inline code. Fenced code blocks stripped. |
| Result rows | Show a snippet with the matched terms highlighted. |

## Architecture

Three units with clean boundaries.

### 1. `apps/website/src/lib/docs-search-index.ts` — pure

Turns MDX source into section records. No I/O, no framework imports, trivially unit-testable.

```ts
export interface DocSection {
  library: string;
  section: string;
  slug: string;
  /** Page title, for ranking and the result's second line. */
  title: string;
  /** Heading text, or null for content above the first heading. */
  heading: string | null;
  /** `#id` fragment, or null when the record covers the page preamble. */
  anchor: string | null;
  /** Searchable prose: fenced code removed, inline code unwrapped. */
  text: string;
}
```

Sectioning rule: split the body at each `##`/`###`, using `extractHeadings` for both the heading text and its id so anchors match the rendered page by construction. Content before the first heading becomes one record with `heading: null` and `anchor: null`, which is where a page's opening paragraphs live — often the best summary of what the page is about.

Text normalisation, in order: strip frontmatter (reuse `stripFrontmatter` from `lib/docs.ts`), remove fenced code blocks, unwrap inline code so `` `provideAgent` `` indexes as `provideAgent`, handle MDX components, and collapse whitespace.

MDX components need an explicit rule, because the content tree uses them heavily. Drop the tags themselves and keep any text between them — a `<Callout>`'s body is prose and should be searchable. For a self-closing component, index the value of a `caption` or `title` attribute if present (`<StackDiagram caption="Backend speaks AG-UI over SSE…" />` is real prose a reader might search) and discard every other attribute, which is markup configuration rather than content.

Fenced code is dropped deliberately. It is roughly half the bytes and mostly noise for ranking. The cost is explicit: pasting an error string that appears only inside a code sample will not match. Inline code is kept because that is where API names appear in sentences.

### 2. `apps/website/src/app/api/docs-search/route.ts`

Builds the index once at module scope — once per lambda instance, not per request — by walking `getAllDocSlugs()` and `getDocBySlug()` and running each body through the indexer.

Query handling:

- Fewer than 2 characters after trimming: return `{ results: [] }` without scanning.
- Tokenise with the same rules the client already uses. `searchTokens` and `SEARCH_STOP_WORDS` currently live inside `DocsSearch.tsx`, a client component; move both to a shared module (`lib/docs-search-tokens.ts`) that the component and the route import. Sharing the literal function — rather than reimplementing it server-side — is what keeps client and server agreeing on what a query means; two copies would drift the moment a stop word is added.
- Every token must appear, matching today's AND semantics.
- Score by field: page title 3, heading text 2, body prose 1. Sum across tokens; ties break toward the shorter text, which favours a precise heading over a long prose blob.
- Cap at 8, matching the existing result cap.
- `Cache-Control: public, max-age=300` so repeated queries are served by the CDN. The corpus only changes on deploy.

Response shape:

```ts
interface DocsSearchHit {
  href: string;          // /docs/<library>/<section>/<slug>[#anchor]
  title: string;         // page title
  heading: string | null;
  libraryTitle: string;
  snippet: string;
  /** [start, end) offsets into `snippet`, for highlighting. */
  marks: [number, number][];
}
```

Snippets are returned as text plus offsets, never as HTML. The client wraps the ranges itself, so no server-built markup is ever rendered into the page.

### 3. `apps/website/src/components/docs/DocsSearch.tsx`

The existing client-side matcher stays exactly as it is and keeps rendering immediately as the user types. Server hits merge in beneath it when they arrive, under a divider, each row showing its heading and snippet.

This refines the "server per keystroke" decision rather than implementing it literally, and the reason is concrete: today's results are instant. A purely server-driven search would put a network round-trip in front of every result, and the first search of a session would additionally wait on a cold lambda. Keeping the instant layer means the fast path stays fast, and a slow, failed or offline request degrades to precisely today's behaviour instead of an empty box.

Request handling: debounce 150ms, `AbortController` to cancel superseded requests, ignore any response whose query no longer matches the current input. Errors are swallowed — search silently shows the instant results only. A failed fetch must never surface an error state in the dialog.

De-duplication: if the server returns a hit for a page the client matcher already listed, keep the client row and drop the server one unless the server hit carries an anchor, in which case the deeper link wins.

## The production trap

Add `content/docs/**/*.mdx` to `outputFileTracingIncludes` in `apps/website/next.config.ts`.

The exact glob is relative to the app directory — existing entries reach the repo root with `../../` — and **must be verified against a real `nx build website` followed by a production-mode request to the route**, not assumed correct. The failure mode is silent in development: `next dev` reads from the working tree and never exercises tracing.

## Testing

| Suite | Assertion |
| --- | --- |
| `docs-search-index.spec.ts` | sectioning splits on `##`/`###`; preamble becomes an anchor-less record; fenced code removed; inline code retained unwrapped; frontmatter stripped |
| anchor-parity test | every anchor the indexer emits for a file is one `extractHeadings` produces for that same file — search deep links cannot drift from the TOC |
| `route.spec.ts` | a term present only in body prose returns a hit; ranking puts a title match above a prose match; queries under 2 characters return empty; response carries `Cache-Control` |
| `DocsSearch.spec.tsx` | a rejected fetch still renders instant results; a superseded response is discarded; snippet offsets render as marks |
| e2e | search a term that appears only in body prose, land on the correct `#anchor` |

The anchor-parity test is the load-bearing one. It runs over real content, so a heading the indexer sections differently from the TOC fails the build rather than shipping a deep link to nowhere.

## Out of scope

- **Fenced code content.** Excluded by decision above.
- **Real `github-slugger` in `extract-headings.ts`.** It would fix duplicate-heading anchors for both the TOC and search, but it changes rendered TOC behaviour and belongs in its own change. The limitation is accepted here: two `## Overview` headings on one page share an anchor, so a hit may land on the first.
- **Fuzzy matching, stemming, typo tolerance.** The current matcher is exact-substring AND; this keeps that contract. Adding a scoring library is a separate decision.
- **Search analytics beyond what exists.** Noted while reading: `DocsSearch`'s `track()` calls map only `langgraph`/`render`/`chat` to a library name, so `ag-ui`, `a2ui`, `middleware`, `runtimes` and `deep-agents` all record as `unknown`. That is a pre-existing data-quality bug, unrelated to this change, and worth its own fix.
