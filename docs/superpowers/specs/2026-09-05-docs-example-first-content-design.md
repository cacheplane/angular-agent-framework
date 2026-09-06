# Example-first docs content — design

**Date:** 2026-09-05
**Status:** approved
**Follows:** `2026-09-04-docs-workspace-unification-design.md` (Parts A–D, complete)

## Problem

Every mapped capability (47 today) teaches the same topic three times with
three different code versions:

1. The running example under `cockpit/<product>/<topic>/` (Angular app plus
   a Python or TypeScript backend), shown live in the Run tab and as
   highlighted source in the Code tab.
2. A walkthrough at `cockpit/<product>/<topic>/python/docs/guide.md` (41
   files, about 4,800 lines) written with `<Summary>`, `<Prompt>` and
   `<Steps>` tags for the workspace's narrative-docs panel. On the Website
   the docs page's own MDX fills the Docs tab, so these walkthroughs are
   never rendered anywhere.
3. The docs page itself under `apps/website/content/docs/**`, which
   hand-writes its own snippets instead of using the example.

The user's direction: the `/docs` page is the one teaching surface, and it
teaches through the live example. Where duplicates exist, the docs page is
rewritten to use the example as its primary angle and the walkthrough is
absorbed and deleted.

## Goals

- A mapped docs page's code comes from the example the page embeds, so the
  article, the Code tab and the running demo can never disagree.
- One teaching surface per topic. The walkthrough files and the machinery
  that rendered them are removed.
- Guards make regressions fail in CI: a mapped page that stops using its
  example, an include that names a file the example does not ship, a
  walkthrough file reappearing.

## Non-goals

- The 82 docs-only pages (no capability mapped). They keep hand-written
  snippets.
- Multi-runtime variants inside one page. The example covers one runtime per
  page; other-runtime fragments may stay as ordinary fences.
- Changing the workspace shell's Run, Code or API tabs.
- Preserving the walkthroughs' `<Prompt>` blocks (decided: dropped).

## Facts the design rests on

- `apps/website/src/app/docs/[library]/[section]/[slug]/page.tsx` already
  calls `getWebsiteWorkspacePage`, which resolves the capability and awaits
  `getContentBundle(presentation)`. The bundle's `codeFiles` maps every
  `codeAssetPaths` and `backendAssetPaths` entry (repo-relative path) to
  shiki-highlighted HTML produced by `highlightCode` in
  `libs/cockpit-shell/src/lib/workspace-content.ts`. The Code tab renders that
  HTML with `dangerouslySetInnerHTML` (`code-mode.tsx`).
- MDX is compiled with `next-mdx-remote/rsc` in
  `apps/website/src/components/docs/MdxRenderer.tsx`; the component map is a
  module constant and `MdxRenderer` takes only `source`. Async server
  components are valid in that map.
- `Pre` (`components/docs/mdx/CodeBlock.tsx`) wraps every fenced block with
  the copy button and the `mdx-pre` styling.
- The docs search index (`docs-search-index.ts`) strips fenced code from the
  MDX source and never sees rendered output, so included code is invisible to
  search exactly like fenced code is today.
- `narrativeDocs` flows: descriptor `docsAssetPaths` →
  `workspace-presentation.ts` → `workspace-content.ts` (`renderMarkdown` with
  custom tags in `render-markdown.ts`) → `workspace-shell.tsx` →
  `components/narrative-docs/narrative-docs.tsx`. Nothing else reads
  `docsAssetPaths` or `guide.md`.
- Mapped pages per product (manifest): chat 13, langgraph 9, ag-ui 7,
  render 7, deep-agents 6, runtimes 4, a2ui 1. A manifest entry does not
  guarantee an example: `/docs/langgraph/getting-started/introduction` is in
  the manifest but has no content descriptor, so its bundle carries no code.
  Throughout this spec "mapped page" means a docsPath whose content
  descriptor lists at least one `codeAssetPaths` or `backendAssetPaths`
  entry; every other page is docs-only for this program.

## Design

### 1. `<ExampleCode>` MDX component

Location: `apps/website/src/components/docs/mdx/ExampleCode.tsx`, a server
component. `MdxRenderer` gains an optional `exampleCode` prop carrying the
page's bundle data; when present the component map is extended with an
`ExampleCode` bound to that data. Pages without a mapped capability pass
nothing, and an `ExampleCode` tag on such a page throws at build time with
the page path in the message.

Props:

- `file` (required): a basename (`streaming.component.ts`) or a
  repo-relative path. Basename matching must be unique among the
  capability's `codeAssetPaths` plus `backendAssetPaths`; an ambiguous
  basename or an unknown file throws.
- `region` (optional): the name in a fold-marker pair inside that file.
  Marker syntax per language: `// #region name` / `// #endregion` for
  TypeScript, `# region name` / `# endregion` for Python,
  `<!-- #region name -->` / `<!-- #endregion -->` for HTML. Marker lines are
  stripped from the rendered slice and the slice is de-indented to its
  shallowest line. An unknown region throws.
- `title` (optional): overrides the title bar, which defaults to the
  basename.

Rendering: both whole-file and region includes work from raw source, so
`ContentBundle` gains `codeSources: Record<string, string>` (raw text keyed
like `codeFiles`). The component synthesizes a fenced block from the
requested slice and renders it through `MDXRemote` with the page's own
compile options (`components/docs/mdx-options.ts`) and `pre: Pre`, so
highlighting, the copy button and its analytics event, and every `mdx-pre`
style come from the one existing code pipeline rather than a second one.
The bundle's highlighted `codeFiles` continues to serve the Code tab only.
The block is wrapped in a titled card (`mdx-example-code`). Tabbing several
`ExampleCode` blocks through `CodeGroup` is not supported in PR 1, because
`CodeGroup` derives its tab labels from a child's `data-title` prop; PR 2
decides whether to add that. The Code tab's markers stay visible there; they
read as the documentation anchors they are.

### 2. Guards

`apps/website/src/lib/docs-example-code.spec.ts`:

- For every mapped page (descriptor with code assets), load the MDX file and
  require at least one `<ExampleCode` tag. A `PENDING_PAGES` allow-list, seeded with
  every mapped page in PR 1, exempts pages not yet rewritten; each product PR
  removes its pages, and the last one deletes the list.
- Every `file=` value on a mapped page must resolve, by the same rule the
  component uses, to one of that capability's asset paths; every `region=`
  must exist in that file. This is the static twin of the build-time throw,
  so a rename fails unit tests before anyone runs a build.
- `ExampleCode` must not appear on a docs-only page.

`apps/website/src/lib/cockpit-retirement.spec.ts` (existing) gains, in the
last product PR: no file matching `cockpit/**/docs/guide.md` exists and no
descriptor carries `docsAssetPaths`.

### 3. Page shape for mapped pages

Each rewritten page follows one order, scaled to the topic:

1. **What the demo does.** Two or three sentences on what the Run tab shows
   and what to try.
2. **How it is built.** The example walked in build order: backend graph or
   agent first, then Angular config, component, template. Each step is an
   `ExampleCode` block (region where the file is long) with prose explaining
   the lines that matter. The walkthrough's Summary and Steps are absorbed
   here.
3. **Concepts.** The explanatory material the current page already carries
   (stream modes, status transitions, pitfalls), trimmed of snippets the
   example now shows.
4. **Going further.** Links to related pages and API entries.

Prose register follows `docs/gtm/voice.md` and the existing docs pages; the
public-copy contract and the cockpit-retirement guard apply.

### 4. Machinery removal (PR 1)

Delete `components/narrative-docs/*`, the `narrativeDocs` branch in
`workspace-shell.tsx`, the Summary/Prompt/Steps handling and `renderMarkdown`
in `render-markdown.ts` (keep `highlightCode` and its helpers, moving them if
that empties the file), `narrativeDocs` from `ContentBundle`, `docsAssetPaths`
from the descriptor type, `workspace-presentation.ts` and all 41 descriptors,
and every spec case that covered them. The 41 `guide.md` files stay on disk
until the product PR that absorbs them deletes them; after PR 1 nothing
references them.

### 5. Rollout

- **PR 1, infrastructure:** `ExampleCode`, `codeSources`, `MdxRenderer`
  prop, guards with the seeded allow-list, machinery removal, an
  `ExampleCode` block on the streaming page as the first consumer so the
  component is exercised, docs in `CONTRIBUTING.md` on the include and
  marker conventions.
- **PR 2, LangGraph pilot:** rewrite the 9 pages, add regions to the
  examples as needed, delete the 9 `guide.md` files, remove them from the
  allow-list, add a Website e2e case on the streaming page asserting an
  `ExampleCode` block renders highlighted tokens and its copy button copies
  the code. Review the teaching angle here before repeating it.
- **PRs 3–8:** chat, ag-ui, render, deep-agents, runtimes, a2ui, same shape.
  The last one deletes the allow-list and adds the retirement guard cases.

Each PR runs the existing Website preview lane, so article and embedded
runtime are verified together on a real deployment.

## Error handling

- Unknown file, ambiguous basename, unknown region, or `ExampleCode` on a
  docs-only page: throw during build with page path, file and region in the
  message. Never render an empty or placeholder block.
- A `codeFiles` entry that is the `File not found:` sentinel counts as
  unknown.
- The bundle failing to read a file continues to degrade the Code tab as
  today; the docs page fails instead, because a docs page without its code
  is wrong, not degraded.

## Testing

- Unit: `ExampleCode.spec.tsx` (whole file, region slicing and de-indent,
  each marker syntax, every error path); `workspace-content.spec.ts` gains
  `codeSources`; the guard spec above; `MdxRenderer.spec.tsx` covers the
  bound component map.
- E2E (PR 2): the streaming page case described in the rollout.
- Deletion safety (PR 1): after removal, `grep -rn narrativeDocs|docsAssetPaths|renderMarkdown` across `libs apps scripts` returns only the spec that forbids them.

## Cost

PR 1 is a few hundred lines of code and a similar amount deleted. Each
product PR is prose work sized by its page count; LangGraph's 9 pages
replace about 2,900 lines of docs and 1,200 lines of walkthrough (7 of the 9 LangGraph pages carry one).
