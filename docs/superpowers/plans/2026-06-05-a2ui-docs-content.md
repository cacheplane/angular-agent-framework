# a2ui Docs Fill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Quickstart and three guides to `@threadplane/a2ui` docs (plus a schema accuracy fix and a v0.9→v1 sweep), in Brian's technical-register voice, grounded entirely in the real API and the real cockpit booking-form example.

**Architecture:** New MDX content pages under `apps/website/content/docs/a2ui/`, wired into the a2ui section of `docs-config.ts` (drives nav, routing, prev/next, search, llms-full). a2ui MDX pages have **no frontmatter** — the page title is the leading `# H1`. No new components.

**Tech Stack:** Next.js MDX docs, TypeScript (`docs-config.ts`), Playwright (e2e), `@threadplane/a2ui` (the documented library).

**Reference spec:** `docs/superpowers/specs/2026-06-05-a2ui-docs-content-design.md`

**ACCURACY IS THE TOP PRIORITY.** Every code snippet and API claim must match `libs/a2ui/src` (entry `libs/a2ui/src/index.ts`; impl in `lib/parser.ts`, `lib/resolve.ts`, `lib/pointer.ts`, `lib/guards.ts`, `lib/types.ts`). Do not invent exports, message shapes, or behavior. When unsure, read the source. The maintainer reviews every page for accuracy + voice before merge.

---

## Grounding reference (use these verbatim — they are real)

**Real A2UI stream** (booking form; emission order dataModelUpdate → surfaceUpdate → beginRendering; source `cockpit/chat/a2ui/python/src/graph.py`). Abbreviated form to use in pages:

```text
---a2ui_JSON---
{"dataModelUpdate":{"surfaceId":"booking","contents":[{"key":"origin","valueString":"LAX"},{"key":"dest","valueString":"JFK"},{"key":"passengers","valueNumber":1}]}}
{"surfaceUpdate":{"surfaceId":"booking","components":[{"id":"root","component":{"Column":{"children":{"explicitList":["title","origin","submit"]}}}},{"id":"title","component":{"Text":{"text":"Book a flight","usageHint":"h2"}}},{"id":"origin","component":{"MultipleChoice":{"label":"Origin","options":[{"label":"LAX","value":"LAX"},{"label":"JFK","value":"JFK"}],"selections":{"path":"/origin"},"maxAllowedSelections":1}}},{"id":"submit_label","component":{"Text":{"text":"Search flights"}}},{"id":"submit","component":{"Button":{"child":"submit_label","primary":true,"action":{"name":"bookingSubmit","context":[{"key":"origin","value":{"path":"/origin"}},{"key":"dest","value":{"path":"/dest"}}]}}}}]}}
{"beginRendering":{"surfaceId":"booking","root":"root"}}
```

**Real outbound action** (`A2uiActionMessage`, `version: 'v1'`; from `graph.py` docstring + `build-action-message.ts`):

```json
{
  "version": "v1",
  "action": {
    "name": "bookingSubmit",
    "surfaceId": "booking",
    "sourceComponentId": "submit",
    "timestamp": "2026-06-05T12:34:56.789Z",
    "context": { "origin": {"literalString": "LAX"}, "dest": {"literalString": "JFK"} },
    "label": "Search flights"
  }
}
```

**Test-derived snippets** (verbatim from `libs/a2ui/src/lib/*.spec.ts`):

```ts
// parser — basic + partial stream
const parser = createA2uiMessageParser();
const msgs = parser.push('{"beginRendering":{"surfaceId":"s1","root":"root"}}\n'); // -> 1 message
// partial: push without trailing newline buffers
parser.push('{"beginRendering":');      // -> []
parser.push('{"surfaceId":"s1","root":"root"}}\n'); // -> 1 message

// resolveDynamic
const model = { name: 'Brian', count: 7, active: true, tags: ['a', 'b'] };
resolveDynamic({ literalString: 'hello' }, model);  // "hello"
resolveDynamic({ path: '/name' }, model);           // "Brian"
resolveDynamic({ path: '/missing' }, model);        // undefined
resolveDynamic({ path: '/tags/0' }, model);         // "a"
resolveDynamic({ path: 'name' }, model, { basePath: '', item: undefined }); // "Brian"

// pointer helpers (immutable)
const original = { user: { name: 'Alice', age: 30 } };
const next = setByPointer(original, '/user/name', 'Bob');
next.user.name;      // "Bob"
original.user.name;  // "Alice" (unchanged)
setByPointer({}, '/a/b/c', 42);            // creates intermediates
getByPointer({ items: ['a','b','c'] }, '/items/1'); // "b"
deleteByPointer({ a: 1, b: 2 }, '/a');     // { b: 2 }

// guards
isPathRef({ path: '/x' });          // true
isLiteralString({ literalString: 'x' }); // true
```

**Exact public exports** (`libs/a2ui/src/index.ts`): types from `./lib/types`; `getByPointer, setByPointer, deleteByPointer`; `createA2uiMessageParser` (+ type `A2uiMessageParser`); `resolveDynamic` (+ type `A2uiScope`); guards `isLiteralString, isLiteralNumber, isLiteralBoolean, isPathRef`. **There is no exported `isLiteralArray`.** Package: `@threadplane/a2ui` v0.0.49.

**Voice rules (every page):** title restated as a one-line lede; contractions; one thought per line; tutorial pages get `## Goals` + `## Conclusion` + "Let's" transitions; concept pages use H2-as-question; opinions flagged + paired with a tradeoff. **No emojis, no anecdotes, no hype.** Cross-link rendering to `@threadplane/chat` `<a2ui-surface>` where relevant (this lib is the protocol/parse/resolve layer).

---

## Task 1: Wire the new pages into docs-config

**Files:**
- Modify: `apps/website/src/lib/docs-config.ts` (the `a2ui` library object, ~lines 267-289)

- [ ] **Step 1: Add Quick Start + a Guides section**

Replace the `a2ui` library's `sections` array (Getting Started has only Introduction; there's a Reference section) so it becomes:

```ts
    sections: [
      {
        title: 'Getting Started',
        id: 'getting-started',
        color: 'blue',
        pages: [
          { title: 'Introduction', slug: 'introduction', section: 'getting-started' },
          { title: 'Quick Start', slug: 'quickstart', section: 'getting-started' },
        ],
      },
      {
        title: 'Guides',
        id: 'guides',
        color: 'blue',
        pages: [
          { title: 'Message Protocol', slug: 'message-protocol', section: 'guides' },
          { title: 'Data Model', slug: 'data-model', section: 'guides' },
          { title: 'Validating & Adapting', slug: 'adapters-and-validation', section: 'guides' },
        ],
      },
      {
        title: 'Reference',
        id: 'reference',
        color: 'blue',
        pages: [
          { title: 'Schema', slug: 'schema', section: 'reference' },
          { title: 'Parser, Resolver, and Guards', slug: 'parser-resolver-guards', section: 'reference' },
        ],
      },
    ],
```

- [ ] **Step 2: Typecheck + lint**

```bash
cd /Users/blove/repos/angular-agent-framework
npx eslint apps/website/src/lib/docs-config.ts
npx tsc --noEmit -p apps/website/tsconfig.json 2>&1 | grep -E "docs-config" || echo "no new type errors in docs-config"
```
Expected: eslint exit 0; "no new type errors in docs-config".

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/lib/docs-config.ts
git commit -m "docs(a2ui): add Quick Start + Guides nav entries"
```

(The five new slugs now resolve in routing/sidebar/prev-next/search; the next tasks add the MDX bodies. Until then those routes 404 on missing files — that's expected mid-plan.)

---

## Task 2: Quickstart page

**Files:**
- Create: `apps/website/content/docs/a2ui/getting-started/quickstart.mdx`

- [ ] **Step 1: Write the page**

Create the file. No frontmatter; first line is `# Quick Start`. Structure (author the connecting prose in-voice; the code blocks below are mandatory and verbatim-grounded):

1. **Lede (one sentence):** "Parse an A2UI stream and read its resolved values with `@threadplane/a2ui`."
2. One-paragraph scope note: this library is the protocol/parse/resolve layer; rendering A2UI in Angular is `@threadplane/chat`'s `<a2ui-surface>` (link `/docs/chat/getting-started/introduction`).
3. `## Goals` — bullets: install; parse a JSONL stream; apply a data-model update with `setByPointer`; resolve a dynamic value with `resolveDynamic`.
4. `## Install` — ```bash\nnpm install @threadplane/a2ui\n``` (note: no peer dependencies).
5. `## Parse a stream` — "Let's" transition. Use the **real booking-form stream** (the abbreviated `---a2ui_JSON---` block from the grounding reference) and show:
   ```ts
   import { createA2uiMessageParser } from '@threadplane/a2ui';

   const parser = createA2uiMessageParser();
   const messages = parser.push(streamChunk); // A2uiMessage[]
   ```
   Explain: `push` returns the complete envelopes found so far; partial JSON without a trailing newline stays buffered (show the partial-stream snippet from grounding).
6. `## Build the data model` — apply the `dataModelUpdate` contents into a plain object with `setByPointer` (show converting `{ key, valueString }` entries to `{ origin: 'LAX' }` and `setByPointer(model, '/origin', 'LAX')`). Keep it honest: the library gives you the pointer helpers; assembling the model from `contents` is your code.
7. `## Resolve a value` — `resolveDynamic({ path: '/origin' }, model)` → `"LAX"`; `resolveDynamic({ literalString: 'Book a flight' }, model)` → `"Book a flight"`. Use the resolve snippet from grounding.
8. `## Conclusion` — one paragraph; link onward: Message Protocol (`/docs/a2ui/guides/message-protocol`), Data Model (`/docs/a2ui/guides/data-model`), Validating & Adapting (`/docs/a2ui/guides/adapters-and-validation`).

Accuracy constraints: only the real exports; `version: 'v1'`; do not show `isLiteralArray`; do not claim the library renders or mutates state for you.

- [ ] **Step 2: Verify it renders**

```bash
cd /Users/blove/repos/angular-agent-framework
lsof -ti tcp:3000 >/dev/null 2>&1 || (export PATH=/Users/blove/.nvm/versions/node/v22.14.0/bin:$PATH && npx nx serve website --port 3000 > /tmp/wd-a2ui.log 2>&1 &)
sleep 25
curl -s -o /dev/null -w "quickstart HTTP %{http_code}\n" http://localhost:3000/docs/a2ui/getting-started/quickstart
```
Expected: HTTP 200.

- [ ] **Step 3: Commit**

```bash
git add apps/website/content/docs/a2ui/getting-started/quickstart.mdx
git commit -m "docs(a2ui): add quickstart guide"
```

---

## Task 3: Guide — The A2UI message protocol

**Files:**
- Create: `apps/website/content/docs/a2ui/guides/message-protocol.mdx`

- [ ] **Step 1: Write the page**

First line `# The A2UI message protocol`. Concept register, H2-as-question. Sections (prose in-voice; facts below are mandatory and exact):

1. Lede: one sentence ("The A2UI wire format is four JSON-lines envelopes that build and update a surface.").
2. `## What's a surface?` — an independent UI region with its own component set and its own data model; every envelope targets one via `surfaceId`.
3. `## How are components shaped?` — an **id-keyed adjacency list**, not a nested tree. The keyed-union shape `{ "<Name>": { ...props } }` (e.g. `{ "Text": { "text": "Book a flight" } }`). Children: `{ explicitList: string[] }` or `{ template: { componentId, dataBinding } }`. Use real components from the booking stream (Column, Text, MultipleChoice, Button).
4. `## What are dynamic values?` — literal wrappers (`literalString`, `literalNumber`, `literalBoolean`, `literalArray`) vs path refs (`{ path: '/origin' }`). Note the booking stream's `"text":"Book a flight"` raw-string shorthand is also accepted, but the canonical form is the wrapper.
5. `## The four envelopes` — one short subsection each, each with a real JSON example sliced from the booking stream:
   - `surfaceUpdate` — components for a surface (buffered until rendering begins).
   - `dataModelUpdate` — typed `contents` entries (`valueString`/`valueNumber`/`valueBoolean`/`valueMap`), optional JSON-pointer `path`.
   - `beginRendering` — names the `root` id; optional `styles` (`font`, `primaryColor`).
   - `deleteSurface` — tears a surface down.
6. `## Sending actions back` — the `A2uiActionMessage` (**`version: 'v1'`**). Use the real outbound action JSON from grounding. Note: inbound Button `action.context` is a **list** of `{ key, value }`; the outbound message's `context` is a **map** of wrapped literals — that asymmetry is real (from `build-action-message.ts`). Note `label` is derived from the button's text, and `metadata.a2uiClientDataModel` is attached only when the surface opts in.
7. `## Relationship to Google's A2UI` — accurate, short: Threadplane implements Google's open **A2UI** protocol (declarative, catalog-based; surfaces, per-surface data model, dynamic values, outbound actions). Threadplane's implementation version is **v1**. Link `https://a2ui.org` and `https://github.com/google/A2UI`. Do **not** claim numbering parity with Google's v0.8/v0.9.
8. Close: forward link to Data Model + Validating & Adapting; rendering link to `@threadplane/chat`.

- [ ] **Step 2: Verify it renders**

```bash
curl -s -o /dev/null -w "message-protocol HTTP %{http_code}\n" http://localhost:3000/docs/a2ui/guides/message-protocol
```
Expected: HTTP 200.

- [ ] **Step 3: Commit**

```bash
git add apps/website/content/docs/a2ui/guides/message-protocol.mdx
git commit -m "docs(a2ui): add message protocol guide"
```

---

## Task 4: Guide — Working with the data model

**Files:**
- Create: `apps/website/content/docs/a2ui/guides/data-model.mdx`

- [ ] **Step 1: Write the page**

First line `# Working with the data model`. Task register. Sections (use the pointer/resolve snippets from grounding verbatim):

1. Lede: one sentence ("The data model is plain JSON; `@threadplane/a2ui` gives you pointer helpers and a resolver to read and update it.").
2. `## Reading and writing with pointers` — `getByPointer` / `setByPointer` / `deleteByPointer`. Cover, with the grounding snippets:
   - JSON-Pointer-style paths (`/user/name`, `/items/1`).
   - **Immutability**: `set`/`delete` return a structurally-shared clone; the original is untouched (show the `original.user.name === 'Alice'` example).
   - `set` creates intermediate objects for missing segments.
   - `delete` on a missing parent returns the original model unchanged.
   - **Caveat** (flag with a `Callout type="warning"`): no RFC-6901 `~0`/`~1` unescaping — keys with `/` or `~` aren't supported.
3. `## Resolving dynamic values` — `resolveDynamic(value, model, scope?)`: literals unwrapped first, then `{ path }`; arrays mapped recursively; plain values passed through; missing paths → `undefined`. Use the resolve snippet.
4. `## Scopes and template children` — `A2uiScope` (`{ basePath, item }`). Relative paths resolve against `basePath`; absolute (`/…`) from the root. Show the `template`/`dataBinding` per-item pattern conceptually (each item resolved with `basePath: \`${arrayPath}/${i}\``). Flag honestly: `scope.item` is part of the type but the resolver only reads `basePath`.
5. Close: forward link to Validating & Adapting.

- [ ] **Step 2: Verify it renders**

```bash
curl -s -o /dev/null -w "data-model HTTP %{http_code}\n" http://localhost:3000/docs/a2ui/guides/data-model
```
Expected: HTTP 200.

- [ ] **Step 3: Commit**

```bash
git add apps/website/content/docs/a2ui/guides/data-model.mdx
git commit -m "docs(a2ui): add data model guide"
```

---

## Task 5: Guide — Validating and adapting an A2UI stream

**Files:**
- Create: `apps/website/content/docs/a2ui/guides/adapters-and-validation.mdx`

- [ ] **Step 1: Write the page**

First line `# Validating and adapting an A2UI stream`. Task register. Sections:

1. Lede: one sentence ("Use `@threadplane/a2ui` to consume, validate, and test A2UI payloads — or to build your own renderer on top of the protocol.").
2. `## Consume a streaming response` — feed chunks to `parser.push`; the parser's conservative-fallback posture, quoted accurately from `parser.ts`: malformed lines are skipped, unknown envelope keys are ignored, partial JSON buffers until a newline. Use the partial-stream snippet.
3. `## Validate and narrow payloads` — the exported guards `isPathRef`, `isLiteralString`, `isLiteralNumber`, `isLiteralBoolean` (show the guard snippet). State plainly there is **no** `isLiteralArray` guard.
4. `## Build payloads for tests` — assemble a `surfaceUpdate` + `dataModelUpdate` + `beginRendering` sequence against the exported types for a unit test (mirror the parser test: push the three lines, assert envelope kinds). This is how to test an emitter.
5. `## Build a custom renderer` — resolve props with `resolveDynamic` + the data model; this library is the layer a renderer builds on. Note the Threadplane Angular renderer is `@threadplane/chat`'s `<a2ui-surface>` (link) — point there rather than re-documenting rendering.
6. `## A tradeoff worth knowing` — flagged opinion: the parser intentionally swallows JSON parse errors (great for mid-stream partials), so if you need strict validation, do it on the parsed `A2uiMessage[]`, not by expecting the parser to throw.
7. Close: link back to Quickstart + Message Protocol.

- [ ] **Step 2: Verify it renders**

```bash
curl -s -o /dev/null -w "adapters HTTP %{http_code}\n" http://localhost:3000/docs/a2ui/guides/adapters-and-validation
```
Expected: HTTP 200.

- [ ] **Step 3: Commit**

```bash
git add apps/website/content/docs/a2ui/guides/adapters-and-validation.mdx
git commit -m "docs(a2ui): add validating & adapting guide"
```

---

## Task 6: Schema accuracy fix + v0.9→v1 sweep

**Files:**
- Modify: `apps/website/content/docs/a2ui/reference/schema.mdx`
- Modify: `apps/website/content/docs/render/a2ui/overview.mdx`
- Modify: `apps/website/content/docs/render/a2ui/catalog.mdx`
- Modify: `apps/website/content/docs/render/concepts/json-render-vs-a2ui.mdx`

- [ ] **Step 1: Fix schema.mdx version + add the label field**

In `apps/website/content/docs/a2ui/reference/schema.mdx`:
- Change the `version: 'v0.9';` line (≈ line 189) in the `A2uiActionMessage` code block to `version: 'v1';`.
- Change the sentence "The outbound action version is currently typed as `v0.9` in source." (≈ line 203) to "The outbound action version is `v1`."
- In the `A2uiActionMessage.action` shape, add the optional field `label?: string;` (present in `libs/a2ui/src/lib/types.ts`). Place it after `context` with a one-line note that it's an optional human-readable label derived from the source component.

- [ ] **Step 2: Sweep the remaining v0.9 references**

For each of `render/a2ui/overview.mdx`, `render/a2ui/catalog.mdx`, `render/concepts/json-render-vs-a2ui.mdx`: read each `v0.9` occurrence in context. If it refers to the Threadplane action-message/version, change it to `v1`. If it is explicitly citing Google's upstream protocol version, leave it accurate to Google (do not blanket-replace). Run to find them:
```bash
grep -rn "v0.9\|v0_9" apps/website/content/docs/render
```
Make the contextual edits accordingly.

- [ ] **Step 3: Verify no stray Threadplane-version v0.9 remains + pages render**

```bash
cd /Users/blove/repos/angular-agent-framework
grep -rn "version.*v0.9\|v0.9.*in source" apps/website/content/docs/a2ui apps/website/content/docs/render || echo "no stale Threadplane-version v0.9 refs"
curl -s -o /dev/null -w "schema HTTP %{http_code}\n" http://localhost:3000/docs/a2ui/reference/schema
```
Expected: no stale refs; schema HTTP 200.

- [ ] **Step 4: Commit**

```bash
git add apps/website/content/docs/a2ui/reference/schema.mdx apps/website/content/docs/render/a2ui/overview.mdx apps/website/content/docs/render/a2ui/catalog.mdx apps/website/content/docs/render/concepts/json-render-vs-a2ui.mdx
git commit -m "docs(a2ui): align action message version on v1"
```

---

## Task 7: e2e + full verification

**Files:**
- Modify: `apps/website/e2e/docs.spec.ts`

- [ ] **Step 1: Add an a2ui-docs e2e test**

In `apps/website/e2e/docs.spec.ts`, add a new describe block:

```ts
test.describe('a2ui docs', () => {
  test('quickstart renders with sidebar + article', async ({ page }) => {
    await page.goto('/docs/a2ui/getting-started/quickstart');
    await expect(page.locator('aside').first()).toBeVisible();
    await expect(page.locator('article').first()).toBeVisible();
    await expect(page.locator('article h1').first()).toContainText('Quick Start');
  });

  test('sidebar lists the new guides', async ({ page }) => {
    await page.goto('/docs/a2ui/getting-started/quickstart');
    await expect(page.locator('aside').getByText('Message Protocol').first()).toBeVisible();
    await expect(page.locator('aside').getByText('Data Model').first()).toBeVisible();
    await expect(page.locator('aside').getByText('Validating & Adapting').first()).toBeVisible();
  });
});
```

- [ ] **Step 2: Run the docs e2e**

```bash
cd apps/website && npx playwright test e2e/docs.spec.ts
```
Expected: PASS (all blocks, including the new a2ui block).

- [ ] **Step 3: Verify all five new/changed routes serve**

```bash
for r in getting-started/quickstart guides/message-protocol guides/data-model guides/adapters-and-validation reference/schema; do
  curl -s -o /dev/null -w "$r %{http_code}\n" "http://localhost:3000/docs/a2ui/$r"
done
```
Expected: all `200`.

- [ ] **Step 4: Commit**

```bash
cd /Users/blove/repos/angular-agent-framework
git add apps/website/e2e/docs.spec.ts
git commit -m "test(website): assert a2ui quickstart + guides render"
```

---

## Manual / maintainer verification (required before merge)

- [ ] Open each new page on the dev server and read it for **technical accuracy** against `libs/a2ui/src` — every export named, every snippet, every message shape. This is the gate; wrong docs are worse than thin docs.
- [ ] Read each page for **voice**: title-as-lede, contractions, one-thought-per-line, `## Goals`/`## Conclusion` on the quickstart, H2-as-question on the protocol guide, opinions flagged with a tradeoff, and **no** emojis/anecdotes/hype.
- [ ] Confirm `version: 'v1'` everywhere and the Google-A2UI relationship note doesn't over-claim numbering parity.
- [ ] ⌘K search: typing "quickstart" / "data model" surfaces the new pages.

## Self-Review (completed during planning)

- **Spec coverage:** Quickstart ✓ (Task 2). Message Protocol guide ✓ (Task 3). Data Model guide ✓ (Task 4). Validating & Adapting guide ✓ (Task 5). Schema v0.9→v1 + label fix ✓ (Task 6 Step 1). Docs-wide v0.9→v1 sweep ✓ (Task 6 Step 2). docs-config wiring ✓ (Task 1). e2e ✓ (Task 7). Voice rules + v1 framing + accuracy gate carried into every content task. Out-of-scope items (licensing/telemetry, voice pass, cockpit code refs) left out.
- **Placeholder scan:** No TBD/TODO; content tasks carry verbatim grounded snippets + exact outlines + the real examples; mechanical steps have exact commands/expected output. (Prose is authored in-voice by the implementer from the provided outline + snippets — that's the nature of content work — then gated by the accuracy review.)
- **Consistency:** Slugs (`quickstart`, `message-protocol`, `data-model`, `adapters-and-validation`) match between Task 1's docs-config entries, each page's file path, the curl checks, and the e2e titles ("Message Protocol", "Data Model", "Validating & Adapting"). `version: 'v1'` consistent across Tasks 2/3/6. Exports named match `libs/a2ui/src/index.ts`; the "no `isLiteralArray`" caveat is consistent across the protocol and adapters guides.
