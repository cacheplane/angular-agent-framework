# Docs Landing Page Polish — Design

**Date:** 2026-06-03
**Status:** Draft for review
**Scope:** Visual + copy polish of `apps/website/src/app/docs/page.tsx` (the `/docs` index), building on the backend-first funnel shipped in #564 and the nit cleanups in #566.

## Goal

Elevate the docs landing from a clean-but-spartan wireframe into a designed,
branded page — **direction B (branded & iconic)** — without changing the funnel
structure. Add recognition (vendor marks on the fork cards), structure (numbered
step badges), and craft (snippet copy, hover, dividers), and resolve the two
open copy questions.

This is a polish pass, not a re-architecture. The five-section funnel (hero →
Step 1 backend → Step 2 generative UI → Step 3 chat → supporting → search) stays
exactly as-is in order and routing.

## Decisions (locked during brainstorming)

- **Direction:** B — branded & iconic.
- **Icon strategy:** official vendor marks on the four fork cards; in-house line
  glyphs for our own libraries (Chat, Licensing, Telemetry).
- **Headline:** change hero h1 to **"Start building with Threadplane"**
  (docs-flavored; the eyebrow already reads "Documentation").
- **A2UI card link:** unchanged — `/docs/a2ui/getting-started/introduction`.
- **Install snippet:** add a copy-to-clipboard control via a small new client
  component; the page stays a server component.

## Section 1 — Card craft

### Numbered step badges

Replace the plain uppercase step labels with a numbered badge + label. Each badge
is a filled accent circle (20px, `tokens.colors.accent` background, white digit,
600 weight) preceding the existing uppercase `StepLabel` text. Steps 1–3 are
numbered; "Supporting libraries" keeps a plain (un-numbered) label.

### Fork cards — vendor logo chips

Each of the four fork cards gets a logo chip left of the title: a 30px white
rounded square (`tokens.surfaces.surface` bg, `tokens.surfaces.border`,
`tokens.radius.md`) containing an 18px `<img>`. Below the title, a small
uppercase mono attribution line (matching the ecosystem strip's `note` style:
`fontMono`, 10px, `textMuted`, `letterSpacing: 0.08em`).

Marks reuse the existing, shipped, trademark-cleared assets from
`apps/website/public/logos/` (already used by `EcosystemStrip`):

| Card | Logo `src` | Attribution |
|------|-----------|-------------|
| LangGraph | `/logos/langgraph.svg` | LangChain |
| AG-UI | `/logos/runtimes/copilotkit.svg` | AG-UI · CopilotKit |
| A2UI | `/logos/providers/google.svg` | Google |
| json-render | `/logos/surface/vercel.svg` | Vercel |

Images render exactly like `EcosystemStrip`: `alt=""`, `aria-hidden="true"`,
`loading="lazy"`, `decoding="async"`, `objectFit: 'contain'`.

### Own libraries — in-house line glyphs

Chat (Step 3) and the two supporting libraries get a monochrome accent-tinted
square (`tokens.colors.accentSurface` bg, `tokens.colors.accentBorder`,
`tokens.radius.md`, icon stroked in `tokens.colors.accent`) holding a simple
inline-SVG line icon:

- **Chat** — speech-bubble glyph (30px chip; attribution "Threadplane").
- **Licensing** — key glyph (26px chip).
- **Telemetry** — signal-pulse glyph (26px chip).

These are small inline SVGs defined in the page file (no new asset files).

### Hover lift

Cards reuse the ecosystem-tile hover treatment via a `data-ui` attribute + a
scoped `<style>` block: on hover, `border-color → tokens.colors.accentBorderHover`,
`box-shadow → tokens.shadows.md`, `transform: translateY(-1px)`; wrapped in a
`@media (prefers-reduced-motion: reduce)` guard that disables the transform.
(The current page leans on `Card`'s `hoverable` prop; this gives the richer,
consistent lift the ecosystem strip already uses.)

## Section 2 — Copy

- **Hero h1:** "Start building with Threadplane". Subcopy unchanged: "A suite of
  MIT-licensed libraries for streaming agent interfaces. Pick your backend to get
  started."
- **Backend blurbs (tightened):**
  - LangGraph → "For LangChain & LangGraph backends."
  - AG-UI → "For CrewAI, Mastra, Pydantic AI, Strands, and more."
- **Generative-UI and Chat blurbs:** unchanged (already tight).
- **Attribution lines:** as in the Section 1 table.
- **Page `<title>`/metadata:** unchanged.

## Section 3 — Install snippet & rhythm

### CopyButton (new client component)

Create `apps/website/src/components/docs/CopyButton.tsx` (`'use client'`):

- Props: `{ text: string; label?: string }`.
- Reuses the `CopyIcon` / `CheckIcon` SVGs and the copied-state pattern (2s
  reset) from `src/components/docs/mdx/CodeBlock.tsx`.
- Fires the existing `analyticsEvents.docsCopyCodeClick` event (`surface: 'docs'`,
  `cta_id: 'copy_install'`) — no new analytics event.
- Light-styled icon button (~28px) suited to sit at the right edge of the snippet
  row; `aria-label` toggles "Copy install command" / "Copied".
- Copies the passed `text` string (not DOM `textContent`).

### Snippet row

The install command renders in a bordered row: command (`fontMono`, 13px,
`textSecondary`) left-aligned on `tokens.surfaces.surface`, the `CopyButton`
right-aligned, `tokens.surfaces.border`, `tokens.radius.md`. Only the two backend
cards carry a snippet (generative-UI/chat/supporting cards do not).

### Section rhythm

Add a hairline divider (`1px`, `tokens.surfaces.border`) between Step 1/Step 2,
Step 2/Step 3, and Step 3/Supporting. Step sections stay on `surface="canvas"`;
the search prompt stays on `surface="tinted"`. The `⌘K` search prompt is
unchanged.

## Components & implementation

- **Modify:** `apps/website/src/app/docs/page.tsx` — server component. Add the
  vendor-mark data (logo `src` + attribution per fork card), glyph SVGs, badge
  rendering in `StepLabel` (or a new `StepBadge`), the snippet row with
  `CopyButton`, dividers, and the scoped hover `<style>`.
- **Create:** `apps/website/src/components/docs/CopyButton.tsx` — the only new
  client component.
- **Reuse:** existing `/logos/*.svg` assets, `EcosystemStrip` image treatment,
  `CodeBlock` copy icons/pattern, design tokens, and the existing
  `Section`/`Container`/`Eyebrow`/`Card`/`Pill` primitives. No new dependencies,
  no new asset files, no new analytics events.

### Data shape (in `page.tsx`)

`BACKENDS` and `GENERATIVE_UI` entries gain `logoSrc: string` and
`attribution: string`. `SUPPORTING` entries and the Chat card reference a glyph
key instead of a logo. Keep these as local typed arrays (current pattern).

## Testing

Update `apps/website/e2e/docs.spec.ts` (the "Docs landing page" block):

- Hero h1 now reads "Start building with Threadplane" (update the existing
  `toContainText` assertion).
- The four fork-card vendor logo `<img>` elements are present (assert by `src`:
  `langgraph.svg`, `copilotkit.svg`, `google.svg`, `vercel.svg`).
- A copy button is present on the backend snippets (assert by `aria-label`
  containing "Copy install command").
- All existing link-target, step-heading, and search-prompt assertions still
  pass (link targets and step labels are unchanged).

Add a focused unit test `CopyButton.spec.tsx` mirroring the existing
`Hero.spec.tsx`/clipboard-test pattern: clicking the button calls
`navigator.clipboard.writeText` with the given `text` and shows the copied state.

## Out of scope

- Funnel structure, routing, ordering, or `docsConfig` changes.
- New vendor logos beyond the four already in `public/logos/`.
- Wayfinding/search changes (real inline search), responsive/a11y rework beyond
  the alt-text and aria-label noted above.
- The supporting cards remain logo-less beyond their in-house glyphs.
