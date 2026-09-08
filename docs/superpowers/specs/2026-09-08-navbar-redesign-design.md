# Navbar redesign — design

Date: 2026-09-08
Status: approved, ready for an implementation plan
Surface: `apps/website` (every route — homepage, library landing pages, docs, solutions, blog)

## Problem

`apps/website/src/components/shared/Nav.tsx` mounts one navbar in the root layout and
renders it identically everywhere. Three things are wrong with it.

**The nav hides the product.** It carries `Pilot to Prod`, `Docs`, `Pricing`, a
hand-rolled `Demo ▾` dropdown, a GitHub mark, and a `Talk to Us` button. The four
library pages (`/langgraph`, `/render`, `/chat`, `/ag-ui`), `/solutions` and its three
children, `/blog`, and `/about` are reachable only from the footer. The site never says
above the fold that the thing being sold is four npm packages.

**Docs readers get marketing chrome.** On `/docs` the 81px bar stacks on top of a shell
that already has an icon rail, a sidebar carrying its own search and library switcher,
a breadcrumb, and a TOC.

**The bar's surface is generic.** Opaque white with a drop shadow on every route, which
makes the seam against the homepage's saturated yellow hero read as accidental rather
than designed.

## Decisions

Each was validated against a rendered mockup during brainstorming.

| Question | Decision |
| --- | --- |
| Interaction model | Single row, hover-opened panels (the shadcn `navigation-menu` pattern) |
| IA grouping | `Libraries ▾ · Docs ▾ · Solutions ▾ · Pricing` |
| Panel surface | Neutral: flat `#FAFAFA`, navy icon chips at 7%, no borders or dividers |
| Caret | lucide `ChevronDown`, `strokeWidth={2}`, rotated by `data-open` |
| Bar surface | Transparent at rest on hero routes; solid past a scroll sentinel and on all other routes |
| Docs mode | Same bar and links, condensed to 58px; CTA demotes to a text link |
| Blog / About | Adopted into the `Solutions ▾` panel as a Company column |
| Mobile | Drill-in stack that replaces the Site/Docs tab strip |

Rejected, and why, so they are not relitigated:

- **`Product ▾ / Developers ▾ / Company ▾`** — "Product" tells a developer nothing and
  buries the four package names one hover deeper.
- **Blog as a fifth top-level link** — five triggers crowd a bar that also carries a
  logo, a GitHub mark, and a CTA.
- **Moving docs search and the library switcher up into the bar** — the strongest fix for
  the stacking problem, but it reverses the docs chrome arc from PR #986, which
  deliberately gave the shell header ownership of that context.
- **Drill-in beside the tab strip** — two "you are somewhere else now" idioms in one
  sheet; Escape would mean three different things depending on which half you were in.
- **Translucent blur bar** — a good single unconditional rule, but the landing pages are
  getting heroes, so the per-route hero state stops being a one-page special case.

## Architecture

`Nav.tsx` is ~500 lines today and this roughly doubles it. It splits into units that can
be understood and tested on their own:

| File | Responsibility | Depends on |
| --- | --- | --- |
| `nav-config.ts` | The IA as data: triggers, panel columns, items, icons, analytics ids, hero-route list | `docs-config`, `demos`, `positioning` |
| `NavDesktop.tsx` | The bar, the trigger row, a per-trigger panel, hover/keyboard state | `nav-config`, `LibraryMark` |
| `NavMobile.tsx` | The drill-in stack, focus trap, scroll lock, level transitions | `nav-config`, `DocsContextContent` |
| `useNavSurface.ts` | Whether the bar is transparent or solid on this route at this scroll position | `nav-config` |
| `Nav.tsx` | Shell: reads the route, picks desktop or mobile, owns nothing else | all of the above |

`nav-config.ts` is the seam that matters. Both the desktop panels and the mobile levels
render from the same structure, so the two surfaces cannot drift, and adding a
destination is a data change rather than an edit in two components.

## Desktop bar

Row contents, left to right: logo, the four triggers, then right-aligned GitHub mark and
`Talk to Us`.

**Opening.** Hover opens after ~100ms; leaving closes after a ~150ms grace so a diagonal
mouse path between trigger and panel does not dismiss it. Click also toggles, which is
what makes touch and keyboard work.

**Each trigger owns its own panel**, rendered next to that trigger so the panel is
the next thing in the tab order after the trigger that opened it. Only one is ever
mounted.

This replaces the shared morphing container this spec originally called for, on
measurement rather than taste. All three panels are the same width by construction
— the shell is `left: 0; right: 0` — so a shared container could only animate
height, and at 1440px the heights are Libraries 190px, Docs 256.8px, Solutions
256.8px. Docs and Solutions are identical because `.nav-panel-cols` is a stretch
grid whose tallest column sets the row height. So four of the six trigger-to-trigger
transitions have nothing to animate, and the morph buys one 67px tween in one
direction. Against that: an always-mounted container needs `inert` plus
`aria-hidden` when closed (a `height: 0` container does **not** remove its links
from the tab order), `inert` is discrete so it cannot be transitioned without
`transition-behavior: allow-discrete` or a `transitionend` state machine, and a
crossfade needs both panels mounted at once — which breaks every unqualified
`.nav-panel` locator in `e2e/nav-panels.spec.ts`. The panel gets a 140ms entrance
animation instead, which addresses the actual visual complaint: the caret glides
while the panel snapped.

**Width and alignment — known gap.** The panel shell is `left: 0; right: 0` against the
padding box of the bar's inner row, so the bar's `px-8` gutter falls *inside* the panel.
The panel's first item therefore starts at x=24 (its own padding) while the logo starts
at x=32, and nothing in the panel lines up with anything in the bar. Not fixed here;
tracked as a follow-up because it is a visual-polish decision, not a defect.

**Semantics.** The panel holds links, so it is a disclosure and not a menu: triggers get
`aria-expanded` and `aria-controls`, the panel is a plain region, Tab moves through the
links in order, and Escape closes and returns focus to the trigger. No `role="menu"` and
no roving tabindex — those would be wrong for link content, and would also collide with
the library switcher's genuine `role="menu"` in the docs sidebar.

### Panel contents

**`Libraries ▾`** — four items in one row, each leading with its existing `LibraryMark`
(LangGraph and AG-UI ship real logos; chat and render use glyphs):

| Item | Description |
| --- | --- |
| `@threadplane/langgraph` | LangGraph & LangChain agents in Angular |
| `@threadplane/ag-ui` | AG-UI protocol — CrewAI, Mastra, MAF |
| `@threadplane/chat` | Chat, timeline, and thread primitives |
| `@threadplane/render` | Generative UI from agent output |

Footer strip, no rule above it: *Not sure which one?* → Choosing an adapter.

**`Docs ▾`** — three columns:

- *Start here* — Documentation (`/docs`), Quick start, Choosing an adapter
- *Go deeper* — Guides, Concepts, API reference (the real section ids from `docs-config.ts`)
- *See it running* — LangGraph demo, AG-UI demo (both external)

Quick start is library-scoped and there is no library-neutral one, so it resolves to
LangGraph's — the canonical demo and the default library elsewhere on the site.

This panel absorbs the `DemoDropdown`, which is deleted.

**`Solutions ▾`** — two columns:

- *Use cases* — Customer support, Analytics, Compliance
- *Company* — Pilot to Prod, Blog, About

**`Pricing`** is a plain link with no panel.

### Panel styling

Flat `#FAFAFA` panel. No borders and no dividers anywhere — the hovered item separates
itself with a soft shadow on white. Icon chips are `--ds-scope` at 7%. Generous padding
(~28px block, ~16px per item). The trailing strip is separated by whitespace only, with
a small yellow arrow chip.

Yellow (`--ds-signal`, `#FFAF00`) stays fill-only, per the existing theme rule — it is
1.84:1 on white and never carries text. In the nav it does exactly two jobs: the
`Talk to Us` fill and the active-link underline.

## Bar surface

Two states.

**Transparent** — on hero routes at scroll 0. No background, no border, no shadow. Links,
caret, and GitHub mark render in `--ds-scope` navy; the CTA inverts to a navy fill with
white text. Navy on the hero yellow is roughly 8:1, so this is a stylistic state and not
an accessibility concession.

**Solid** — white, hairline `--ds-border` bottom, no shadow. Every non-hero route, all of
`/docs`, and any hero route once scrolled.

The drop shadow currently on `.nav-bar` is removed in both states.

**Known gap: the bar is solid for one hydration on first load.** `Nav` is a client
component, but Next still server-renders it, and the first render has no layout to
read — so the SSR HTML ships `solid` and the flip to `transparent` waits on
hydration. Measured against `next dev` with a per-frame sampler: ~250ms of white
bar over the yellow hero, then a 200ms fade. Production will be faster than the
dev number but not zero.

Server-rendering `transparent` for hero routes would fix the common case and
reintroduce the inverse one — a page restored already-scrolled would ship
transparent over white content. It also risks a hydration mismatch. Left as-is
deliberately; **judge it on the deployed preview**, since that is the only place
the real timing exists, and it is already a required manual gate for this feature.

**Hero routes** are an exported list in `nav-config.ts`. **This work ships with `/` as the
only entry.** `/langgraph`, `/render`, `/chat`, and `/ag-ui` open on white today; listing
them before their heroes exist would render navy-on-white links over a white page with no
bar behind them. Each landing page is added to the list by the same change that gives it
a hero, not by this one.

A hand-maintained list drifts, so the guard is an e2e that visits each listed route and
asserts the nav computes to a transparent background at scroll 0 — a unit test over the
list cannot catch a page that stopped rendering a hero.

**The scroll trigger is an IntersectionObserver on a sentinel element**, not a scroll
listener. It is cheaper, and the Browser pane suspends scroll events, which would make a
listener-based implementation look broken during local verification when it is not.
Either way, this state must be verified in a real browser window.

## Docs mode

Same component, same links, same panels. Two changes on `/docs`:

- Height condenses to **58px at every breakpoint**.
- `Talk to Us` demotes from a fill button to a text link, so the one yellow fill on the
  page is not competing with the docs shell.

`--nav-h` stops being one global ladder. Marketing routes keep the measured 58 / 66 / 81
steps; docs is flat 58. The three marketing steps exist because padding grows at `md`
while the tall link row only appears at `lg` — that asymmetry is documented at the top of
`chrome.css` and is unchanged.

Everything that offsets against the nav reads `--nav-h`: the docs shell's top padding,
both sticky rails, the mobile overlay's `top`, and `html`'s `scroll-padding` for anchor
jumps. All of them must be re-verified at the docs height. `e2e/nav-height.spec.ts`
already asserts `nav.height === --nav-h` at three widths; it grows a docs case at each.
These values are measured, not derived — only a real browser holds them honest.

## Mobile

The drill-in stack **replaces** the Site/Docs tab strip. `mobileTab` state and the
`nav-mtabs` markup and styles are deleted; stack depth carries that meaning instead.

- **Depth 0** — the four triggers as rows with a right chevron; `Pricing` navigates
  directly. Below them, GitHub and the `Talk to Us` CTA.
- **Depth 1** — the tapped trigger's panel, full width, with a back row naming the level
  it returns to. Item descriptions are kept; this is the reason drill-in beat an
  accordion, which would have produced a two-screen scroll.

**On a `/docs` route the drawer opens pre-pushed to the Docs level.** That is the same
behavior as `mobileTab` initialising to `'docs'` today, expressed as depth.

**The Docs level hosts `DocsContextContent` unchanged.** This is the constraint the whole
mobile design bends around: `Nav.tsx` and `DocsControlPlane` mount the *same* component,
and its expand/collapse state persists through `useControlPlanePreferences('docs')` into
localStorage — shared between the drawer and the desktop sidebar. Collapsing "Guides" on
a phone collapses it in the sidebar later. Drill-in therefore stops at the docs boundary:
the accordion lives *inside* a level rather than being replaced by one. Pushing drill-in
down into the section tree would leave two divergent models over one persisted state.

Depth 1 for docs consequently stacks three interaction models — drill-in outside,
accordions for sections, and the library switcher's `role="menu"` popup with its own
roving arrow keys. Only the outermost is new, and it is the one with a visible back
affordance.

### Behavior to build deliberately

- The focus trap currently runs **once per open**. It must re-run on every push and pop,
  land focus on the new level's first focusable item, and keep the back row reachable.
- Escape **pops a level, then closes at depth 0** — not close-from-anywhere.
- The slide transition must respect `prefers-reduced-motion` and must not fight the body
  scroll lock.
- Aesthetics stay phone-native: full-width tap targets at 44px minimum, generous vertical
  rhythm, and the same icon chips as desktop rather than a denser list.

Surviving unchanged: `inert` on the nav and `#site-content`, the body scroll lock, the
desktop media-query auto-close, focus restore to the hamburger via `requestAnimationFrame`,
and the ⌘K search handoff that closes the drawer and re-dispatches the keydown on the
next frame.

### Accepted regression

Getting from docs back to the site menu is one tap on an always-visible "Site" tab today;
it becomes one tap on a back row. Roughly a wash — the back row names its destination —
but it is strictly less discoverable, and that is accepted.

## Analytics

The existing `trackNavLink` shape and the `nav_*` / `mobile_nav_*` `cta_id` scheme carry
over. Panel links get ids under the same scheme, qualified by their trigger
(`nav_libraries_langgraph`, `mobile_nav_solutions_blog`, and so on).

**Continuity breaks for `nav_demo_langgraph` and `nav_demo_ag_ui`.** Those ids disappear
with the dropdown; the demos are then reached as `nav_docs_demo_*`. Any dashboard or
saved query filtering on the old ids needs updating. `demoCtaSuffix` and the `DEMOS`
constant stay — the footer and the mobile stack still use them.

## Testing

| Level | What it covers |
| --- | --- |
| Unit (`Nav.spec.tsx`) | Trigger renders each panel's items from `nav-config`; Escape closes and restores focus; disclosure attributes are correct |
| Unit (`nav-config.spec.ts`) | Every configured href resolves to a real route or a known external target; every item has an analytics id |
| Unit (mobile) | Depth transitions; pre-push on a `/docs` path; Escape pops before it closes |
| e2e (`nav-height.spec.ts`) | `nav.height === --nav-h` at six widths. **Every existing step navigates to `/docs`**, so the marketing steps move to `/` and a docs set is added alongside them |
| e2e (new) | Nav is transparent at scroll 0 on every hero route, and solid after scrolling past the sentinel |
| e2e (existing docs specs) | Docs shell offsets, both sticky rails, and anchor `scroll-padding` still land correctly at the condensed height |

## Risks

- **`--nav-h` becoming route-dependent** is the highest-risk change. Five separate layout
  systems read it, and the last time it was wrong it cost 22px of dead space on phones and
  landed anchors 81px under the nav. Every consumer needs browser verification, not
  reasoning.
- **The focus trap rework** is the highest-risk mobile change; the current implementation
  is fiddly and correct, and per-level re-entry is where it will break.
- **New panel copy is scanned automatically** — no manual check needed.
  `src/lib/public-copy.spec.ts` has two scans, not one: the `content/**` line scan, and a
  `renderedCopyFiles` AST scan that walks every non-spec `.ts`/`.tsx`/`.mjs` under `src/`
  and extracts string literals, template chunks, JSX attribute values, and JSX body text.
  `nav-config.ts` is covered by construction. What it still cannot catch is copy assembled
  across a substitution, so panel descriptions stay as whole literals rather than being
  built from interpolated fragments.

## Out of scope

Hide-on-scroll behavior, a command palette in the bar, dark mode for the nav, changes to
the footer IA, and building the landing-page heroes themselves — the hero-route list is
written to accommodate them, but authoring those heroes is separate work.
