# Glassy & Gradient Website Redesign

**Date**: 2026-04-03
**Scope**: Website app (`apps/website`) — all pages
**Future alignment**: Cockpit app will adopt the same token system later

## Overview

Refactor the Angular Agent Framework website from a dark navy solid-background design to a light, frosted-glass aesthetic with dual-brand ambient gradients. The design communicates the "bridge between Angular and LangGraph" through a warm→cool gradient flow (Angular red → LangGraph blue) with translucent glass panels floating on top.

## Design Decisions

| Decision | Choice |
|----------|--------|
| Base palette | Light frosted (white/cream `#f8f9fc`) |
| Brand colors | Angular red `#DD0031` + LangGraph blue `#004090` / `#64C3FD` |
| Gradient style | Warm→cool flow (red top-left → lavender midpoint → blue bottom-right) |
| Brand prominence | Dual-brand gradient — red and blue define the ambient background |
| Glass intensity | Balanced (14-16px blur, 40-50% white opacity, subtle borders) |
| Approach | Token-first: update design tokens, then sweep components |
| Scope | All pages: landing, nav/footer, docs, pricing, API reference |

## Design Tokens

### Palette Replacement

| Token | Current | New |
|-------|---------|-----|
| `bg` | `#080B14` | `#f8f9fc` |
| `accent` | `#6C8EFF` | `#004090` (LangGraph blue) |
| `accentLight` | n/a (new) | `#64C3FD` (LangGraph sky) |
| `angularRed` | `#DD0031` | `#DD0031` (unchanged) |
| `textPrimary` | `#EEF1FF` | `#1a1a2e` (dark ink) |
| `textSecondary` | `#8B96C8` | `#555770` (warm gray) |
| `textMuted` | `#4A527A` | `#8b8fa3` |
| `sidebarBg` | `#0A0D18` | `rgba(255,255,255,0.45)` (glass) |

### New Glass Tokens

| Token | Value | Purpose |
|-------|-------|---------|
| `glass.bg` | `rgba(255,255,255,0.45)` | Default glass panel fill |
| `glass.bgHover` | `rgba(255,255,255,0.55)` | Glass on hover |
| `glass.blur` | `16px` | Backdrop blur amount |
| `glass.border` | `rgba(255,255,255,0.6)` | Subtle white edge |
| `glass.shadow` | `0 4px 24px rgba(0,0,0,0.06)` | Soft diffuse shadow |

### New Gradient Tokens

| Token | Value |
|-------|-------|
| `gradient.warm` | `radial-gradient(circle, rgba(221,0,49,0.18), transparent 70%)` |
| `gradient.cool` | `radial-gradient(circle, rgba(0,64,144,0.18), transparent 70%)` |
| `gradient.coolLight` | `radial-gradient(circle, rgba(100,195,253,0.15), transparent 70%)` |
| `gradient.bgFlow` | `linear-gradient(135deg, #fef0f3 0%, #f4f0ff 45%, #eaf3ff 70%, #e6f4ff 100%)` |

### Updated Glow Tokens

| Token | New Value |
|-------|-----------|
| `glow.hero` | `0 0 60px rgba(0,64,144,0.15)` |
| `glow.demo` | `0 0 30px rgba(0,64,144,0.1)` |
| `glow.card` | `0 0 24px rgba(0,64,144,0.1)` |
| `glow.border` | `0 0 12px rgba(0,64,144,0.08)` |
| `glow.button` | `0 0 16px rgba(0,64,144,0.15)` |

### Accent Variant Tokens

| Token | New Value |
|-------|-----------|
| `accentGlow` | `rgba(0,64,144,0.2)` |
| `accentBorder` | `rgba(0,64,144,0.15)` |
| `accentBorderHover` | `rgba(0,64,144,0.3)` |
| `accentSurface` | `rgba(0,64,144,0.06)` |

## Component Specifications

### Nav (`components/shared/Nav.tsx`)

- Background: `glass.bg` with `glass.blur` backdrop-filter
- Border: `glass.border` bottom edge (1px)
- Shadow: `glass.shadow`
- Logo text: `textPrimary` (dark ink)
- Nav links: `textSecondary`, hover → `accent`
- CTA button: solid `accent` background, white text, `glow.button` on hover
- Position: fixed, z-index above gradient blobs

### Footer (`components/shared/Footer.tsx`)

- Background: slightly more opaque glass `rgba(255,255,255,0.55)`
- Border-top: `glass.border`
- Text: dark-ink palette
- Link hover: `accent` blue
- Gradient flow continues behind (no hard color break)

### Install Strip (`components/shared/InstallStrip.tsx`)

- Container: glass panel (`glass.bg`, `glass.blur`, `glass.border`)
- Text: `textPrimary`
- Copy button: glass with accent border, hover → `glass.bgHover`

### Landing Page — Hero (`components/landing/HeroTwoCol.tsx`)

- Full-width `gradient.bgFlow` background
- Angular warm blob (`gradient.warm`) top-left
- LangGraph cool blob (`gradient.cool`) bottom-right
- LangGraph light blob (`gradient.coolLight`) center-right
- Badge tags: brand-colored glass (tinted translucent bg + brand borders)
- Headline: `textPrimary`, italic serif (EB Garamond unchanged)
- Subtitle: `textSecondary`
- Copy prompt button: glass panel with accent border
- Install strip: glass panel

### Landing Page — Architecture Diagram (`components/landing/ArchDiagram.tsx`)

- SVG nodes: glass fills `rgba(255,255,255,0.5)` with subtle stroke
- Edge lines: `accent` and `angularRed` at ~40% opacity
- Animated particles: softer glow for light background
- No separate container background — sits on gradient flow

### Landing Page — Feature Grid (`components/landing/FeatureStrip.tsx`)

- Cards: `glass.bg`, `glass.blur`, `glass.border`
- Hover: `glass.bgHover` + `glow.card`
- Icons/headings: `textPrimary`
- Descriptions: `textSecondary`
- Framer Motion entrance animations unchanged

### Landing Page — Code Block (`components/landing/CodeBlock.tsx`)

- Code theme: stays dark (tokyo-night via Shiki) — standard pattern for light sites
- Container: glass-bordered frame with `glass.border` and `glass.shadow`
- Tab headers: glass treatment

### Landing Page — Live Demo (`components/landing/GenerativeUIFrame.tsx`)

- Browser chrome: stays dark (simulating app window — intentional contrast)
- Outer frame: `glass.border` and `glass.shadow` to float it

### Docs — Sidebar (`components/docs/DocsSidebar.tsx`)

- Background: `glass.bg` with `glass.blur`
- Border-right: `glass.border`
- Active link: `accent` color with `accentSurface` background
- Section headers: `textPrimary`
- Links: `textSecondary`, hover → `accent`

### Docs — Content (`components/docs/MdxRenderer.tsx`)

- Background: `#ffffff` or `rgba(255,255,255,0.8)` — no glass (readability first)
- Prose styles: dark-ink text colors
- Code blocks within docs: stay dark themed
- Gradient visible in page background behind sidebar and margins

### Pricing — Cards (`components/pricing/PricingGrid.tsx`)

- Each card: glass panel treatment
- Featured card: more opaque glass with `accent` border glow
- Plan names: `textPrimary`
- Prices: `accent` blue
- Feature lists: `textSecondary`
- CTA buttons: solid `accent` (primary), glass + accent border (secondary)

### Pricing — Comparison Table (`components/pricing/CompareTable.tsx`)

- Container: glass panel
- Header row: slightly stronger glass `rgba(255,255,255,0.55)`
- Alternating rows: subtle opacity difference
- Check marks: `accent` blue

### Pricing — Lead Form (`components/pricing/LeadForm.tsx`)

- Container: glass panel
- Input fields: `rgba(255,255,255,0.6)` background with `glass.border`
- Submit button: solid `accent`

### API Reference (`components/docs/ApiRefTable.tsx`)

- Container: glass panel (same treatment as comparison table)
- Function signatures: monospace, dark ink
- Parameter types: `accent` blue
- Table borders: `glass.border`

## Global Styles (`src/app/global.css`)

- CSS custom properties updated to match all token values above
- New `@layer` or utility classes for glass treatment:
  - `.glass` — applies bg, blur, border, shadow
  - `.glass-hover` — hover state variant
- Gradient blob positioning classes for reuse across pages
- Body background: `bg` token (`#f8f9fc`)

## Implementation Strategy

1. **Update `design-tokens.ts`** — new palette, glass, gradient, glow tokens
2. **Update `global.css`** — CSS custom properties + glass utility classes
3. **Parallel component sweep** — dispatch subagents per area:
   - Agent 1: Nav + Footer
   - Agent 2: Landing page (Hero, ArchDiagram, FeatureStrip, CodeBlock, GenerativeUIFrame)
   - Agent 3: Docs (Sidebar, MdxRenderer)
   - Agent 4: Pricing (PricingGrid, CompareTable, LeadForm)
   - Agent 5: API Reference (ApiRefTable)
4. **Visual review** — verify each page in browser preview

## Files Modified

- `apps/website/lib/design-tokens.ts`
- `apps/website/src/app/global.css`
- `apps/website/src/app/layout.tsx` (if body class changes needed)
- `apps/website/src/components/shared/Nav.tsx`
- `apps/website/src/components/shared/Footer.tsx`
- `apps/website/src/components/shared/InstallStrip.tsx`
- `apps/website/src/components/landing/HeroTwoCol.tsx`
- `apps/website/src/components/landing/ArchDiagram.tsx`
- `apps/website/src/components/landing/FeatureStrip.tsx`
- `apps/website/src/components/landing/CodeBlock.tsx`
- `apps/website/src/components/landing/GenerativeUIFrame.tsx`
- `apps/website/src/components/docs/DocsSidebar.tsx`
- `apps/website/src/components/docs/MdxRenderer.tsx`
- `apps/website/src/components/docs/ApiRefTable.tsx`
- `apps/website/src/components/pricing/PricingGrid.tsx`
- `apps/website/src/components/pricing/CompareTable.tsx`
- `apps/website/src/components/pricing/LeadForm.tsx`
