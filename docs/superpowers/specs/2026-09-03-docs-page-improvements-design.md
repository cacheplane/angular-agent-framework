# Docs page improvements — design

Date: 2026-09-03
Status: approved, ready for planning

Six changes to the `/docs` experience: a working Run rail item on the docs
index, search in place of the Scope card, one breadcrumb trail instead of four,
visible links in docs prose, call-to-action buttons in the callouts that exist
to send people somewhere, and the search footer on every docs content page.

## Findings that shaped the design

Two things were verified against the running dev server before designing, and
both changed the shape of the work.

**Docs prose links carry no styling at all.** `MdxRenderer` wraps content in
`docs-prose prose prose-slate` and sets `--tw-prose-links` to the accent color,
but Tailwind Typography is not active in this app: a stylesheet walk in the
loaded page found zero rules matching `.prose`. The custom property is set and
nothing reads it. Computed styles on `/docs/ag-ui/getting-started/introduction`
were `color: rgb(28, 28, 28)`, `text-decoration-line: none`, `font-weight: 400`
for a link in a paragraph, and `rgb(70, 70, 70)` for a link inside a callout.
The reported problem was callout links; the actual problem is every link in
every docs page, and callouts only make it most visible because their body text
is already muted.

**`/workspace/langgraph/streaming` returns 404.** The capability has a
`docsPath`, so `getWorkspaceDestinationPath()` resolves its canonical
destination to the docs route, and `generateStaticParams()` in
`apps/website/src/app/workspace/[product]/[topic]/page.tsx` deliberately skips
entries whose destination is not their own `workspacePath`. The working Run URL
for that capability is `/docs/langgraph/guides/streaming?mode=run`, which loads
and reports `runtime ready`. The Run href must therefore be derived from the
registry, not written as a literal path.

A third finding scoped the work rather than changing it. In
`libs/workspace-react/src/lib/components/control-plane/cockpit-control-plane.tsx`,
the host's `renderContextPane` is used only while the active mode is `Docs`;
Run, Code and API render `CockpitSidebar` instead. The "Capability" scope
visible in Run mode belongs to the cockpit sidebar and is not touched here.

## 1. Run on the docs index points at the default example

`DocsControlPlane` hardcodes `disabled` on the Run, Code and API rail items,
with a `disabledReason` explaining that the page has no workspace capability.
That is true of a docs page with no example. It is misleading on `/docs`, which
is not a capability page at all: there is no page-specific example to run, so
the canonical example is the only meaningful target.

On `/docs` only, Run becomes a link. Its href is resolved from the registry at
module scope:

```ts
const DEFAULT_EXAMPLE = resolveWorkspacePath('/workspace/langgraph/streaming');
const DEFAULT_EXAMPLE_RUN_HREF = DEFAULT_EXAMPLE
  ? getCanonicalWebsiteWorkspaceHref(DEFAULT_EXAMPLE, 'Run')
  : null;
```

This yields `/docs/langgraph/guides/streaming?mode=run` today and stays correct
if that capability's docs path moves. When the lookup returns `null` — the
capability was renamed or removed — Run falls back to today's disabled state
rather than rendering a dead link.

Code and API stay disabled on `/docs`. Run semantics on capability doc pages are
unchanged: there, Run means "run the example on this page", and a docs-only page
correctly has none.

## 2. Scope becomes search

The `Scope` section at the top of `DocsContextContent` repeats the breadcrumb
trail, and item 3 gives that trail a single owner. It is replaced by a search
trigger in the same position: a full-width button styled as an input, carrying a
magnifier icon, the label `Search docs`, and a `⌘K` hint that is hidden where a
pointer is coarse.

The trigger calls the existing `openSearch()`, so the mobile-drawer handoff
(`onSearchHandoff`, then `onNavigate` plus a `requestAnimationFrame`-deferred
dispatch) keeps working unchanged.

The `Search docs` icon button then leaves the `Actions` bar, where it would be a
second control for the same thing. `Actions` renders only when at least one
action remains — otherwise `/docs`, whose only action was search, would show an
empty section with a heading.

## 3. One breadcrumb trail, owned by the shell header

A doc page currently renders the same trail four times:

| Source | Renders |
| --- | --- |
| `workspace-shell.tsx` header | `Ag Ui / Getting Started / Overview` (mono, muted) |
| `DocsBreadcrumb` | `Docs / AG-UI / Getting Started / Introduction` |
| `DocsPageHeader` | `AG-UI · GETTING STARTED` |
| `DocsContextContent` Scope card | `AG-UI / Getting Started / Introduction` |

The Scope card goes away under item 2. Of the remaining three, the shell header
keeps the trail, because it is the one position that belongs to the shell rather
than to the article, and it is where a reader already looks for location.

Today that header derives its label from the manifest identity, which is why it
reads `Ag Ui` and `Overview` — the manifest's `toLabel()` casing and its
`page: 'overview'`, neither of which matches what the docs tree calls the
library or the page. It also renders as a muted mono `<p>`, which is decoration,
not navigation.

`WorkspaceShell` gains an optional prop:

```ts
readonly contextTrail?: readonly WorkspaceCrumb[];
```

where `WorkspaceCrumb` is `{ label: string; href?: string }`, declared in
`libs/workspace-react/src/lib/workspace-contracts.ts` and re-exported from the
package index alongside the other shell contracts. When supplied,
the header renders a `<nav aria-label="Breadcrumb">` with an ordered list:
rungs with an `href` are links, the last rung is marked `aria-current="page"`,
and separators are `aria-hidden`. When absent, cockpit keeps today's derived
mono `<p>` with no change in behavior.

The website supplies the trail from `docs-config`, matching what `DocsBreadcrumb`
resolves today: `Docs` → the library title linked through `libraryIntroPath()` →
the section title as plain text (no section index route exists) → the page title
as the current rung.

Consequences:

- `apps/website/src/components/docs/DocsBreadcrumb.tsx` is deleted.
- The `.docs-crumb-*` rules in `docs.css` are rewritten against
  `[data-workspace-trail]`. The shell ships structure plus minimal `--ds-*`
  styling so cockpit is not left unstyled; the website refines typography and
  hover states from `docs.css`.
- `DocsPageHeader` drops its `libTitle · sectionTitle` text, which the trail now
  states. The row keeps `LibraryMark` and the `actions` slot, so `PageActions`
  is unaffected.
- The BreadcrumbList JSON-LD in the `[slug]` route is unchanged. Only its
  comment changes: it currently explains itself by reference to the visible
  `DocsBreadcrumb`, and must instead reference the shell trail.

## 4. Visible links in docs prose, repo-wide

Adopting Tailwind Typography to make `--tw-prose-links` live would restyle every
heading, list, table and code block in the docs at once. The `.docs-prose` block
in `docs.css` already owns that presentation deliberately. So the link rules join
it there:

```css
.docs-prose a {
  color: var(--color-accent);
  text-decoration: underline;
  text-underline-offset: 2px;
  text-decoration-thickness: 1px;
}
.docs-prose a:hover { text-decoration-thickness: 2px; }
```

`:focus-visible` reuses the docs focus-ring treatment already defined in
`docs.css`.

Inside a callout, links take the callout's own tone so a warning callout's links
read amber rather than accent, and gain a heavier weight to carry against the
tinted ground:

```css
[data-mdx="callout"] .mdx-callout-body a {
  color: var(--callout-tone-text);
  font-weight: 500;
}
```

Links to absolute URLs get a trailing external-link glyph through an `::after`
rule keyed on `[href^="http"]`, so "the AG-UI demo" reads as off-site before it
is clicked. The glyph is decorative and inherits `currentColor`.

The rules are scoped to `.docs-prose`, so blog and marketing pages are untouched.

## 5. Call-to-action buttons in callouts

Two MDX components, registered in `MdxRenderer`'s `mdxComponents`:

- `CalloutActions` — a flex row that wraps, laying out one or two actions below
  the callout's prose.
- `CalloutAction` — a pill button taking `href` and
  `variant?: 'primary' | 'secondary'` (default `primary`). An absolute `href`
  automatically gets `target="_blank"` and `rel="noopener noreferrer"`.

Two components rather than one prop pair on `Callout`, because the AG-UI
introduction wants a primary action and a comparison action side by side, and a
`ctaLabel`/`ctaHref` pair on `Callout` cannot express that without growing a
second pair.

The authoring rule, which belongs in `CalloutActions`'s TSDoc so that 152
existing callouts do not sprout buttons: **a CTA belongs only in a callout whose
purpose is to send the reader somewhere to run or see something.** Explanatory
callouts (`Mental model`, `Why this matters`, `Node return values merge, not
replace`) and cautions (`Never expose API keys`) keep prose links, which item 4
has just made visible.

Applying that rule to the content tree selects five existing callouts — every
callout in the docs whose body is essentially a link to a demo — plus one gap:

| Page | Callout | Primary | Secondary |
| --- | --- | --- | --- |
| `ag-ui/getting-started/introduction` | See it live | Run the AG-UI demo | LangGraph demo |
| `ag-ui/getting-started/quickstart` | Try it first | Run the AG-UI demo | — |
| `runtimes/mastra/overview` | See it live | Run the Mastra example | View source |
| `runtimes/microsoft-agent-framework/overview` | See it live | Run the example | View source |
| `runtimes/aws-strands/overview` | See it live | Run the example | View source |
| `langgraph/getting-started/introduction` | See it live (new) | Run the LangGraph demo | — |

The last row is the gap the audit exposed: AG-UI's introduction advertises a
live demo and LangGraph's — the flagship adapter — does not.

Prose in these callouts is kept and trimmed only where it now duplicates a
button label. The buttons are the action; the prose is the context.

## 6. Search footer on every docs content page

The `Looking for something specific?` section at the foot of `/docs` is
extracted into `DocsSearchFooter` and rendered below `DocsPrevNext` on
`/docs/[library]/[section]/[slug]`, as well as on the index it came from.

One fix travels with it. Today it reads `Press ⌘K to search the docs` as static
text, which is unactionable on a touch device that has no `⌘K`. It becomes a
real button dispatching the same search event the control plane uses, with the
`⌘K` pill kept as a hint rather than as the only affordance.

## Testing

Test-first, against the suites that already cover these components.

| Suite | Assertion |
| --- | --- |
| `DocsControlPlane.spec.tsx` | search trigger renders in the pane; no Scope card; Run rail item carries the resolved href; `Actions` absent when it has no items |
| `docs-index-shell.spec.tsx` | index still renders its rail and now its search trigger |
| `[slug]/page.spec.tsx` | exactly one breadcrumb trail; no `AG-UI · GETTING STARTED` label; search footer present |
| new `workspace-shell` case | `contextTrail` renders a `nav[aria-label="Breadcrumb"]` with linked rungs and `aria-current` on the last; absent `contextTrail` keeps the derived mono label |
| `Callout.spec.tsx` | `CalloutAction` renders a link with the right variant class; absolute href gets `target`/`rel`; relative href does not |
| `style-contracts.spec.ts` | `.docs-prose a` carries a text decoration and the accent color |

The style-contract assertion gets a mutation check: delete the rule and confirm
the test fails. This repo has already shipped a suite that passed before the
feature it covered existed, and a CSS assertion is exactly the shape that fails
silently.

## Out of scope

- Adopting Tailwind Typography, or removing the now-inert `prose prose-slate`
  classes from `MdxRenderer`. Removing them is a one-line follow-up once the
  explicit rules are in place, but doing it in this change would make the diff
  look like a styling migration.
- Run, Code and API availability on capability doc pages. Their semantics are
  correct as they are.
- The `CockpitSidebar` "Capability" scope shown in Run, Code and API modes.
- Link styling outside `.docs-prose` — blog and marketing pages.
