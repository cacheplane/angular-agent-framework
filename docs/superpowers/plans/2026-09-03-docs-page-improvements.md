# Docs Page Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the `/docs` experience navigable and actionable — a working Run rail item on the index, search in place of the redundant Scope card, one breadcrumb trail instead of four, visible links in docs prose, CTA buttons in the callouts that exist to send people somewhere, and the search footer on every docs content page.

**Architecture:** Six mostly-independent changes across three layers. The website app (`apps/website`) owns the docs index, the `[slug]` route, the docs control plane and `docs.css`. The shared shell (`libs/workspace-react`) gains one optional prop so the website can hand it an accurate breadcrumb trail without changing cockpit behavior. MDX content (`apps/website/content/docs`) gains CTA components in six files. No new dependencies.

**Tech Stack:** Next.js App Router (React 19, RSC), TypeScript, Nx monorepo, Vitest + Testing Library (jsdom), plain CSS in `apps/website/src/styles/*.css` (UNLAYERED rules — no Tailwind `@layer`), MDX via `next-mdx-remote/rsc`.

**Spec:** `docs/superpowers/specs/2026-09-03-docs-page-improvements-design.md`

---

## Before you start

Read the spec. Then note these repo facts, which are not guessable:

1. **Website tests need an env var.** `GROWTH_FORM_POLICY=growth_v1` or the app throws at import. Every website test command below includes it.
2. **Targeted test runs must be started from the project directory.** `npx vitest run --config <file> <spec>` resolves the spec filter relative to the CWD, so `cd apps/website` (or `cd libs/workspace-react`) first. Running from the repo root reports "No test files found" and exits 1 — which reads like a broken command, not a wrong CWD.
3. **`.docs-prose` owns docs typography, not Tailwind.** `MdxRenderer` still carries `prose prose-slate` classes, but Tailwind Typography is not active in this app and those classes emit zero CSS rules. Do not try to make them work; add explicit rules to the `.docs-prose` block. Removing the inert classes is explicitly out of scope (see spec).
4. **jsdom does not apply stylesheets.** A component test renders identical DOM whether or not a load-bearing CSS declaration exists. That is what `apps/website/src/styles/style-contract.ts` (`declarationsFor`) is for. Task 1 uses it and includes a mutation check.
5. **Local dev server:** `mcp__Claude_Browser__preview_start` with `{name: "website-dev"}` (port 3000). Never run a dev server with Bash. `apps/website/.env.local` must contain `GROWTH_FORM_POLICY=growth_v1`; create it if missing (it is gitignored).

### File structure

| File | Responsibility | Task |
| --- | --- | --- |
| `apps/website/src/styles/docs.css` | prose link rules, control-plane search trigger, `[data-workspace-trail]` crumb typography; deletes the orphaned `.docs-sidebar-search-*` block and the `.docs-crumb-*` block | 1, 3, 5 |
| `apps/website/src/styles/style-contracts.spec.ts` | asserts the prose link rule exists | 1 |
| `apps/website/src/components/docs/mdx/Card.tsx`, `FeatureChips.tsx`, `headings.tsx` | opt out of the prose link rule via `data-mdx-chrome` | 1 |
| `apps/website/src/components/docs/DocsControlPlane.tsx` | Run href on the index; search trigger replacing Scope; conditional Actions bar | 2, 3 |
| `apps/website/src/app/docs/page.tsx` | passes the Run href; renders `DocsSearchFooter` | 2, 8 |
| `libs/workspace-react/src/lib/workspace-contracts.ts` | `WorkspaceCrumb` type | 4 |
| `libs/workspace-react/src/lib/workspace-shell.tsx` | renders `contextTrail` as a real breadcrumb nav, else today's mono label | 4 |
| `apps/website/src/components/workspace/WebsiteWorkspace.tsx` | forwards `contextTrail` to the shell | 5 |
| `apps/website/src/app/docs/[library]/[section]/[slug]/page.tsx` | builds the trail; drops `DocsBreadcrumb`; renders `DocsSearchFooter` | 5, 8 |
| `apps/website/src/components/docs/DocsBreadcrumb.tsx` | **deleted** | 5 |
| `apps/website/src/components/docs/DocsPageHeader.tsx` | loses its `lib · section` label | 5 |
| `apps/website/src/components/docs/mdx/CalloutActions.tsx` | `CalloutActions` + `CalloutAction` | 6 |
| `apps/website/src/components/docs/MdxRenderer.tsx` | registers the two CTA components | 6 |
| 6 files under `apps/website/content/docs` | CTA buttons in demo callouts | 7 |
| `apps/website/src/components/docs/DocsSearchFooter.tsx` | the shared search footer | 8 |

---

### Task 1: Visible links in docs prose

The reported bug was "links inside callouts are not visually noticeable." The cause is broader: `.prose` emits no rules, so *every* link in docs prose inherits body color with no underline. This task fixes all of them and gives callout links the callout's own tone.

Component-rendered anchors inside `.docs-prose` (`Card`, `FeatureChips`, heading anchors, and the CTA buttons from Task 6) must **not** get the text-link treatment. They opt out with a `data-mdx-chrome` attribute, so the CSS reads as one `:not()` rather than a growing chain of class names.

**Files:**
- Modify: `apps/website/src/styles/docs.css` (append after the `.mdx-callout-body` rules, currently ending at line 382)
- Modify: `apps/website/src/components/docs/mdx/Card.tsx:33`
- Modify: `apps/website/src/components/docs/mdx/FeatureChips.tsx:26`
- Modify: `apps/website/src/components/docs/mdx/headings.tsx:36`
- Test: `apps/website/src/styles/style-contracts.spec.ts`

- [ ] **Step 1: Write the failing style-contract test**

`apps/website/src/styles/style-contracts.spec.ts` is a declarative registry, not a set of hand-written describes: a `CONTRACTS: StyleContract[]` array at the top is iterated at line 194, and each entry gets a "has a rule at all" test plus one test per `requires` pattern. Add three entries to that array (after the existing `.docs-control-plane` entry, keeping `docs.css` entries together):

```ts
  {
    file: 'docs.css',
    selector: '.docs-prose a:not([data-mdx-chrome])',
    why: 'Tailwind Typography is inert in this app — `.prose` emits zero rules, so `--tw-prose-links` on MdxRenderer set a variable nothing read and every docs link rendered as plain body text (measured: rgb(28,28,28), no decoration). This rule is the only thing making a docs link look like a link.',
    requires: {
      color: /color:\s*var\(--color-accent\)/,
      'text-decoration': /text-decoration:\s*underline/,
    },
  },
  {
    file: 'docs.css',
    selector: '[data-mdx="callout"] .mdx-callout-body a:not([data-mdx-chrome])',
    why: "A callout's body text is already muted, so an accent-blue link inside a warning callout reads as a rendering error. Losing this leaves callout links legible but wrongly toned — the failure nobody reports.",
    requires: {
      color: /color:\s*var\(--callout-tone-text\)/,
      'font-weight': /font-weight:\s*500/,
    },
  },
  {
    file: 'docs.css',
    selector: '.docs-prose a[href^="http"]:not([data-mdx-chrome])::after',
    why: 'The only signal that a docs link leaves the site. Losing it renders an off-site link identically to an in-site one, which is invisible until someone loses their place.',
    requires: {
      content: /content:/,
    },
  },
```

`declarationsFor` and `loadStylesheet` are already imported at the top of the file, and the registry supplies `docsCss` per entry — no other edits to the spec are needed.

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd apps/website && GROWTH_FORM_POLICY=growth_v1 npx vitest run --config vite.config.mts src/styles/style-contracts.spec.ts
```

Expected: 9 failures — for each of the three new entries, the registry's "has a rule at all" test fails (`declarationsFor` returned `''`) plus one failure per `requires` pattern.

- [ ] **Step 3: Add the CSS rules**

Append to `apps/website/src/styles/docs.css` immediately after the line `.mdx-callout-body > :last-child { margin-bottom: 0; }`:

```css
/* Docs prose links.
 *
 * MdxRenderer carries `prose prose-slate` and sets `--tw-prose-links`, but
 * Tailwind Typography is not active in this app: a stylesheet walk in the
 * loaded page finds zero rules matching `.prose`. Every docs link therefore
 * rendered as plain body text (measured: rgb(28,28,28), no decoration,
 * weight 400). These rules are the real link styling. Scoped to .docs-prose
 * so blog and marketing pages keep their own treatment.
 *
 * `[data-mdx-chrome]` is the opt-out for anchors that are components, not
 * text: cards, feature chips, heading anchors, callout CTA buttons. They
 * carry their own affordance and an underline would corrupt it.
 */
.docs-prose a:not([data-mdx-chrome]) {
  color: var(--color-accent);
  text-decoration: underline;
  text-underline-offset: 2px;
  text-decoration-thickness: 1px;
}
.docs-prose a:not([data-mdx-chrome]):hover {
  text-decoration-thickness: 2px;
}

/* A callout's links take its tone, so a warning callout does not sprout
 * accent-blue links, and gain weight to carry against the tinted ground. */
[data-mdx="callout"] .mdx-callout-body a:not([data-mdx-chrome]) {
  color: var(--callout-tone-text);
  font-weight: 500;
}

/* Absolute hrefs read as off-site before they are clicked. Decorative: the
 * glyph inherits currentColor and is not announced. */
.docs-prose a[href^="http"]:not([data-mdx-chrome])::after {
  content: '\2197';
  display: inline-block;
  margin-left: 2px;
  font-size: 0.85em;
  text-decoration: none;
  vertical-align: baseline;
}
```

Then add the prose link to the shared docs focus ring. In `apps/website/src/styles/docs.css`, find the selector list beginning `[data-docs-navlink]:focus-visible,` (around line 1592) and add this line directly after it:

```css
.docs-prose a:not([data-mdx-chrome]):focus-visible,
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd apps/website && GROWTH_FORM_POLICY=growth_v1 npx vitest run --config vite.config.mts src/styles/style-contracts.spec.ts
```

Expected: PASS, all tests in the file.

- [ ] **Step 5: Mutation-check the contract**

The repo has shipped a suite that passed before the feature it covered existed. Prove this one bites: temporarily change `color: var(--color-accent);` inside `.docs-prose a:not([data-mdx-chrome])` to `color: var(--color-text-primary);`, re-run the command from Step 4, and confirm the test named `docs.css .docs-prose a:not([data-mdx-chrome]) > declares color` **fails**. Then restore `var(--color-accent)` and confirm it passes again. Do not commit the mutation.

- [ ] **Step 6: Add the `data-mdx-chrome` opt-out to component anchors**

In `apps/website/src/components/docs/mdx/Card.tsx`, line 33, add the attribute:

```tsx
    <Link href={href} className="mdx-card-link" data-mdx-chrome="" {...externalProps}>
```

In `apps/website/src/components/docs/mdx/FeatureChips.tsx`, line 26:

```tsx
        <Link key={chip.title} href={chip.href} className="mdx-chip-link" data-mdx-chrome="">
```

In `apps/website/src/components/docs/mdx/headings.tsx`, line 36:

```tsx
  return <a href={`#${id}`} aria-label={`Link to ${label}`} className="heading-anchor" data-mdx-chrome="" />;
```

- [ ] **Step 7: Run the affected component suites**

```bash
cd apps/website && GROWTH_FORM_POLICY=growth_v1 npx vitest run --config vite.config.mts src/components/docs/mdx
```

Expected: PASS. These specs assert class names and text, not attributes, so adding one attribute must not disturb them. If `headings.spec.tsx` asserts an exact serialized anchor string, update that expectation to include `data-mdx-chrome=""`.

- [ ] **Step 8: Verify in the browser**

Start the preview (`preview_start` with `{name: "website-dev"}`), then read the computed styles on the page that exposed the bug:

```js
const inCallout = document.querySelector('[data-mdx="callout"] .mdx-callout-body a');
const inProse = document.querySelector('.docs-prose > p a');
JSON.stringify([inCallout, inProse].map(a => {
  const c = getComputedStyle(a);
  return { text: a.textContent.trim(), color: c.color, td: c.textDecorationLine, fw: c.fontWeight };
}));
```

Run it with `javascript_tool` against `http://localhost:3000/docs/ag-ui/getting-started/introduction`.
Expected: both entries report `td: "underline"`; the callout link reports the tip tone `rgb(26, 122, 64)` and `fw: "500"`; the prose link reports the accent color. Before this task both reported `td: "none"` and weight 400.

Also confirm a card link is untouched: `getComputedStyle(document.querySelector('.mdx-card-link')).textDecorationLine` on a page that uses `<Card>` must still be `"none"`.

- [ ] **Step 9: Commit**

```bash
git add apps/website/src/styles/docs.css apps/website/src/styles/style-contracts.spec.ts apps/website/src/components/docs/mdx/Card.tsx apps/website/src/components/docs/mdx/FeatureChips.tsx apps/website/src/components/docs/mdx/headings.tsx
git commit -m "fix(docs): give docs prose links a visible affordance

Tailwind Typography is inert in this app, so MdxRenderer's prose classes
emitted no rules and --tw-prose-links set a variable nothing read. Every
docs link rendered as plain body text; callouts made it most visible.
Adds explicit .docs-prose link rules, tones callout links to the
callout, marks absolute hrefs as off-site, and gives component anchors a
data-mdx-chrome opt-out.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Run on the docs index points at the default example

`DocsControlPlane` hardcodes `disabled` on Run/Code/API with the reason "this page has no workspace capability." That is honest on a docs-only page. On `/docs` it is a dead end: there is no page-specific example there, so the canonical example is the only meaningful target.

`/workspace/langgraph/streaming` **404s** — that capability has a `docsPath`, so `getWorkspaceDestinationPath()` makes its canonical destination the docs route, and the `/workspace/[product]/[topic]` route deliberately skips such entries. Derive the href from the registry instead of writing a literal path; the correct URL today is `/docs/langgraph/guides/streaming?mode=run`.

The href arrives as a prop rather than being inferred from the pathname, because `DocsControlPlane` is also used by `/docs/choosing-an-adapter` with `activeLibrary={null}` and that page keeps its disabled rail.

**Files:**
- Modify: `apps/website/src/components/docs/DocsControlPlane.tsx`
- Modify: `apps/website/src/app/docs/page.tsx`
- Test: `apps/website/src/components/docs/DocsControlPlane.spec.tsx:353-381`

- [ ] **Step 1: Write the failing tests**

In `apps/website/src/components/docs/DocsControlPlane.spec.tsx`, replace the whole `describe('DocsControlPlane — library-neutral', ...)` block (currently lines 353-381, the `it.each` over `/docs` and `/docs/choosing-an-adapter`) with:

```tsx
describe('DocsControlPlane — library-neutral', () => {
  it('keeps every standalone control disabled on the adapter comparison page', () => {
    render(
      <DocsControlPlane
        activeLibrary={null}
        activeSection=""
        activeSlug=""
        pageTitle="Choosing an adapter"
      />,
    );

    for (const mode of ['Run', 'Code', 'API'] as const) {
      const control = screen.getByRole('button', {
        name: mode,
        description: `${mode} is unavailable because this page has no workspace capability.`,
      });
      expect(control.getAttribute('href')).toBeNull();
      fireEvent.click(control);
    }
    expect(track).not.toHaveBeenCalled();
  });

  it('sends Run to the default example when the index supplies one', () => {
    render(
      <DocsControlPlane
        activeLibrary={null}
        activeSection=""
        activeSlug=""
        pageTitle="Overview"
        runHref="/docs/langgraph/guides/streaming?mode=run"
      />,
    );

    // href turns the rail item into an <a>, so it is a link, not a button.
    expect(
      screen.getByRole('link', { name: 'Run' }).getAttribute('href'),
    ).toBe('/docs/langgraph/guides/streaming?mode=run');

    // The index still has no Code or API view of its own.
    for (const mode of ['Code', 'API'] as const) {
      expect(
        screen.getByRole('button', {
          name: mode,
          description: `${mode} is unavailable because this page has no workspace capability.`,
        }).getAttribute('href'),
      ).toBeNull();
    }
  });
});
```

Then add a test asserting the index actually resolves a real href. Append to `apps/website/src/app/docs/docs-index-shell.spec.tsx`, inside `describe('docs index', ...)`:

```tsx
  it('wires Run to the canonical default example route', () => {
    render(<DocsLandingPage />);

    // Registry-derived, not hardcoded: /workspace/langgraph/streaming 404s
    // because that capability's canonical destination is its docs route.
    expect(
      screen.getByRole('link', { name: 'Run' }).getAttribute('href'),
    ).toBe('/docs/langgraph/guides/streaming?mode=run');
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd apps/website && GROWTH_FORM_POLICY=growth_v1 npx vitest run --config vite.config.mts src/components/docs/DocsControlPlane.spec.tsx src/app/docs/docs-index-shell.spec.tsx
```

Expected: FAIL. The new `DocsControlPlane` test fails on the unknown `runHref` prop (TypeScript) and on `getByRole('link', { name: 'Run' })` finding nothing; the index test fails the same way.

- [ ] **Step 3: Add the `runHref` prop to the rail**

In `apps/website/src/components/docs/DocsControlPlane.tsx`, extend the props interface:

```ts
export interface DocsControlPlaneProps {
  /** `null` on a library-neutral docs page, e.g. /docs/choosing-an-adapter. */
  activeLibrary: LibraryId | null;
  activeSection: string;
  activeSlug: string;
  pageTitle: string;
  /**
   * Where the Run rail item goes on a page that has no example of its own.
   *
   * Only the docs index supplies this. Run normally means "run the example on
   * this page", and a docs-only page correctly has none — but the index is not
   * a capability page at all, so the canonical example is the only meaningful
   * target. Absent, Run stays disabled.
   */
  runHref?: string;
}
```

`DocsContextContent` takes the same props object but ignores `runHref`, which is harmless — it destructures only the fields it uses.

In `DocsControlPlane`, replace the Run rail item:

```tsx
            {props.runHref ? (
              <ControlPlaneRailItem
                label="Run"
                icon={<Play size={18} aria-hidden="true" />}
                href={props.runHref}
              />
            ) : (
              <ControlPlaneRailItem
                label="Run"
                icon={<Play size={18} aria-hidden="true" />}
                disabled
                disabledReason={disabledReason('Run')}
              />
            )}
```

Leave the Code and API items exactly as they are.

- [ ] **Step 4: Resolve the href on the index from the registry**

In `apps/website/src/app/docs/page.tsx`, add to the imports:

```ts
import {
  getCanonicalWebsiteWorkspaceHref,
  resolveWorkspacePath,
} from '@threadplane/cockpit-registry';
```

Add at module scope, below the `metadata` export:

```ts
/**
 * The example the index's Run rail item opens.
 *
 * Resolved through the registry rather than written as a path: this
 * capability publishes a `docsPath`, so `getWorkspaceDestinationPath()` makes
 * its canonical destination the docs route and `/workspace/langgraph/streaming`
 * 404s. Today this yields `/docs/langgraph/guides/streaming?mode=run`, and it
 * stays correct if that docs path moves. A renamed or removed capability
 * resolves to null, and Run falls back to disabled rather than to a dead link.
 */
const DEFAULT_EXAMPLE = resolveWorkspacePath('/workspace/langgraph/streaming');
const DEFAULT_EXAMPLE_RUN_HREF = DEFAULT_EXAMPLE
  ? getCanonicalWebsiteWorkspaceHref(DEFAULT_EXAMPLE, 'Run')
  : undefined;
```

Then pass it to the control plane in the JSX:

```tsx
      <DocsControlPlane
        activeLibrary={null}
        activeSection=""
        activeSlug=""
        pageTitle={DOCS_INDEX_TITLE}
        runHref={DEFAULT_EXAMPLE_RUN_HREF}
      />
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
cd apps/website && GROWTH_FORM_POLICY=growth_v1 npx vitest run --config vite.config.mts src/components/docs/DocsControlPlane.spec.tsx src/app/docs/docs-index-shell.spec.tsx
```

Expected: PASS.

- [ ] **Step 6: Verify the destination actually runs**

With the preview server up, navigate to `http://localhost:3000/docs`, then use `find` for "Run" and read its href, or read the page with `read_page`. Then navigate to the href it reports and confirm with `get_page_text` that the page loads and reports `runtime ready` — not a 404. (This was verified manually during design: `/docs/langgraph/guides/streaming?mode=run` loads and reports `runtime ready`.)

- [ ] **Step 7: Commit**

```bash
git add apps/website/src/components/docs/DocsControlPlane.tsx apps/website/src/components/docs/DocsControlPlane.spec.tsx apps/website/src/app/docs/page.tsx apps/website/src/app/docs/docs-index-shell.spec.tsx
git commit -m "feat(docs): point the index Run rail item at the default example

The docs index is not a capability page, so 'no workspace capability'
left Run a dead control. It now links the canonical example, resolved
through the registry because that capability publishes a docsPath and
/workspace/langgraph/streaming 404s. Passed as a prop so the adapter
comparison page keeps its disabled rail.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Scope card becomes a search trigger

The `Scope` section repeats the breadcrumb trail, which Task 5 gives a single owner. It is replaced by a search trigger in the same position, wired to the `openSearch()` that already exists (including the mobile drawer handoff). The `Search docs` icon button then leaves the Actions bar, where it would be a second control for the same thing — and `Actions` renders only when something is left in it, or `/docs` would show an empty section with a heading.

`docs.css` already contains an orphaned `.docs-sidebar-search-*` block (lines 899-928) from a retired sidebar trigger — nothing in any `.tsx` references it. This task replaces it with accurately-named rules rather than leaving dead CSS behind.

**Files:**
- Modify: `apps/website/src/components/docs/DocsControlPlane.tsx`
- Modify: `apps/website/src/styles/docs.css:899-928` (replace) and the focus-ring list (~line 1595)
- Test: `apps/website/src/components/docs/DocsControlPlane.spec.tsx`, `apps/website/src/app/docs/docs-index-shell.spec.tsx`

- [ ] **Step 1: Write the failing tests**

In `apps/website/src/components/docs/DocsControlPlane.spec.tsx`:

Replace the test named `shows truthful scope without the retired Cockpit Runtime preview` (lines 162-183) with:

```tsx
  it('leads with search instead of restating the breadcrumb', () => {
    const listener = vi.fn();
    document.addEventListener('keydown', listener);
    render(
      <DocsControlPlane
        activeLibrary="langgraph"
        activeSection="guides"
        activeSlug="streaming"
        pageTitle="Streaming"
      />
    );

    // The trail is the shell header's job now; a Scope card here said the
    // same thing a third time.
    expect(screen.queryByRole('heading', { name: 'Scope' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Search docs' }));
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'k', metaKey: true })
    );
    document.removeEventListener('keydown', listener);

    expect(screen.queryByRole('button', { name: 'Environment' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Runtime' })).toBeNull();
    expect(screen.queryByText('Cockpit')).toBeNull();
  });

  it('drops the Actions bar when search was its only member', () => {
    render(
      <DocsControlPlane
        activeLibrary="langgraph"
        activeSection="guides"
        activeSlug="streaming"
        pageTitle="Streaming"
      />
    );

    // LangGraph publishes no demoUrl, so nothing is left to put in Actions.
    expect(screen.queryByRole('toolbar', { name: 'Docs actions' })).toBeNull();
  });
```

Delete the test named `keeps search as a real icon action` (lines 185-200): the trigger it covers is now the pane's search button, asserted above.

Replace the test named `states only what it knows in Scope` (lines 383-397) with:

```tsx
  it('offers search on a library-neutral page too', () => {
    render(
      <DocsControlPlane
        activeLibrary={null}
        activeSection=""
        activeSlug=""
        pageTitle="Choosing an adapter"
      />,
    );

    expect(screen.queryByRole('heading', { name: 'Scope' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Search docs' })).toBeTruthy();
  });
```

In the `describe('DocsContextContent', ...)` block, in the test named `reuses the same sentence-case navigation content for mobile`, replace these two lines:

```tsx
    expect(screen.getByRole('heading', { name: 'Scope' })).toBeTruthy();
    ...
    expect(screen.getByRole('toolbar', { name: 'Docs actions' })).toBeTruthy();
```

with:

```tsx
    expect(screen.getByRole('button', { name: 'Search docs' })).toBeTruthy();
    // json-render publishes no demoUrl, so Actions has nothing left to hold.
    expect(screen.queryByRole('toolbar', { name: 'Docs actions' })).toBeNull();
```

In `apps/website/src/app/docs/docs-index-shell.spec.tsx`, replace the test named `wears the same control plane as every other docs route` with:

```tsx
  it('wears the same control plane as every other docs route', () => {
    render(<DocsLandingPage />);

    expect(screen.queryByRole('heading', { name: 'Scope' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Search docs' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Choose a library' })).toBeTruthy();
  });
```

The `within` import in that file becomes unused once this test changes — remove it from the import list if nothing else uses it, or ESLint will fail the build.

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd apps/website && GROWTH_FORM_POLICY=growth_v1 npx vitest run --config vite.config.mts src/components/docs/DocsControlPlane.spec.tsx src/app/docs/docs-index-shell.spec.tsx
```

Expected: FAIL — `queryByRole('heading', { name: 'Scope' })` still finds the Scope heading, and the Actions toolbar is still present.

- [ ] **Step 3: Replace the Scope section with the search trigger**

In `apps/website/src/components/docs/DocsControlPlane.tsx`, inside `DocsContextContent`, delete the entire `<ControlPlaneSection title="Scope" collapsible={false}>` block (including its explanatory comment about neutral pages, which described behavior that no longer exists) and put the trigger in its place:

```tsx
      <button
        type="button"
        className="docs-control-plane-search-trigger"
        onClick={openSearch}
        data-docs-control-plane-search
      >
        <span className="docs-control-plane-search-inner">
          <Search size={14} aria-hidden="true" />
          <span className="docs-control-plane-search-label">Search docs</span>
        </span>
        {/* Hidden where there is no keyboard to press it — see docs.css. */}
        <kbd className="docs-control-plane-search-kbd" aria-hidden="true">⌘K</kbd>
      </button>
```

The accessible name comes from the visible label `Search docs`, so `getByRole('button', { name: 'Search docs' })` resolves to this trigger.

Then make the Actions section conditional. Replace the whole `<ControlPlaneSection title="Actions" ...>` block with:

```tsx
      {library?.demoUrl ? (
        <ControlPlaneSection title="Actions" collapsible={false}>
          <ControlPlaneActionBar label="Docs actions">
            <ControlPlaneIconButton
              label={library.demoLabel ?? 'Open live demo'}
              icon={<ExternalLink size={16} aria-hidden="true" />}
              href={library.demoUrl}
              target="_blank"
              rel="noopener noreferrer"
            />
          </ControlPlaneActionBar>
        </ControlPlaneSection>
      ) : null}
```

Two clean-ups follow, and both are ESLint **errors** if skipped:

- The `section` constant (`getDocsSection(activeLibrary, activeSection)`) was read only by the Scope card. Delete it, and drop `getDocsSection` from the `docs-config` import. `getLibraryConfig` stays — `library?.demoUrl` still needs it.
- `ControlPlaneActionBar` and `ControlPlaneIconButton` are still used by the conditional Actions block, and `Search` is still used by the new trigger, so the `lucide-react` and `@threadplane/ui-react` imports are unchanged.

- [ ] **Step 4: Replace the orphaned sidebar-search CSS**

In `apps/website/src/styles/docs.css`, delete the block from `.docs-sidebar-search-trigger {` through the end of `.docs-sidebar-search-kbd { ... }` (lines 899-928 — nothing in any `.tsx` references these class names) and put this in its place:

```css
/* Control-plane search trigger.
 *
 * Replaces the Scope card, which restated the breadcrumb the shell header now
 * owns. Styled as an input rather than a button because it opens a search
 * dialog, and the ⌘K hint is a hint: on a coarse pointer there is no ⌘K to
 * press, so it is hidden and the button itself is the affordance. Rules
 * inherited from the retired sidebar trigger this replaces. */
.docs-control-plane-search-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  padding: 7px 10px;
  margin-bottom: 12px;
  border-radius: var(--radius-md);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text-muted);
  cursor: pointer;
  box-shadow: var(--shadow-sm);
  transition: border-color 120ms ease, box-shadow 120ms ease;
}
.docs-control-plane-search-trigger:hover {
  border-color: var(--color-border-strong);
}
.docs-control-plane-search-inner {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.docs-control-plane-search-label {
  font-family: var(--font-inter);
  font-size: 0.8rem;
}
.docs-control-plane-search-kbd {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  color: var(--color-text-muted);
  background: var(--color-surface-dim);
  border: 1px solid var(--color-border);
  border-radius: 5px;
  padding: 2px 6px;
  line-height: 1.2;
}
@media (pointer: coarse) {
  .docs-control-plane-search-kbd {
    display: none;
  }
}
```

Then in the focus-ring selector list (~line 1595), replace the line `.docs-sidebar-search-trigger:focus-visible,` with:

```css
.docs-control-plane-search-trigger:focus-visible,
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
cd apps/website && GROWTH_FORM_POLICY=growth_v1 npx vitest run --config vite.config.mts src/components/docs/DocsControlPlane.spec.tsx src/app/docs/docs-index-shell.spec.tsx
```

Expected: PASS.

- [ ] **Step 6: Verify no dead class names remain**

```bash
cd /Users/blove/repos/angular-agent-framework/.claude/worktrees/gallant-clarke-963ed0 && grep -rn "docs-sidebar-search" apps/website/src || echo "clean"
```

Expected: `clean`.

- [ ] **Step 7: Verify in the browser**

Navigate to `http://localhost:3000/docs` and `http://localhost:3000/docs/ag-ui/getting-started/introduction`, take a screenshot of each, and confirm: the pane leads with a full-width search field, no `Scope` heading appears, `/docs` shows no empty Actions section, and the AG-UI page still shows its `Open live demo` action. Then click the trigger and confirm with `read_page` that the search dialog opens.

- [ ] **Step 8: Commit**

```bash
git add apps/website/src/components/docs/DocsControlPlane.tsx apps/website/src/components/docs/DocsControlPlane.spec.tsx apps/website/src/app/docs/docs-index-shell.spec.tsx apps/website/src/styles/docs.css
git commit -m "feat(docs): lead the control plane with search, not Scope

The Scope card restated the breadcrumb trail. It is replaced by a
full-width search trigger wired to the existing openSearch handoff, the
now-duplicate Search icon leaves the Actions bar, and Actions renders
only when something is left in it. Retires the orphaned
.docs-sidebar-search-* rules the trigger's styling came from.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: `contextTrail` on the shared workspace shell

`workspace-shell.tsx:170-179` derives its header label from the manifest identity, which is why a docs page reads `Ag Ui / Getting Started / Overview`: `toLabel()` casing and `page: 'overview'` are manifest facts, not docs facts. It also renders as a muted mono `<p>` — decoration, not navigation.

This task adds an optional prop so a host can hand the shell an accurate, linked trail. Cockpit passes nothing and its behavior is byte-identical.

**Files:**
- Modify: `libs/workspace-react/src/lib/workspace-contracts.ts`
- Modify: `libs/workspace-react/src/lib/workspace-shell.tsx:87-119` (props) and `:399-402` (the header `<p>`)
- Test: `libs/workspace-react/src/lib/workspace-shell.spec.tsx`

- [ ] **Step 1: Write the failing tests**

In `libs/workspace-react/src/lib/workspace-shell.spec.tsx`, extend the `renderWorkspace` helper's options type and pass the prop through. Add to the options interface (after `rootElement?: 'main' | 'section';`):

```ts
  contextTrail?: readonly WorkspaceCrumb[];
```

Add `WorkspaceCrumb` to the imports from `./workspace-contracts`:

```ts
import type { WorkspaceCrumb } from './workspace-contracts';
```

And pass it in the `<WorkspaceShell>` element inside the helper:

```tsx
        <WorkspaceShell
          navigationTree={[]}
          manifest={cockpitManifest}
          rootElement={options.rootElement}
          contextTrail={options.contextTrail}
        />
```

Then append a new describe block at the end of the file:

```tsx
describe('WorkspaceShell header trail', () => {
  afterEach(() => {
    window.localStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  it('keeps the derived mono label when no host supplies a trail', () => {
    renderWorkspace({ requestedMode: 'docs' });

    // Cockpit passes no trail, so nothing about its header may change.
    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).toBeNull();
    expect(screen.getByText('LangGraph / Core Capabilities / Streaming')).toBeTruthy();
  });

  it('renders a supplied trail as a real breadcrumb', () => {
    renderWorkspace({
      requestedMode: 'docs',
      contextTrail: [
        { label: 'Docs', href: '/docs' },
        { label: 'AG-UI', href: '/docs/ag-ui/getting-started/introduction' },
        { label: 'Getting Started' },
        { label: 'Introduction' },
      ],
    });

    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(nav).toBeTruthy();

    // Rungs with an href link; rungs without are plain text, because no
    // section index route exists to point the section rung at.
    expect(within(nav).getByRole('link', { name: 'Docs' }).getAttribute('href')).toBe('/docs');
    expect(
      within(nav).getByRole('link', { name: 'AG-UI' }).getAttribute('href'),
    ).toBe('/docs/ag-ui/getting-started/introduction');
    expect(within(nav).queryByRole('link', { name: 'Getting Started' })).toBeNull();

    // The last rung is the current page and is never a link.
    const current = within(nav).getByText('Introduction');
    expect(current.getAttribute('aria-current')).toBe('page');
    expect(current.tagName).not.toBe('A');

    // The derived label must not also be present — that was the duplication.
    expect(screen.queryByText('LangGraph / Core Capabilities / Streaming')).toBeNull();
  });
});
```

Add `within` to the `@testing-library/react` import at the top of the file if it is not already there.

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd libs/workspace-react && npx vitest run --config vite.config.mts src/lib/workspace-shell.spec.tsx
```

Expected: FAIL — TypeScript rejects the unknown `contextTrail` prop and `WorkspaceCrumb` does not exist.

- [ ] **Step 3: Declare the type**

Append to `libs/workspace-react/src/lib/workspace-contracts.ts`:

```ts
/**
 * One rung of the shell header's location trail.
 *
 * A rung with no `href` is plain text. That is not an oversight: the docs
 * tree has no section index route, so its section rung has nowhere to point,
 * and inventing a URL for it would 404.
 */
export interface WorkspaceCrumb {
  readonly label: string;
  readonly href?: string;
}
```

The package index already re-exports everything from `workspace-contracts`, so no change to `src/index.ts` is needed.

- [ ] **Step 4: Render the trail in the shell header**

In `libs/workspace-react/src/lib/workspace-shell.tsx`, add the import:

```ts
import type { WorkspaceCrumb } from './workspace-contracts';
```

(If the file already imports named types from `./workspace-contracts`, add `WorkspaceCrumb` to that list instead of adding a second import.)

Add to `WorkspaceShellProps`, after `readonly headerActions?: ReactNode;`:

```ts
  /**
   * An accurate location trail supplied by the host.
   *
   * Absent, the header keeps the label derived from the manifest identity —
   * which is what cockpit wants and what a docs route does not: the manifest's
   * `toLabel()` casing and `page: 'overview'` made a docs page read
   * "Ag Ui / Getting Started / Overview".
   */
  readonly contextTrail?: readonly WorkspaceCrumb[];
```

Add `contextTrail,` to the destructured parameter list in the function signature (after `headerActions,`).

Then replace the header's context label element. Find:

```tsx
            <p className="text-[var(--ds-text-muted)] font-mono text-xs truncate">
              {contextLabel}
            </p>
```

and replace it with:

```tsx
            {contextTrail && contextTrail.length > 0 ? (
              <nav aria-label="Breadcrumb" data-workspace-trail>
                <ol data-workspace-trail-list>
                  {contextTrail.map((crumb, index) => {
                    const isLast = index === contextTrail.length - 1;
                    return (
                      <li key={`${crumb.label}-${index}`}>
                        {crumb.href && !isLast ? (
                          <a href={crumb.href} data-workspace-trail-link>
                            {crumb.label}
                          </a>
                        ) : (
                          <span
                            data-workspace-trail-current={isLast || undefined}
                            aria-current={isLast ? 'page' : undefined}
                          >
                            {crumb.label}
                          </span>
                        )}
                        {isLast ? null : (
                          <span data-workspace-trail-separator aria-hidden="true">
                            /
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </nav>
            ) : (
              <p className="text-[var(--ds-text-muted)] font-mono text-xs truncate">
                {contextLabel}
              </p>
            )}
```

Note the last rung is never a link even if it carries an `href` — it is the page you are on.

- [ ] **Step 5: Add the shell's own baseline styling**

The website will refine this, but cockpit must not be left with an unstyled list. Append to `libs/workspace-react/src/styles/workspace.css` — the stylesheet the shell's other selectors live in, and the one a dozen specs in this library read with `loadStylesheet`-style `readFileSync`:

```css
/* Shell header location trail. Structure lives in workspace-shell.tsx; a host
 * may restyle it through these attributes. This is the floor, not the design. */
[data-workspace-trail] ol[data-workspace-trail-list] {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  row-gap: 4px;
  font-size: 0.75rem;
  line-height: 1.5;
  color: var(--ds-text-muted);
}
[data-workspace-trail-link] {
  color: var(--ds-text-muted);
  text-decoration: none;
}
[data-workspace-trail-link]:hover {
  color: var(--ds-text-primary);
}
[data-workspace-trail-separator] {
  margin: 0 8px;
}
[data-workspace-trail-current] {
  color: var(--ds-text-primary);
  font-weight: 600;
}
```

- [ ] **Step 6: Run the tests to verify they pass**

```bash
cd libs/workspace-react && npx vitest run --config vite.config.mts src/lib/workspace-shell.spec.tsx
```

Expected: PASS, all 17 tests.

- [ ] **Step 7: Confirm the public API surface test still passes**

```bash
cd libs/workspace-react && npx vitest run --config vite.config.mts src/lib/public-api.spec.tsx
```

Expected: PASS. If that spec enumerates exports, add `WorkspaceCrumb` to its expected list.

- [ ] **Step 8: Commit**

```bash
git add libs/workspace-react/src
git commit -m "feat(workspace-react): let a host supply the header trail

The header derived its label from the manifest identity, so a docs route
read 'Ag Ui / Getting Started / Overview' in muted mono. An optional
contextTrail renders a real breadcrumb nav with linked rungs instead.
Absent the prop, cockpit's derived label is unchanged.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: One trail on doc pages

With the shell able to render a trail, the website supplies it and the two duplicate renditions go: `DocsBreadcrumb` is deleted, and `DocsPageHeader` loses the `lib · section` label the trail now states.

**Files:**
- Modify: `apps/website/src/components/workspace/WebsiteWorkspace.tsx`
- Modify: `apps/website/src/app/docs/[library]/[section]/[slug]/page.tsx`
- Delete: `apps/website/src/components/docs/DocsBreadcrumb.tsx`
- Modify: `apps/website/src/components/docs/DocsPageHeader.tsx`
- Modify: `apps/website/src/styles/docs.css:1058-1090` (the `.docs-crumb-*` block) and the focus-ring list
- Test: `apps/website/src/app/docs/[library]/[section]/[slug]/page.spec.tsx`

- [ ] **Step 1: Write the failing tests**

In `apps/website/src/app/docs/[library]/[section]/[slug]/page.spec.tsx`:

Remove the `DocsBreadcrumb` import. In the test named `keeps an unmapped page as a complete server Docs slot`, delete these lines:

```tsx
    expect(
      findElement(slot, DocsBreadcrumb as ComponentType<never>)
    ).toBeTruthy();
```

Then append a new test inside the same `describe`:

```tsx
  it('hands the shell one accurate trail instead of four renditions', async () => {
    const tree = await route('ag-ui', 'getting-started', 'introduction');
    const workspace = findElement(
      tree,
      WebsiteWorkspace as ComponentType<never>
    );

    // Docs titles, not manifest identity: the derived label read
    // "Ag Ui / Getting Started / Overview".
    expect(workspace?.props.contextTrail).toEqual([
      { label: 'Docs', href: '/docs' },
      { label: 'AG-UI', href: '/docs/ag-ui/getting-started/introduction' },
      { label: 'Getting Started' },
      { label: 'Introduction' },
    ]);
  });
```

Add `contextTrail?: readonly { label: string; href?: string }[];` to the local `ElementProps` interface at the top of the file so the assertion type-checks.

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd apps/website && GROWTH_FORM_POLICY=growth_v1 npx vitest run --config vite.config.mts "src/app/docs/[library]/[section]/[slug]/page.spec.tsx"
```

Expected: FAIL — `contextTrail` is `undefined`.

- [ ] **Step 3: Forward the prop through the client boundary**

In `apps/website/src/components/workspace/WebsiteWorkspace.tsx`:

Add `WorkspaceCrumb` to the type import from `@threadplane/workspace-react`:

```ts
import {
  WorkspaceProvider,
  WorkspaceShell,
  RuntimeTargetProvider,
  readWorkspaceModeQuery,
  type RuntimeTerminalTransition,
  type TrackModeChange,
  type TrackNarrativeAction,
  type TrackNavigation,
  type TrackRuntimeAction,
  type TrackRuntimeTransition,
  type WorkspaceContextPaneRenderer,
  type WorkspaceCrumb,
} from '@threadplane/workspace-react';
```

Add to `WebsiteWorkspaceProps`, after `readonly docsContext?: DocsControlPlaneProps;`:

```ts
  /** Docs routes supply their own trail; workspace routes keep the derived one. */
  readonly contextTrail?: readonly WorkspaceCrumb[];
```

Add `contextTrail,` to the destructured parameters of `WebsiteWorkspaceSurface` (after `docsContext,`), and pass it to the shell:

```tsx
          <WorkspaceShell
            rootElement="section"
            navigationTree={navigationTree}
            contextTrail={contextTrail}
```

Finally, add `props.contextTrail` to the `useLayoutEffect` dependency array in `WebsiteWorkspace` (the list that already ends with `props.docsContext,`), so a trail change re-registers the surface.

- [ ] **Step 4: Build the trail in the route**

In `apps/website/src/app/docs/[library]/[section]/[slug]/page.tsx`:

Remove the `DocsBreadcrumb` import and add `getDocsSection` to the existing `docs-config` import:

```ts
import {
  findDocsPage,
  getDocsSection,
  getLibraryConfig,
  libraryIntroPath,
  type LibraryId,
} from '../../../../../lib/docs-config';
```

Add above the `breadcrumbs` constant in `DocsPage`:

```ts
  // The one visible trail on this page. The shell header renders it; nothing
  // else on the page restates it. Section titles come from docs-config, and
  // the section rung carries no href because there is no section index route.
  const contextTrail = [
    { label: 'Docs', href: '/docs' },
    { label: libConfig.title, href: libraryIntroPath(library) },
    { label: getDocsSection(library, section)?.title ?? section },
    { label: doc.title },
  ];
```

Delete the `<DocsBreadcrumb ... />` element from `docsSlot`.

Update the comment above `breadcrumbs`, which currently explains itself by reference to the deleted component. Replace its first sentence:

```ts
  // Mirrors the visible trail the shell header renders from `contextTrail`,
  // which links the library rung through the same `libraryIntroPath()` — there
  // is no /docs/<library> route, so a crumb pointing there would 404.
```

Leave the rest of that comment (about the omitted section rung) as it is — it is still accurate.

Then pass the trail to the workspace:

```tsx
      <WebsiteWorkspace
        resolution={workspacePage.resolution}
        presentation={workspacePage.presentation}
        contentBundle={workspacePage.contentBundle}
        navigationTree={workspacePage.navigationTree}
        routePath={pathname}
        docsSlot={docsSlot}
        contextTrail={contextTrail}
        docsContext={{ ... }}
      />
```

- [ ] **Step 5: Delete `DocsBreadcrumb` and trim `DocsPageHeader`**

```bash
cd /Users/blove/repos/angular-agent-framework/.claude/worktrees/gallant-clarke-963ed0 && git rm apps/website/src/components/docs/DocsBreadcrumb.tsx
grep -rn "DocsBreadcrumb" apps/website/src libs || echo "no references remain"
```

Expected: `no references remain`. If anything is reported, fix it before continuing.

Then rewrite `apps/website/src/components/docs/DocsPageHeader.tsx` in full — the `humanize` helper and both `docs-config` lookups become unused once the label is gone:

```tsx
import type { ReactNode } from 'react';
import { LibraryMark } from './LibraryMark';
import type { LibraryId } from '../../lib/docs-config';

interface Props {
  library: LibraryId;
  /** Right-aligned slot for per-page actions (Spec 2). Optional. */
  actions?: ReactNode;
}

/**
 * The mark-and-actions row above an article.
 *
 * It used to also print "<library> · <section>", which the shell header's
 * breadcrumb trail now states. Two renditions of the same location, stacked,
 * is what made the page look like it had duplicate breadcrumbs.
 */
export function DocsPageHeader({ library, actions }: Props) {
  return (
    <div className="docs-page-header">
      <div className="docs-page-header-lib">
        <LibraryMark library={library} size={34} />
      </div>
      {actions ? <div className="docs-page-header-actions">{actions}</div> : null}
    </div>
  );
}
```

Then drop the now-unused `section` prop at the call site in `page.tsx`:

```tsx
            <DocsPageHeader
              library={library as LibraryId}
              actions={
                <PageActions
                  library={library}
                  section={section}
                  slug={slug}
                  headings={headings}
                />
              }
            />
```

- [ ] **Step 6: Move the crumb typography onto the shell's attributes**

In `apps/website/src/styles/docs.css`, replace the whole `.docs-crumb-*` block (lines 1058-1090, from the `/* DocsBreadcrumb — ... */` comment through `.docs-crumb-current { ... }`) with:

```css
/* Shell header location trail (workspace-shell.tsx renders the structure).
 *
 * Every selector is scoped under .website-workspace-host, and not for
 * tidiness: workspace.css in the shell library styles the same attributes at
 * the same specificity, so an unscoped rule here would win or lose on
 * stylesheet order alone. The host class makes the site's treatment
 * deterministically more specific.
 *
 * Typography on the LIST, not the links: the separators are siblings of the
 * links inside each li, and when only the links carried 13px the first two
 * separators inherited body's 16px/24px and floated 3px high. */
.website-workspace-host [data-workspace-trail] ol[data-workspace-trail-list] {
  font-family: var(--font-inter);
  font-size: 13px;
  line-height: 1.5;
  color: var(--color-text-muted);
}
.website-workspace-host [data-workspace-trail-link] {
  color: var(--color-text-muted);
  text-decoration: none;
}
.website-workspace-host [data-workspace-trail-link]:hover {
  color: var(--color-accent);
}
.website-workspace-host [data-workspace-trail-separator] {
  color: var(--color-text-muted);
}
.website-workspace-host [data-workspace-trail-current] {
  color: var(--color-text-primary);
  font-weight: 600;
}
```

In the focus-ring selector list (~line 1592), replace `.docs-crumb-link:focus-visible,` with:

```css
.website-workspace-host [data-workspace-trail-link]:focus-visible,
```

- [ ] **Step 7: Run the tests to verify they pass**

```bash
cd apps/website && GROWTH_FORM_POLICY=growth_v1 npx vitest run --config vite.config.mts src/app/docs src/components/docs src/components/workspace
```

Expected: PASS. Any suite still importing `DocsBreadcrumb` fails at import — fix it rather than restoring the file.

- [ ] **Step 8: Verify the duplication is actually gone**

Navigate to `http://localhost:3000/docs/ag-ui/getting-started/introduction` and take a screenshot. Confirm exactly one trail is visible, reading `Docs / AG-UI / Getting Started / Introduction`; that `Ag Ui / Getting Started / Overview` and `AG-UI · GETTING STARTED` are both gone; and that the library mark and the `···` page-actions menu are still in place. Then count the trails programmatically with `javascript_tool`:

```js
JSON.stringify({
  navs: document.querySelectorAll('nav[aria-label="Breadcrumb"]').length,
  text: document.querySelector('nav[aria-label="Breadcrumb"]')?.textContent,
});
```

Expected: `navs: 1`, and the text contains `Docs`, `AG-UI`, `Getting Started` and `Introduction`.

Also check a Run-mode page, where the cockpit sidebar rather than the docs pane renders, to confirm the header trail is still correct: `http://localhost:3000/docs/langgraph/guides/streaming?mode=run`.

- [ ] **Step 9: Commit**

```bash
git add -A apps/website/src libs/workspace-react
git commit -m "fix(docs): render one breadcrumb trail per doc page

A doc page showed the same trail four times: the shell's derived mono
label, DocsBreadcrumb, DocsPageHeader's lib-dot-section label, and the
Scope card. The shell header now renders an accurate linked trail built
from docs-config; DocsBreadcrumb is deleted and the header keeps only
its library mark and actions.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Callout CTA components

Two components rather than one prop pair on `Callout`, because the AG-UI introduction wants a primary action and a comparison action side by side and a single `ctaLabel`/`ctaHref` pair cannot express that without growing a second pair.

**Files:**
- Create: `apps/website/src/components/docs/mdx/CalloutActions.tsx`
- Create: `apps/website/src/components/docs/mdx/CalloutActions.spec.tsx`
- Modify: `apps/website/src/components/docs/MdxRenderer.tsx`
- Modify: `apps/website/src/styles/docs.css`

- [ ] **Step 1: Write the failing test**

Create `apps/website/src/components/docs/mdx/CalloutActions.spec.tsx`:

```tsx
// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { CalloutAction, CalloutActions } from './CalloutActions';

describe('CalloutAction', () => {
  it('sends absolute hrefs off-site safely', () => {
    render(
      <CalloutAction href="https://ag-ui.threadplane.ai">
        Run the AG-UI demo
      </CalloutAction>
    );

    const link = screen.getByRole('link', { name: 'Run the AG-UI demo' });
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('keeps in-site hrefs in the same tab', () => {
    render(<CalloutAction href="/docs/ag-ui/getting-started/quickstart">Quick Start</CalloutAction>);

    const link = screen.getByRole('link', { name: 'Quick Start' });
    expect(link.getAttribute('target')).toBeNull();
    expect(link.getAttribute('rel')).toBeNull();
  });

  it('defaults to the primary variant and opts out of the prose link rule', () => {
    render(<CalloutAction href="/docs">Docs</CalloutAction>);

    const link = screen.getByRole('link', { name: 'Docs' });
    expect(link.getAttribute('data-variant')).toBe('primary');
    // Without this the .docs-prose underline would corrupt the button.
    expect(link.hasAttribute('data-mdx-chrome')).toBe(true);
  });

  it('honours an explicit secondary variant', () => {
    render(
      <CalloutAction href="https://demo.threadplane.ai" variant="secondary">
        LangGraph demo
      </CalloutAction>
    );

    expect(
      screen.getByRole('link', { name: 'LangGraph demo' }).getAttribute('data-variant')
    ).toBe('secondary');
  });
});

describe('CalloutActions', () => {
  it('groups its actions in one row', () => {
    const { container } = render(
      <CalloutActions>
        <CalloutAction href="https://ag-ui.threadplane.ai">Run</CalloutAction>
        <CalloutAction href="https://demo.threadplane.ai" variant="secondary">
          Compare
        </CalloutAction>
      </CalloutActions>
    );

    const row = container.querySelector('[data-mdx="callout-actions"]');
    expect(row).toBeTruthy();
    expect(within(row as HTMLElement).getAllByRole('link')).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd apps/website && GROWTH_FORM_POLICY=growth_v1 npx vitest run --config vite.config.mts src/components/docs/mdx/CalloutActions.spec.tsx
```

Expected: FAIL — cannot resolve `./CalloutActions`.

- [ ] **Step 3: Write the components**

Create `apps/website/src/components/docs/mdx/CalloutActions.tsx`:

```tsx
import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Call-to-action buttons inside a `<Callout>`.
 *
 * **A CTA belongs only in a callout whose purpose is to send the reader
 * somewhere to run or see something.** Explanatory callouts ("Mental model",
 * "Why this matters", "Node return values merge, not replace") and cautions
 * ("Never expose API keys") keep prose links: 152 callouts ship in the docs
 * and most of them are prose, not doors. A button on an explanation trains
 * readers to ignore buttons.
 *
 * Keep the prose too. The button is the action; the prose is the context that
 * says why you would take it.
 */
export function CalloutActions({ children }: { children: ReactNode }) {
  return <div data-mdx="callout-actions">{children}</div>;
}

interface CalloutActionProps {
  href: string;
  /** `primary` is filled; `secondary` is outlined. Defaults to `primary`. */
  variant?: 'primary' | 'secondary';
  children: ReactNode;
}

export function CalloutAction({
  href,
  variant = 'primary',
  children,
}: CalloutActionProps) {
  const isExternal = href.startsWith('http');

  return (
    <Link
      href={href}
      // `.docs-prose a` underlines text links. This is a button, and an
      // underline through it reads as a rendering bug.
      data-mdx-chrome=""
      data-mdx="callout-action"
      data-variant={variant}
      {...(isExternal
        ? { target: '_blank', rel: 'noopener noreferrer' }
        : {})}
    >
      {children}
    </Link>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd apps/website && GROWTH_FORM_POLICY=growth_v1 npx vitest run --config vite.config.mts src/components/docs/mdx/CalloutActions.spec.tsx
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Register the components with MDX**

In `apps/website/src/components/docs/MdxRenderer.tsx`, add the import after the `Callout` import:

```ts
import { CalloutAction, CalloutActions } from './mdx/CalloutActions';
```

and add both to the `mdxComponents` object, directly after `Callout,`:

```ts
  CalloutActions,
  CalloutAction,
```

- [ ] **Step 6: Style the buttons**

Append to `apps/website/src/styles/docs.css`, after the `.mdx-callout-body > :last-child` rule and before the prose link rules added in Task 1:

```css
/* Callout CTA buttons. The band states what the callout is; these state what
 * to do about it. Tone-aware, so a tip's button is green and an info's blue. */
[data-mdx="callout-actions"] {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
}
[data-mdx="callout-action"] {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border-radius: var(--radius-md);
  border: 1px solid var(--callout-tone-text);
  font-family: var(--font-inter);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.2;
  text-decoration: none;
  transition: background-color 120ms ease, color 120ms ease;
}
[data-mdx="callout-action"][data-variant="primary"] {
  background: var(--callout-tone-text);
  color: var(--color-surface);
}
[data-mdx="callout-action"][data-variant="primary"]:hover {
  filter: brightness(1.1);
}
[data-mdx="callout-action"][data-variant="secondary"] {
  background: transparent;
  color: var(--callout-tone-text);
}
[data-mdx="callout-action"][data-variant="secondary"]:hover {
  background: var(--callout-tone-surface);
}
```

Add the buttons to the shared docs focus ring: in the focus-ring selector list, add this line after the `.docs-prose a:not([data-mdx-chrome]):focus-visible,` line from Task 1:

```css
[data-mdx="callout-action"]:focus-visible,
```

- [ ] **Step 7: Commit**

```bash
git add apps/website/src/components/docs/mdx/CalloutActions.tsx apps/website/src/components/docs/mdx/CalloutActions.spec.tsx apps/website/src/components/docs/MdxRenderer.tsx apps/website/src/styles/docs.css
git commit -m "feat(docs): add CTA buttons for callouts

CalloutActions/CalloutAction render tone-aware buttons inside a callout,
with target and rel applied automatically for absolute hrefs and
data-mdx-chrome so the new prose underline does not run through them.
Two components rather than a ctaHref prop pair because a callout can
want a primary action and a comparison action side by side. The
authoring rule -- CTAs only in callouts that exist to send you
somewhere -- is documented on the component.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Put CTAs in the six demo callouts

Applying the authoring rule to the content tree selects five existing callouts — every callout in the docs whose body is essentially a link to a demo — plus one gap: AG-UI's introduction advertises a live demo and LangGraph's, the flagship adapter, does not.

**Files (all under `apps/website/content/docs`):**
- Modify: `ag-ui/getting-started/introduction.mdx:11-13`
- Modify: `ag-ui/getting-started/quickstart.mdx:9-11`
- Modify: `runtimes/mastra/overview.mdx:12-14`
- Modify: `runtimes/microsoft-agent-framework/overview.mdx:12-14`
- Modify: `runtimes/aws-strands/overview.mdx:12-14`
- Modify: `langgraph/getting-started/introduction.mdx` (new callout)

- [ ] **Step 1: AG-UI introduction**

Replace the `See it live` callout in `apps/website/content/docs/ag-ui/getting-started/introduction.mdx` (lines 11-13):

```mdx
<Callout type="tip" title="See it live">
The AG-UI demo runs this exact chat surface against an AG-UI backend — streaming, tool calls, and generative UI included.

<CalloutActions>
  <CalloutAction href="https://ag-ui.threadplane.ai">Run AG-UI demo</CalloutAction>
  <CalloutAction href="https://demo.threadplane.ai" variant="secondary">Compare LangGraph demo</CalloutAction>
</CalloutActions>
</Callout>
```

The prose loses its two inline links because the buttons now carry them; the sentence still says what the demo is.

- [ ] **Step 2: AG-UI quickstart**

Replace the `Try it first` callout in `apps/website/content/docs/ag-ui/getting-started/quickstart.mdx` (lines 9-11):

```mdx
<Callout type="tip" title="Try it first">
Want to see the finished result before you build?

<CalloutActions>
  <CalloutAction href="https://ag-ui.threadplane.ai">Run AG-UI demo</CalloutAction>
</CalloutActions>
</Callout>
```

- [ ] **Step 3: Mastra runtime overview**

Replace the `See it live` callout in `apps/website/content/docs/runtimes/mastra/overview.mdx` (lines 12-14):

```mdx
<Callout type="tip" title="See it live">
The hosted example runs the Mastra integration end to end. Its backend is [`deployments/ag-ui-mastra`](https://github.com/cacheplane/angular-agent-framework/tree/main/deployments/ag-ui-mastra) rather than the FastAPI deployment the two Python runtimes share.

<CalloutActions>
  <CalloutAction href="https://examples.threadplane.ai/runtimes/mastra/">Run Mastra example</CalloutAction>
  <CalloutAction href="https://github.com/cacheplane/angular-agent-framework/tree/main/cockpit/runtimes/mastra" variant="secondary">View source</CalloutAction>
</CalloutActions>
</Callout>
```

- [ ] **Step 4: Microsoft Agent Framework runtime overview**

Replace the `See it live` callout in `apps/website/content/docs/runtimes/microsoft-agent-framework/overview.mdx` (lines 12-14):

```mdx
<Callout type="tip" title="See it live">
The hosted example runs the Microsoft Agent Framework integration end to end.

<CalloutActions>
  <CalloutAction href="https://examples.threadplane.ai/runtimes/microsoft-agent-framework/">Run the example</CalloutAction>
  <CalloutAction href="https://github.com/cacheplane/angular-agent-framework/tree/main/cockpit/runtimes/microsoft-agent-framework" variant="secondary">View source</CalloutAction>
</CalloutActions>
</Callout>
```

- [ ] **Step 5: AWS Strands runtime overview**

Replace the `See it live` callout in `apps/website/content/docs/runtimes/aws-strands/overview.mdx` (lines 12-14):

```mdx
<Callout type="tip" title="See it live">
The hosted example runs the AWS Strands integration end to end.

<CalloutActions>
  <CalloutAction href="https://examples.threadplane.ai/runtimes/aws-strands/">Run the example</CalloutAction>
  <CalloutAction href="https://github.com/cacheplane/angular-agent-framework/tree/main/cockpit/runtimes/aws-strands" variant="secondary">View source</CalloutAction>
</CalloutActions>
</Callout>
```

- [ ] **Step 6: Add the missing LangGraph live-demo callout**

In `apps/website/content/docs/langgraph/getting-started/introduction.mdx`, find the callout titled `What you'll learn` and insert this immediately after its closing `</Callout>`:

```mdx
<Callout type="tip" title="See it live">
The LangGraph demo runs this chat surface against a LangGraph backend — streaming, threads, interrupts, and tool calls included.

<CalloutActions>
  <CalloutAction href="https://demo.threadplane.ai">Run LangGraph demo</CalloutAction>
</CalloutActions>
</Callout>
```

- [ ] **Step 7: Verify every CTA renders and every href resolves**

```bash
cd /Users/blove/repos/angular-agent-framework/.claude/worktrees/gallant-clarke-963ed0 && grep -rn "CalloutAction" apps/website/content/docs | grep -c "CalloutAction href"
```

Expected: `10` — AG-UI introduction 2, AG-UI quickstart 1, Mastra 2, Microsoft Agent Framework 2, AWS Strands 2, LangGraph introduction 1. The grep counts `CalloutAction href` occurrences, so closing tags do not inflate it.

Then, with the preview running, load each of the six pages and confirm the buttons render. For each URL below, run `find` for the primary button label and confirm one match:

| URL | Primary label |
| --- | --- |
| `/docs/ag-ui/getting-started/introduction` | Run AG-UI demo |
| `/docs/ag-ui/getting-started/quickstart` | Run AG-UI demo |
| `/docs/langgraph/getting-started/introduction` | Run LangGraph demo |
| `/docs/runtimes/mastra/overview` | Run Mastra example |
| `/docs/runtimes/microsoft-agent-framework/overview` | Run the example |
| `/docs/runtimes/aws-strands/overview` | Run the example |

Take a screenshot of `/docs/ag-ui/getting-started/introduction` showing the two-button row inside the green tip callout. Then check for MDX compile errors:

```
read_console_messages with onlyErrors: true
```

Expected: no errors. An unregistered MDX component fails loudly at render, so a clean console plus visible buttons is the proof.

- [ ] **Step 8: Commit**

```bash
git add apps/website/content/docs
git commit -m "docs: give the live-demo callouts a run button

Five callouts across AG-UI and the three runtimes existed only to hand
you a demo link, and read as prose. They now lead with a CTA. Adds the
missing LangGraph one: AG-UI's introduction advertised a live demo and
the flagship adapter's did not.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Search footer on every docs content page

The footer at the foot of `/docs` becomes a shared component and appears below `DocsPrevNext` on every content page. One fix travels with it: today it reads `Press ⌘K to search the docs` as static text, which is unactionable on a touch device that has no `⌘K`.

**Files:**
- Create: `apps/website/src/components/docs/DocsSearchFooter.tsx`
- Create: `apps/website/src/components/docs/DocsSearchFooter.spec.tsx`
- Modify: `apps/website/src/app/docs/page.tsx` (replace the inline `Search prompt` section)
- Modify: `apps/website/src/app/docs/[library]/[section]/[slug]/page.tsx`
- Modify: `apps/website/src/styles/pages.css:216-238`

- [ ] **Step 1: Write the failing test**

Create `apps/website/src/components/docs/DocsSearchFooter.spec.tsx`:

```tsx
// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DocsSearchFooter } from './DocsSearchFooter';

describe('DocsSearchFooter', () => {
  it('opens search from a real button, not a keyboard instruction', () => {
    const listener = vi.fn();
    document.addEventListener('keydown', listener);
    render(<DocsSearchFooter />);

    // The old copy read "Press ⌘K to search the docs" as static text, which
    // is unactionable on a device with no ⌘K.
    fireEvent.click(screen.getByRole('button', { name: /Search the docs/ }));
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'k', metaKey: true })
    );
    document.removeEventListener('keydown', listener);
  });

  it('keeps the shortcut as a hint', () => {
    const { container } = render(<DocsSearchFooter />);
    expect(container.querySelector('[data-ui="pill"]')?.textContent).toBe('⌘K');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd apps/website && GROWTH_FORM_POLICY=growth_v1 npx vitest run --config vite.config.mts src/components/docs/DocsSearchFooter.spec.tsx
```

Expected: FAIL — cannot resolve `./DocsSearchFooter`.

- [ ] **Step 3: Write the component**

Create `apps/website/src/components/docs/DocsSearchFooter.tsx`:

```tsx
'use client';

import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { Pill } from '../ui/Pill';

/**
 * The invitation to search, at the foot of a docs page.
 *
 * A button rather than the instruction it used to be: "Press ⌘K" is not an
 * affordance on a device with no ⌘K. It dispatches the same synthetic keydown
 * the control plane trigger uses, so `DocsSearch` needs no new entry point.
 */
export function DocsSearchFooter() {
  const openSearch = () =>
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', metaKey: true })
    );

  return (
    <Section surface="tinted" tight ariaLabelledBy="search-prompt-heading">
      <Container>
        <div className="docs-index-search-inner">
          <h2 id="search-prompt-heading" className="docs-index-search-heading">
            Looking for something specific?
          </h2>
          <button
            type="button"
            className="docs-index-search-button"
            onClick={openSearch}
          >
            Search the docs
            <Pill variant="neutral">⌘K</Pill>
          </button>
        </div>
      </Container>
    </Section>
  );
}
```

The accessible name is `Search the docs ⌘K`, which the test's `/Search the docs/` regex matches.

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd apps/website && GROWTH_FORM_POLICY=growth_v1 npx vitest run --config vite.config.mts src/components/docs/DocsSearchFooter.spec.tsx
```

Expected: PASS, 2 tests.

- [ ] **Step 5: Style the button**

In `apps/website/src/styles/pages.css`, replace the `.docs-index-search-copy` rule (lines 230-238) with:

```css
.docs-index-search-button {
  font-family: var(--font-inter);
  font-size: var(--text-body);
  line-height: var(--text-body--line-height);
  color: var(--color-text-secondary);
  margin: 0;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: var(--radius-md);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  cursor: pointer;
  transition: border-color 120ms ease;
}
.docs-index-search-button:hover {
  border-color: var(--color-border-strong);
}
```

Then confirm nothing else used the class you replaced:

```bash
cd /Users/blove/repos/angular-agent-framework/.claude/worktrees/gallant-clarke-963ed0 && grep -rn "docs-index-search-copy" apps/website/src || echo "clean"
```

Expected: `clean`.

Add the button to the shared docs focus ring in `apps/website/src/styles/docs.css`, after the `[data-mdx="callout-action"]:focus-visible,` line from Task 6:

```css
.docs-index-search-button:focus-visible,
```

- [ ] **Step 6: Use the component on the index**

In `apps/website/src/app/docs/page.tsx`, add the import:

```ts
import { DocsSearchFooter } from '../../components/docs/DocsSearchFooter';
```

Replace the entire `{/* Search prompt */}` `<Section>` block at the end of the page with:

```tsx
      {/* Search prompt */}
      <DocsSearchFooter />
```

The `Pill` import in `page.tsx` becomes unused — remove it, or ESLint will fail the build.

- [ ] **Step 7: Use the component on every content page**

In `apps/website/src/app/docs/[library]/[section]/[slug]/page.tsx`, add the import:

```ts
import { DocsSearchFooter } from '../../../../../components/docs/DocsSearchFooter';
```

Then add it after the `DocsPrevNext` wrapper inside `docsSlot`:

```tsx
          <div className="px-4 sm:px-6 md:px-12 max-w-3xl pb-8">
            <DocsPrevNext
              library={library as LibraryId}
              section={section}
              slug={slug}
            />
          </div>
          <DocsSearchFooter />
        </div>
        <DocsTOC headings={headings} />
```

It sits outside the `md:max-w-3xl` measure deliberately: it is a full-width band, like the one on the index.

- [ ] **Step 8: Assert it reaches the content route**

Append to `apps/website/src/app/docs/[library]/[section]/[slug]/page.spec.tsx`, inside the existing `describe`:

```tsx
  it('invites a search at the foot of a content page', async () => {
    const tree = await route('langgraph', 'guides', 'testing');
    const workspace = findElement(
      tree,
      WebsiteWorkspace as ComponentType<never>
    );

    expect(
      findElement(workspace?.props.docsSlot, DocsSearchFooter as ComponentType<never>)
    ).toBeTruthy();
  });
```

and add the import at the top of that file:

```ts
import { DocsSearchFooter } from '../../../../../components/docs/DocsSearchFooter';
```

- [ ] **Step 9: Run the tests to verify they pass**

```bash
cd apps/website && GROWTH_FORM_POLICY=growth_v1 npx vitest run --config vite.config.mts src/app/docs src/components/docs
```

Expected: PASS.

- [ ] **Step 10: Verify in the browser**

Navigate to `http://localhost:3000/docs/langgraph/guides/testing`, scroll the article container to the bottom (the Browser pane suspends scroll events when hidden — use `javascript_tool` with `document.querySelector('[data-workspace-panels]')?.scrollTo(0, 1e6)` or read the DOM instead of scrolling), and confirm the footer renders below the prev/next cards. Click the button and confirm the search dialog opens with `read_page`. Then confirm the index still renders it exactly once:

```js
JSON.stringify({ footers: document.querySelectorAll('#search-prompt-heading').length });
```

Expected: `1` on both `/docs` and a content page.

- [ ] **Step 11: Commit**

```bash
git add apps/website/src/components/docs/DocsSearchFooter.tsx apps/website/src/components/docs/DocsSearchFooter.spec.tsx apps/website/src/app/docs apps/website/src/styles/pages.css apps/website/src/styles/docs.css
git commit -m "feat(docs): invite a search at the foot of every docs page

Extracts the index's search prompt into DocsSearchFooter and renders it
below prev/next on every content page. The prompt becomes a real button:
'Press ⌘K' was static text and unactionable on a device with no ⌘K, so
the shortcut is now a hint beside the control rather than the only way in.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: Full verification

Per the repo's verification-before-completion discipline: no success claim without command output. `nx test website` is green on `main`, so any red here is this branch's.

- [ ] **Step 1: Full website suite**

```bash
cd /Users/blove/repos/angular-agent-framework/.claude/worktrees/gallant-clarke-963ed0 && GROWTH_FORM_POLICY=growth_v1 NX_DAEMON=false npx nx test website --outputStyle=static 2>&1 | tail -30
```

Expected: PASS.

- [ ] **Step 2: Shared library suites**

```bash
cd /Users/blove/repos/angular-agent-framework/.claude/worktrees/gallant-clarke-963ed0 && NX_DAEMON=false npx nx run-many -t test --projects=workspace-react,ui-react,cockpit-registry,cockpit-shell --outputStyle=static 2>&1 | tail -30
```

Expected: PASS. `workspace-react` is the only one this branch touches; the other three are its consumers and dependencies.

- [ ] **Step 3: Lint**

```bash
cd /Users/blove/repos/angular-agent-framework/.claude/worktrees/gallant-clarke-963ed0 && GROWTH_FORM_POLICY=growth_v1 NX_DAEMON=false npx nx run-many -t lint --projects=website,workspace-react --outputStyle=static 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | grep -E "error|Error|warning" | head -30
```

Strip ANSI before grepping or the match silently misses colored output. **Errors** must be zero; pre-existing warnings are acceptable. Unused imports (`Pill`, `within`, `DocsBreadcrumb`, `humanize`, `getDocsSection`) are the likely offenders and are errors, not warnings.

- [ ] **Step 4: Production build**

```bash
cd /Users/blove/repos/angular-agent-framework/.claude/worktrees/gallant-clarke-963ed0 && GROWTH_FORM_POLICY=growth_v1 NX_DAEMON=false npx nx build website --outputStyle=static 2>&1 | tail -25
```

Expected: success. If Turbopack panics about the workspace root, a stale dev directory is the cause: `rm -rf apps/website/.next` and re-run.

- [ ] **Step 5: Website e2e for the docs routes**

```bash
cd /Users/blove/repos/angular-agent-framework/.claude/worktrees/gallant-clarke-963ed0 && GROWTH_FORM_POLICY=growth_v1 NX_DAEMON=false npx nx e2e website --outputStyle=static --grep "docs" 2>&1 | tail -30
```

Stop the preview server first — a running dev server holds port 3000 and the e2e web server will either fail to bind or, worse, silently test the old bundle. Any failure that names a breadcrumb, a Scope card or `⌘K` copy is this branch's and must be fixed in the spec, not by loosening the assertion.

- [ ] **Step 6: Final visual pass**

With the preview restarted, screenshot each of these and confirm the change is present and nothing else regressed:

| URL | What to confirm |
| --- | --- |
| `/docs` | search leads the pane, Run is a live link, footer at the bottom, no empty Actions section |
| `/docs/choosing-an-adapter` | Run still disabled, search present, no Scope |
| `/docs/ag-ui/getting-started/introduction` | one trail, two CTA buttons in the tip callout, underlined prose links, footer |
| `/docs/langgraph/guides/streaming?mode=run` | Run panel loads, header trail correct, cockpit sidebar unaffected |
| `/docs/langgraph/guides/testing` | footer below prev/next on a docs-only page |

Then check `read_console_messages` with `onlyErrors: true` on each — expected: no errors.

- [ ] **Step 7: Confirm the diff contains nothing unintended**

```bash
cd /Users/blove/repos/angular-agent-framework/.claude/worktrees/gallant-clarke-963ed0 && git status --short && git diff --stat origin/main...HEAD
```

`apps/website/.env.local` must **not** appear (it is gitignored; if it shows, do not add it). Confirm `DocsBreadcrumb.tsx` shows as deleted and no stray scratch files are staged.

---

## Notes for the implementer

- **Task order matters twice.** Task 1 establishes the `data-mdx-chrome` convention that Task 6's buttons rely on. Task 4 must land before Task 5, which consumes the prop it adds. Tasks 2, 3, 7 and 8 are independent of each other.
- **Do not restore `DocsBreadcrumb`** if a test fails at import after Task 5. Update the test — the component is deliberately gone.
- **Do not "fix" the grey map or a blank reload** if you happen to open an AG-UI itinerary page while verifying. Per the project's recorded history that is never a code bug.
- **The Browser pane suspends `requestAnimationFrame` and scroll events while hidden.** A scroll-spy or intersection-observer UI will look dead and a `computer` scroll action can time out. Prefer `read_page`, `get_page_text` and `javascript_tool` over screenshots and scrolling when the pane is not visible.
