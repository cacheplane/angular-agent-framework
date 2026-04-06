# Angular Stream Resource Website — Brand Refresh Design Specification

**Date:** 2026-03-18
**Status:** Approved
**Supersedes:** Section 3 (Next.js Website Architecture) of `2026-03-17-stream-resource-design.md`

---

## Overview

Update the Angular Stream Resource website design from its original warm "dark luxury" aesthetic (gold accent, warm cream text) to a cool indigo-blue neon aesthetic that aligns with LangChain's current brand energy while maintaining a distinct product identity.

**Design direction:** Inspired by LangChain, not a copy. EB Garamond headlines are retained as the primary differentiator — the serif-meets-neon contrast is uncommon in the developer tools space and creates a distinctive signature. Accent color is indigo-blue `#6C8EFF` rather than LangChain's cyan `#7FC8FF`.

---

## 1. Design Tokens

### Colors

| Token | Value | Usage |
|---|---|---|
| `--color-bg` | `#080B14` | Page background (cool near-black, blue-tinted) |
| `--color-accent` | `#6C8EFF` | Primary accent: borders, icons, active states, CTAs |
| `--color-accent-glow` | `rgba(108, 142, 255, 0.35)` | Glow shadows on accent elements |
| `--color-accent-border` | `rgba(108, 142, 255, 0.15)` | Default card/container borders |
| `--color-accent-border-hover` | `rgba(108, 142, 255, 0.40)` | Border on hover |
| `--color-accent-surface` | `rgba(108, 142, 255, 0.08)` | Inline code background, row hover |
| `--color-text-primary` | `#EEF1FF` | Body text, headings |
| `--color-text-secondary` | `#8B96C8` | Subheads, captions, secondary labels |
| `--color-text-muted` | `#4A527A` | Sidebar section headers, disabled states |
| `--color-sidebar-bg` | `#0A0D18` | Docs sidebar background |

### Typography

Unchanged from the original spec:

| Role | Font | Size | Weight |
|---|---|---|---|
| Hero headline | EB Garamond | 156px | 800 |
| Section titles | EB Garamond | 60px | 800 + italic pair |
| Taglines | EB Garamond italic | 22–30px | 400 |
| Body | Inter | 15px | 400 |
| Feature descriptions | Inter | 14px | 400 |
| Code | JetBrains Mono | 12px | 400 |
| Labels / eyebrows | JetBrains Mono uppercase | 10px | 400 |

Eyebrow labels use `--color-accent` (`#6C8EFF`) as their color.

### Syntax Highlighting

Shiki theme: `tokyo-night` — applied consistently across landing page code block, docs code blocks, and API reference. Pairs naturally with the indigo accent and is immediately recognizable to the developer audience.

---

## 2. Glow Treatment

Neon glow is applied to three elements only. Everything else is clean.

| Element | Glow |
|---|---|
| Hero headline | `text-shadow: 0 0 40px rgba(108, 142, 255, 0.5)` |
| Live demo container | `box-shadow: 0 0 30px rgba(108, 142, 255, 0.25)` (persistent) |
| Highlighted plan card (pricing) | `box-shadow: 0 0 24px rgba(108, 142, 255, 0.3)` |
| Accent borders on hover | `box-shadow: 0 0 12px rgba(108, 142, 255, 0.2)` |
| CTA buttons on hover | `box-shadow: 0 0 16px rgba(108, 142, 255, 0.4)` added to existing solid fill (fill and text color unchanged) |

Glow is **not** applied to: sidebar, comparison table, form inputs at rest, feature cards at rest, API reference, docs body.

---

## 3. Landing Page

### Hero

- EB Garamond 156px headline with letter-by-letter reveal animation (GSAP-style stagger)
- The word "Angular" renders in `#6C8EFF` with `text-shadow: 0 0 40px rgba(108,142,255,0.5)`
- Subhead: Inter 20px `#8B96C8`
- `npm install stream-resource` install strip below: JetBrains Mono, border `rgba(108,142,255,0.15)`, copy button with accent glow on hover

### Architecture Diagram

- SVG `animateMotion` animation retained unchanged
- Data flow lines and node borders: `#6C8EFF`
- Active node state: radial glow `rgba(108,142,255,0.3)`

### Feature Strip

- 6 cards, same grid layout
- Card borders: `rgba(108,142,255,0.15)` at rest
- On hover: border → `rgba(108,142,255,0.4)` + `box-shadow: 0 0 12px rgba(108,142,255,0.2)`
- Icon color: `#6C8EFF`

### Code Block

- Shiki `tokyo-night` theme
- Container border: `rgba(108,142,255,0.15)`

### Live Demo

- Container: `#6C8EFF` border + `box-shadow: 0 0 30px rgba(108,142,255,0.25)` persistent glow
- Streaming tokens: `#6C8EFF` color flash per chunk — 100ms fade-in, 200ms fade-out, linear easing

---

## 4. Pricing Page

### Plan Cards

- Recommended card ("Developer Seat"): `#6C8EFF` border at full opacity + `box-shadow: 0 0 24px rgba(108,142,255,0.3)`
- Other cards: `rgba(108,142,255,0.15)` border
- Price figures: EB Garamond (same scale as original spec)

### Comparison Table

- Checkmarks and "included" indicators: `#6C8EFF`
- Row hover: `rgba(108,142,255,0.06)` background tint

### Lead Gen Form

- Input focus ring: `#6C8EFF` with glow
- Submit button: solid `#6C8EFF` background, `#EEF1FF` text, glow on hover
- No letter-reveal animations — pricing page is calm and trustworthy

---

## 5. Docs Pages

No glow treatment on any docs page. Functional and calm.

### Sidebar

- Background: `#0A0D18`
- Active item: `#6C8EFF` text + `rgba(108,142,255,0.1)` background pill
- Hover: `rgba(108,142,255,0.06)` pill
- Section headers: JetBrains Mono uppercase `#4A527A`

### Content Area

- `h1`/`h2`: EB Garamond
- Body: Inter
- Inline code: `#6C8EFF` text on `rgba(108,142,255,0.08)` background
- Code blocks: `tokyo-night` theme

### API Reference

- Two-column layout (unchanged)
- Parameter names: `#6C8EFF`
- Type annotations: `#8B96C8`
- No decoration

---

## 6. Shared Components

### Nav

- Logo wordmark: EB Garamond
- Active link: underlined in `#6C8EFF`
- CTA button ("Get Started"): solid `#6C8EFF`, `#EEF1FF` text, glow on hover

### Footer

- Same structure as original spec
- All gold accent references replaced with `#6C8EFF`

---

## 7. What Is Not Changing

The following are unchanged from `2026-03-17-stream-resource-design.md`:

- Page structure and routes (`/`, `/pricing`, `/docs/[slug]`, `/api-reference`)
- Component architecture (`Hero`, `ArchDiagram`, `FeatureStrip`, `PricingGrid`, etc.)
- Animation library (Framer Motion)
- MDX docs pipeline and documentation generation scripts
- Angular Elements live demo integration
- Pricing model and tiers
- Playwright e2e test coverage requirements
- Vercel deployment configuration
