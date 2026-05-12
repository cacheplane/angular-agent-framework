# Website refactor — Phase 7: Docs

## Summary

Refactor `apps/website/src/app/docs/**` and `apps/website/src/components/docs/**` to drop glassmorphism + gradient washes and align with the Statusbrew-shaped marketing aesthetic established in Phases 1–6. This is a **skin refresh plus minor IA polish**: same 3-column layout, same MDX feature set, no content rewrite, but every visible surface migrates to the new tokens.

Cockpit (`apps/cockpit/**`) is deferred to Phase 8 — its glass usage is left in place until that phase runs. The full `glass`/`gradient`/`glow` token purge in `@ngaf/design-tokens` waits on Phase 8.

## Goals

1. Docs read as a continuation of the marketing site: white surfaces, hairline borders, EB Garamond for page titles, Inter for body, no glass, no gradient blobs.
2. Improve a few latent ergonomics: visible breadcrumb on every doc page; wired-in prev/next; hash anchors on headings; content column capped at 70ch readable width.
3. Consolidate MDX primitives where the docs version duplicates a Phase 1 UI primitive (`mdx/Card` → `ui/Card`; `mdx/FeatureChips` → `ui/Pill`).
4. Zero regression to existing docs tests; full e2e green after each of the three sub-commits.

## Non-goals

- Restructuring docs IA (sidebar order, section grouping, library taxonomy stay as-is).
- Rewriting any MDX content (`apps/website/content/docs/**`).
- Adding new docs features (versioning, dark mode, code playground, etc.).
- Touching `apps/cockpit/**` — its own phase.
- Removing `glass`/`gradient`/`glow` from `@ngaf/design-tokens` (gated on Phase 8).

## Audience

Developers reading reference material. Scannability and code-density matter more than editorial flourish.

## Design

### Layout

- **Page background**: `tokens.surfaces.canvas` on `/docs`. Slug page wrapper sits flat; the content well inside it uses `tokens.surfaces.surface`.
- **Top breadcrumb strip**: thin row directly under the sticky Nav, inside the content column above each page's H1. Uses the existing (currently-unused) `DocsBreadcrumb` component. Format: `Docs / Agent / Getting started / Introduction`, with parent crumbs in `textMuted` and the current page in `textPrimary`.
- **Sidebar**: 256px wide, `surfaces.surface` background, single 1px `surfaces.border` right edge. Sticky at `top: 64px`. No shadow, no blur. Accordion behavior preserved.
- **Content column**: max-width 70ch, centered between sidebar and TOC. Top padding lifts to 80px to clear the now-shadowed sticky Nav.
- **TOC column**: 220px, right side. Active heading indicator uses `accent`; inactive uses `surfaces.border`.

### Typography

| Element | Scale | Family | Notes |
|---|---|---|---|
| Page title (H1) | `typography.h2` — `clamp(36px, 4.5vw, 56px)` | EB Garamond, weight 700, `-0.015em` tracking | Reserved for top-of-page only |
| Section heading (H2) | 28px, line 1.3 | Inter SemiBold | |
| Sub-heading (H3) | 20px, line 1.3 | Inter SemiBold | |
| Body | 17px, line 1.7 | Inter | Max 70ch column |
| Inline code | inherits size | `fontMono` | `accentSurface` bg, `accent` color, `radius.sm` |
| Caption / breadcrumb | 13px, line 1.5 | Inter | `textMuted` |

Every `<h2>` and `<h3>` gets a `#` hash-anchor affordance on hover: a small mono `#` to the left of the heading, opacity 0 by default, 0.6 on hover, links to `#slug-of-heading`. `rehype-slug` is already wired into `MdxRenderer.tsx` and assigns IDs to headings, so this is ~20 lines of CSS plus a small `<h2>`/`<h3>` wrapper in the MDX component map.

### Code blocks

Shiki + `rehype-pretty-code` remain unchanged for fenced code blocks. The custom `mdx/CodeBlock.tsx` wraps content in a chrome-shaped frame *only when explicitly used by MDX* (e.g., `<CodeBlock filename="…">`). Restyle that wrapper to use the new `BrowserFrame`-like chrome (traffic-light dots + filename pill), keeping the dark tokyo-night code surface.

### Sidebar + search

- Sidebar accordion section headers use `Eyebrow` (mono uppercase, accent-tinted). Active links: `accentSurface` background + `accent` color (current pattern, normalize to tokens).
- Sidebar search trigger is a white `Card`-shaped button with a `Pill variant="neutral">⌘K</Pill>` on the right.
- Search modal (`DocsSearch.tsx`) keeps current behavior. Modal body becomes `surfaces.surface` + `shadows.lg` + `surfaces.border`, no glass. Result row hover: `accentSurface`.

### MDX primitives

**Keep (restyle only):**

- `mdx/Callout.tsx` — tip / warning / info / danger variants. Restyle: drop glass background → `surfaceTinted` body with a 4px left accent stripe in the tone color. Tones: tip = green `#1a7a40`, warning = amber `#D4850F`, info = `accent`, danger = `angularRed`. Body uses 16px Inter, line-height 1.6.
- `mdx/Tabs.tsx` — restyle: tab bar is `surfaces.surface` with hairline bottom border `surfaces.border`. Active tab gets `accent` underline (2px) + `accent` text color. Body sits on white.
- `mdx/Steps.tsx` — restyle: each step number is a 32×32 `accent` circle with `textInverted` numeral (matches `PilotBlock` timeline). Vertical connecting line: `surfaces.border`, 2px wide.
- `mdx/CodeGroup.tsx` — multi-language code tabs. Same tab-bar treatment as `Tabs`. Body wraps the active shiki block in a `BrowserFrame`-style chrome.
- `mdx/CodeBlock.tsx` — `BrowserFrame`-style chrome as above. Filename → URL pill, traffic lights, body keeps tokyo-night.

**Replace + delete:**

- `mdx/Card.tsx` (62 lines) — replace MDX usages with `ui/Card`. The docs version's optional `icon` prop becomes a child node (`<Card><Icon … />…</Card>`). After all MDX migrations + import swaps, delete `mdx/Card.tsx`.
- `mdx/FeatureChips.tsx` (78 lines) — replace MDX usages with `ui/Pill`. Delete after migration.

**Verification step for both deletions**: `grep -rln "from '.*mdx/Card'\|from '.*mdx/FeatureChips'" apps/website` must return zero before deletion. MDX usages from `.mdx` files appear as named tag references; the MdxRenderer's component map (in `MdxRenderer.tsx`) provides the binding.

### Other docs components

- `DocsSidebar.tsx` — drop glass shell + dropdown glass; switch to `surfaces.surface` + `surfaces.border`. Library dropdown menu uses `shadows.md` instead of inline `0 8px 32px rgba(0,0,0,0.1)`.
- `DocsTOC.tsx` — already lean. Normalize colors/borders to tokens; active-section indicator uses `accent`.
- `DocsBreadcrumb.tsx` — wire in at top of slug page content column (currently unused). Restyle with `caption` typography.
- `DocsPrevNext.tsx` — wire in at the bottom of each slug page. Renders two `ui/Card`s side-by-side, prev on the left (`← Previous` eyebrow + page title), next on the right (`Next →` eyebrow + page title). On mobile, stacks vertically.
- `ApiDocRenderer.tsx` — restyle param tables to new tokens. Keep markup.
- `ApiRefTable.tsx` — same.
- `ArchFlowDiagram.tsx` — swap inline-glass styling for new tokens.
- `CopyPromptButton.tsx` — restyle button to use `ui/Button variant="secondary" size="md"` (or matching inline if the button needs to live inside MDX prose). Drop glass.

### `/docs` landing page

Replace the current gradient-blob landing with a clean entry surface:

1. Header block — `Eyebrow` "Documentation", H1 "Learn the framework" (EB Garamond, marketing H1 scale), 52ch subhead.
2. **Library grid** — 3 `ui/Card hoverable` columns, one per library. Each card: library `Eyebrow` (accent-tinted), H3 title, description from `docsConfig`, `Get started →` link to `/docs/<lib>/getting-started/introduction`. Reuses existing `docsConfig` data.
3. **Popular topics** — 3 hand-curated `ui/Card`s linking to high-value pages. Initial list:
   - "Streaming with signals" → `/docs/agent/api/agent`
   - "Generative UI fundamentals" → `/docs/render/getting-started/introduction`
   - "Production patterns" → `/docs/agent/guides/production`
   - (Verify paths exist before shipping.)
4. **Search prompt** — `Section surface="tinted"` band: "Looking for something specific? **⌘K to search.**" Centered, no CTA buttons.

No `FinalCTA` on the docs landing.

### Slug page (`/docs/[library]/[section]/[slug]`)

Same 3-col layout, restyled:

- Top breadcrumb (inside the content well, above the H1).
- H1 (EB Garamond, the doc's title from the MDX frontmatter).
- MDX body (existing `MdxRenderer`, with hash-anchor affordance on H2/H3).
- API entries (existing conditional rendering for `section === 'api'`).
- `DocsPrevNext` row at the bottom.
- Content well sits on `surfaces.surface`; outside it is `surfaces.canvas`.

## File-level change map

```
apps/website/
├── src/app/docs/
│   ├── page.tsx                                  [REWRITE — docs landing]
│   └── [library]/[section]/[slug]/page.tsx       [REWRITE wrapper — keep content rendering]
├── src/components/docs/
│   ├── DocsSidebar.tsx                           [REFACTOR — drop glass]
│   ├── DocsSearch.tsx                            [REFACTOR — drop glass]
│   ├── DocsBreadcrumb.tsx                        [REFACTOR + WIRE IN]
│   ├── DocsTOC.tsx                               [REFACTOR — normalize tokens]
│   ├── DocsPrevNext.tsx                          [REFACTOR + WIRE IN]
│   ├── ApiDocRenderer.tsx                        [REFACTOR]
│   ├── ApiRefTable.tsx                           [REFACTOR]
│   ├── ArchFlowDiagram.tsx                       [REFACTOR]
│   ├── CopyPromptButton.tsx                      [REFACTOR]
│   ├── MdxRenderer.tsx                           [MODIFY — anchor affordance, update component map]
│   └── mdx/
│       ├── Callout.tsx                           [REFACTOR]
│       ├── Tabs.tsx                              [REFACTOR]
│       ├── Steps.tsx                             [REFACTOR]
│       ├── CodeGroup.tsx                         [REFACTOR]
│       ├── CodeBlock.tsx                         [REFACTOR — BrowserFrame chrome]
│       ├── Card.tsx                              [DELETE after migration]
│       └── FeatureChips.tsx                      [DELETE after migration]
├── src/app/global.css                            [ADD anchor-affordance + 70ch column rules]
└── e2e/docs.spec.ts                              [NEW — covers landing + slug page + search]

apps/website/content/docs/**.mdx                  [POSSIBLE edits if any MDX uses <Card> or <FeatureChips>]
```

## Phasing

Three commits, each independently verifiable:

| # | Scope | Files touched | Verification |
|---|---|---|---|
| 1 | Page chrome — tokens, layout, sidebar, search, TOC, breadcrumb, landing page | `docs/page.tsx`, `docs/[library]/[section]/[slug]/page.tsx`, `DocsSidebar`, `DocsSearch`, `DocsBreadcrumb`, `DocsTOC`, `global.css` | Existing docs e2e tests pass. Visual smoke: landing + one slug page. |
| 2 | MDX primitives — restyle Callout/Tabs/Steps/CodeGroup/CodeBlock; replace and delete Card + FeatureChips | `mdx/*`, MDX content files for replacements, `MdxRenderer.tsx` | `pnpm nx build website` succeeds (Next.js bundles MDX). Visual smoke: a doc with each primitive. |
| 3 | Ancillary + tests + wire-up — `DocsPrevNext`, `ApiDocRenderer`, `ApiRefTable`, `ArchFlowDiagram`, `CopyPromptButton`, anchor affordance, new e2e file | rest of `components/docs/`, `MdxRenderer.tsx`, `e2e/docs.spec.ts` | New e2e covers landing + slug + search modal + prev/next. All e2e green. |

## Verification

Existing tests that must continue passing:

- `apps/website/e2e/website.spec.ts:32:5 docs page renders sidebar and content`
- `apps/website/e2e/website.spec.ts:38:5 docs landing page shows library cards`
- `apps/website/e2e/website.spec.ts:46:5 api reference renders in docs`

New `e2e/docs.spec.ts`:
- `/docs` landing renders 3 library cards + popular-topics section.
- `/docs/agent/getting-started/introduction` renders breadcrumb, H1, prev/next.
- `⌘K` opens the search modal.
- Hash anchor on an H2 is reachable (heading has an `id`).

Lighthouse target on `/docs/agent/getting-started/introduction`: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95.

## Items requiring verification before implementation

These are best-effort calls in this spec; verify against the codebase during implementation:

- **Popular-topics URLs**: spec lists 3 sample paths. Verify each exists in `docsConfig` / `content/docs/` before shipping. Swap to real paths if any are wrong.
- **`<FeatureChips>` MDX usage**: verify whether any `.mdx` file actually uses this. If not, simply delete; no MDX edits needed.
- **`<Card>` MDX usage**: same. Likely there are real usages — be prepared to edit MDX files.

## Open items (out of scope)

- Cockpit refactor — Phase 8 (separate spec).
- Final removal of `glass`/`gradient`/`glow` from `@ngaf/design-tokens` — gated on Phase 8.
- Docs content audit (broken links, stale code examples, outdated version claims) — separate project after the skin refresh.
- Dark mode for docs — future.
- Versioned docs — future.
