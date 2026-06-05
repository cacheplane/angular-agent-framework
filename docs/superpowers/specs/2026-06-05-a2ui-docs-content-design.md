# a2ui Docs Fill — Design

**Date:** 2026-06-05
**Status:** Draft for review
**Scope:** Fill out `@threadplane/a2ui` documentation — a Quickstart, three guides, and an accuracy fix to the schema reference — written in Brian's voice (highly-technical register), grounded in the real exported API and the real cockpit booking-form example. First of three "thin-library" content efforts (licensing, telemetry follow later).

## Goal

`@threadplane/a2ui` (the A2UI protocol/types library) ships only 3 docs pages
(intro + 2 reference pages), no quickstart, no task guides. This spec adds a
Quickstart and three guides so a developer can actually use the library — parse
a stream, work with the data model, and build/validate A2UI payloads — and fixes
a stale version reference.

Every page is **grounded in real code**: the exported API (`libs/a2ui/src`),
the library's own tests, and the real A2UI stream emitted by the cockpit
booking-form example (`cockpit/chat/a2ui/`). **No invented API, no invented
message shapes.**

## Voice

Apply Brian's structural + sentence-level patterns from `docs/gtm/voice.md`, in
the **highly-technical register**:

- Opening: title restated as a one-line lede. No "Introduction" header.
- Contractions ("it's", "let's", "don't"). One thought per line; short paragraphs.
- Tutorial pages (Quickstart): a `## Goals` block near the top, "Let's"
  transitions, an explicit `## Conclusion`.
- Concept/guide pages: H2-as-question where it fits ("## What's a surface?"),
  answered immediately.
- Opinions flagged ("For me", "In my experience") and paired with a tradeoff.

**Excluded** (technical register): no emojis, no anecdotes, no folksy asides, no
hype ("blazing", "game-changing"). Substance over warmth. This matches the
standing note that 2026 technical content uses the trimmed register.

## The version decision (applies to every page)

Google's A2UI protocol uses **v0.8** (envelope names `beginRendering`,
`surfaceUpdate`, `dataModelUpdate`, `deleteSurface` — which this library uses)
and **v0.9** (which renamed three of them). `@threadplane/a2ui` is versioned
independently and is documented as **v1** — the outbound `A2uiActionMessage` sets
`version: 'v1'` in source (`libs/a2ui/src/lib/types.ts`).

Per the maintainer's decision, **align everything on `v1`**:

- All new pages present the Threadplane A2UI wire format and action message as
  **v1**.
- Each page that frames the protocol notes, accurately, that Threadplane
  implements Google's open **A2UI** protocol (declarative, catalog-based:
  surfaces, a per-surface data model, dynamic values, outbound actions) and links
  the upstream references — **without** claiming numbering parity with Google's
  v0.8/v0.9. Threadplane's implementation version is v1.
- Authoritative upstream links: `https://a2ui.org` and
  `https://github.com/google/A2UI`.

## Pages

### 1. Quickstart — `getting-started/quickstart` (new)

Tutorial register. Goal: from zero to parsing a real A2UI stream and reading a
resolved value.

- Lede: one sentence ("Parse an A2UI stream and read its resolved values with
  `@threadplane/a2ui`.").
- `## Goals`: install; parse a JSONL stream with `createA2uiMessageParser()`;
  apply `dataModelUpdate` into a plain object with `setByPointer`; read a
  component's dynamic prop with `resolveDynamic`.
- Steps use the **real booking-form stream** (abbreviated): the three envelopes
  in emission order (`dataModelUpdate` → `surfaceUpdate` → `beginRendering`),
  from `cockpit/chat/a2ui/` (`graph.py` `_wrap_envelopes`). Show
  `parser.push(text)` returning `A2uiMessage[]`, and the partial-stream behavior
  (text without a trailing `\n` buffers).
- Show `resolveDynamic({ path: '/origin' }, model)` → value, and a literal
  (`{ literalString: 'Book a flight' }`) → value. Snippets adapted from
  `libs/a2ui/src/lib/{parser,resolve,pointer}.spec.ts`.
- `## Conclusion`: one paragraph; link onward to the three guides.
- Note: rendering A2UI surfaces in Angular lives in `@threadplane/chat`
  (`<a2ui-surface>`) — link there; this library is the protocol/parse/resolve
  layer.

### 2. Guide — "The A2UI message protocol" — `guides/message-protocol` (new Guides section)

Concept register (H2-as-question). What the four envelopes are and how they fit.

- Surfaces (independent regions, each with its own component set + data model).
- Components as an **id-keyed adjacency list** (not a nested tree); the
  `{ "<Name>": { ...props } }` keyed-union shape; children via
  `explicitList` vs `template`/`dataBinding`.
- The per-surface **data model** and **dynamic values**: literal wrappers
  (`literalString`/`literalNumber`/`literalBoolean`/`literalArray`) vs path refs
  (`{ path: '/origin' }`).
- The four envelopes with a real example each (from the booking-form stream):
  `surfaceUpdate`, `dataModelUpdate` (typed `contents` entries:
  `valueString`/`valueNumber`/`valueBoolean`/`valueMap`), `beginRendering`
  (names the `root`), `deleteSurface`.
- Outbound **actions**: the `A2uiActionMessage` (**`version: 'v1'`**, `action`
  with `name`/`surfaceId`/`sourceComponentId`/`timestamp`/`context`/`label?`,
  optional `metadata.a2uiClientDataModel`). Use the real booking submit example.
- A short, accurate "Relationship to Google's A2UI" subsection with the version
  note + upstream links.

### 3. Guide — "Working with the data model" — `guides/data-model` (new)

Task register. The pointer helpers + resolution.

- `getByPointer` / `setByPointer` / `deleteByPointer`: JSON-Pointer-style paths,
  **immutability** (`set`/`delete` return a structurally-shared clone; original
  untouched), intermediate creation on `set`, delete-returns-original-on-missing
  -parent, and the one caveat: **no RFC-6901 `~0`/`~1` unescaping**.
- `resolveDynamic(value, model, scope?)`: unwrap order (literals first, then
  `{ path }`), arrays mapped recursively, plain values passed through, missing
  paths → `undefined`.
- `A2uiScope` and **template children**: relative paths resolve against
  `scope.basePath`; show the `template`/`dataBinding` per-item pattern
  (`basePath: \`${arrPath}/${i}\``). Note `scope.item` is typed but unused.
- Snippets verbatim-adapted from `pointer.spec.ts` / `resolve.spec.ts`.

### 4. Guide — "Validating and adapting an A2UI stream" — `guides/adapters-and-validation` (new)

Task register. The library's actual audience (per the intro: "building an
adapter, validating an agent stream, testing A2UI payloads, integrating a custom
renderer").

- Consume a streaming agent response: feed chunks to `parser.push`, handle the
  conservative-fallback posture (malformed lines skipped, unknown envelope keys
  ignored, partial JSON buffered until newline) — quote the real behavior from
  `parser.ts`.
- Validate/type-narrow payloads with the exported guards
  (`isPathRef`, `isLiteralString`, `isLiteralNumber`, `isLiteralBoolean`).
- Build/test A2UI payloads against the exported types (e.g. assembling a
  `surfaceUpdate` + `dataModelUpdate` + `beginRendering` sequence for a test).
- Integrate a custom renderer: resolve props with `resolveDynamic` + the data
  model; note that the Threadplane Angular renderer is `@threadplane/chat`'s
  `<a2ui-surface>` (link), and this library is what an alternative renderer would
  build on.
- Honest tradeoff: the parser intentionally swallows parse errors (good for
  streaming, so validate separately if you need strictness).

### 5. Fix — `reference/schema.mdx` (accuracy)

- Change `A2uiActionMessage.version` from `'v0.9'` → **`'v1'`** (matches source).
- Add the `action.label?: string` field (present in `types.ts`, missing from the
  doc).

### 6. Docs-wide v0.9 → v1 alignment (sweep)

Update the stray `v0.9` A2UI references in the website docs to `v1` for
consistency, where they refer to the Threadplane action-message/version (not to
an upstream protocol citation):

- `apps/website/content/docs/render/a2ui/overview.mdx`
- `apps/website/content/docs/render/a2ui/catalog.mdx`
- `apps/website/content/docs/render/concepts/json-render-vs-a2ui.mdx`

(Leave `chat/api/api-docs.json` — it's generated. Any reference that is explicitly
citing Google's protocol version stays accurate to Google.)

## Plumbing

- **Modify** `apps/website/src/lib/docs-config.ts`: add to the `a2ui` library a
  `Quick Start` page under Getting Started, and a new **Guides** section with the
  three guide pages (slugs: `message-protocol`, `data-model`,
  `adapters-and-validation`). Order: Getting Started (Introduction, Quick Start)
  → Guides (Message Protocol, Data Model, Validating & Adapting) → Reference
  (Schema, Parser/Resolver/Guards).
- **Create** the four MDX files under `apps/website/content/docs/a2ui/...`.
- No new components; reuse `Callout`, `Steps`/`Step`, `CodeGroup`, `Card`/
  `CardGroup` as helpful.

## Testing & verification

- **Build/route:** each new page renders at its `/docs/a2ui/...` route (HTTP 200);
  the a2ui sidebar shows the new Quick Start + Guides; prev/next links resolve.
- **e2e:** extend `apps/website/e2e/docs.spec.ts` with a check that
  `/docs/a2ui/getting-started/quickstart` renders (breadcrumb + article + sidebar)
  and that the a2ui nav lists the new guide titles.
- **llms-full / search:** new pages are picked up automatically (they enumerate
  from `docs-config`); no extra work, but verify the quickstart appears in the
  ⌘K title search.
- **Accuracy gate (required):** every code snippet and API claim is checked
  against `libs/a2ui/src` before commit. After drafting, **the maintainer reviews
  the MDX for technical accuracy and voice** before merge. Wrong docs are worse
  than thin docs.

## Out of scope

- licensing and telemetry docs (separate efforts).
- The broader "voice pass over existing docs" (next phase).
- Rendering docs (`@threadplane/chat` `<a2ui-surface>`, the catalog) and fixing
  the stale `render/a2ui/surface-store.mdx` / `surface-component.mdx` /
  `catalog.mdx` content beyond the v0.9→v1 token sweep — flagged as a follow-up.
- Code/prompt/demo `v0.9` references (`cockpit/chat/a2ui/python/...`,
  `types.ts` has none to change) — flagged as a separate follow-up so the
  maintainer can verify the cockpit example + prompts.
