# Chat UI Redesign — Apple-Clean Aesthetic

**Date:** 2026-04-05
**Status:** Draft
**Scope:** Visual redesign of `@cacheplane/chat` composition layer. No changes to headless primitives, types, DI, or test utilities.

---

## Overview

Redesign the `@cacheplane/chat` prebuilt compositions with an Apple-clean aesthetic: neutral grays, generous whitespace, SF Pro typography, pill-shaped input, asymmetric rounded corners. Fully responsive (desktop → mobile). Fully themeable via CSS custom properties. Light and dark mode support via `prefers-color-scheme`.

### Design Principles

1. **Neutral by default** — Grays only. No brand color in shipped defaults. Developers add their brand via CSS vars.
2. **AI = text, Human = bubble** — AI responses render as plain text with avatar badge (ChatGPT pattern). Human messages get a subtle surface bubble. Clear visual hierarchy.
3. **Centered column** — 720px max-width centered content. Optimal reading width. Full-bleed on mobile with 16px edge padding.
4. **Template overrides for extensibility** — Developers content-project `chatMessageTemplate` directives into `<chat>` to replace any message type's rendering. The composition detects overrides and uses them instead of defaults.

---

## Theming Architecture

### CSS Custom Properties

All visual properties are exposed as CSS custom properties on the host element. Two built-in themes (dark/light) ship as defaults. Developers override any property at their app level.

#### Surfaces

| Property | Dark Default | Light Default | Purpose |
|----------|-------------|---------------|---------|
| `--chat-bg` | `#171717` | `#ffffff` | Main background |
| `--chat-bg-alt` | `#222222` | `#f5f5f5` | Input, cards, elevated surfaces |
| `--chat-bg-hover` | `#2a2a2a` | `#ebebeb` | Hover state for interactive elements |

#### Text

| Property | Dark Default | Light Default | Purpose |
|----------|-------------|---------------|---------|
| `--chat-text` | `#e0e0e0` | `#1a1a1a` | Primary text |
| `--chat-text-muted` | `#777777` | `#999999` | Secondary/label text |
| `--chat-text-placeholder` | `#666666` | `#999999` | Input placeholder |

#### Borders

| Property | Dark Default | Light Default | Purpose |
|----------|-------------|---------------|---------|
| `--chat-border` | `#333333` | `#e5e5e5` | Standard border |
| `--chat-border-light` | `#2a2a2a` | `#f0f0f0` | Subtle dividers |

#### User Messages

| Property | Dark Default | Light Default | Purpose |
|----------|-------------|---------------|---------|
| `--chat-user-bg` | `#2a2a2a` | `#f0f0f0` | Human message bubble |
| `--chat-user-text` | `#f5f5f5` | `#1a1a1a` | Human message text |
| `--chat-user-border` | `#333333` | `transparent` | Human message border |

#### Avatar

| Property | Dark Default | Light Default | Purpose |
|----------|-------------|---------------|---------|
| `--chat-avatar-bg` | `#333333` | `#f0f0f0` | Agent avatar background |
| `--chat-avatar-text` | `#aaaaaa` | `#666666` | Agent avatar letter |

#### Input

| Property | Dark Default | Light Default | Purpose |
|----------|-------------|---------------|---------|
| `--chat-input-bg` | `#222222` | `#f5f5f5` | Input container |
| `--chat-input-border` | `#333333` | `#e5e5e5` | Input border |
| `--chat-input-focus-border` | `#555555` | `#cccccc` | Input border on focus |
| `--chat-send-bg` | `#444444` | `#e5e5e5` | Send button background |
| `--chat-send-text` | `#aaaaaa` | `#999999` | Send button icon |

#### Status

| Property | Dark Default | Light Default | Purpose |
|----------|-------------|---------------|---------|
| `--chat-error-bg` | `#2d1515` | `#fef2f2` | Error banner background |
| `--chat-error-text` | `#f87171` | `#dc2626` | Error text |
| `--chat-warning-bg` | `#2d2315` | `#fffbeb` | Interrupt/warning background |
| `--chat-warning-text` | `#fbbf24` | `#d97706` | Interrupt text |
| `--chat-success` | `#4ade80` | `#16a34a` | Success indicators |

#### Geometry

| Property | Default | Purpose |
|----------|---------|---------|
| `--chat-radius-message` | `20px` | Message bubble radius |
| `--chat-radius-input` | `24px` | Input pill radius |
| `--chat-radius-card` | `12px` | Card/panel radius |
| `--chat-radius-avatar` | `8px` | Avatar radius |
| `--chat-max-width` | `720px` | Content column max-width |

#### Typography

| Property | Default | Purpose |
|----------|---------|---------|
| `--chat-font-family` | `-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif` | System font stack |
| `--chat-font-size` | `15px` | Base font size |
| `--chat-line-height` | `1.6` | Base line height |

### Dark/Light Mode Activation

- Default: dark theme
- Light mode: `@media (prefers-color-scheme: light)` overrides all properties
- Manual control: set `data-chat-theme="light"` or `data-chat-theme="dark"` on a parent element to force a mode regardless of system preference

### Theme File

New file: `libs/chat/src/lib/styles/chat-theme.css`

Imported by composition components via Angular's `styles` or `styleUrls`. Defines `:host` defaults (dark) and `@media (prefers-color-scheme: light)` block. Also supports `[data-chat-theme="light"]` and `[data-chat-theme="dark"]` attribute selectors.

---

## Responsive Design

| Breakpoint | Content Width | Edge Padding | Message Max Width | Font Size |
|------------|--------------|-------------|-------------------|-----------|
| ≥1024px (desktop) | `var(--chat-max-width)` centered | 20px | 75% | 15px |
| 768–1023px (tablet) | 100% (max `var(--chat-max-width)`) | 20px | 80% | 15px |
| <768px (mobile) | 100% full-bleed | 16px | 85% | 14–15px |

- Input: minimum 44px touch target height on mobile
- Send button: 32px desktop, 36px mobile
- Thread sidebar: hidden on mobile (collapses behind a toggle or removed entirely)

---

## Component Changes

### `<chat>` (selector change: `chat-ui` → `chat`)

The main prebuilt composition. Renders the full chat experience.

**Message rendering:**
- Human messages: right-aligned bubble with `var(--chat-user-bg)`, asymmetric radius (`--chat-radius-message` top-left/top-right/bottom-right, 6px bottom-left for "tail" effect), `var(--chat-user-border)` border
- AI messages: no bubble — plain text, left-aligned, with an avatar badge (24px square, `var(--chat-radius-avatar)` corners, `var(--chat-avatar-bg)`) and an "Assistant" label in `var(--chat-text-muted)`
- Tool messages: monospace, subtle `var(--chat-bg-alt)` background, `var(--chat-radius-card)` corners
- System messages: centered, `var(--chat-text-muted)`, italic, small font

**Template override mechanism:**
- `<chat>` uses `contentChildren(MessageTemplateDirective)` to detect developer-provided templates
- If a `chatMessageTemplate` for a given type (human/ai/tool/system) is projected, it replaces the default
- If no override is projected, the built-in default template renders
- This means `<chat [ref]="stream" />` works zero-config, but developers can override any or all templates

**Layout:**
- Flex column, full height of parent
- Messages area: scrollable, centered column
- Input area: fixed at bottom, centered column matching messages width
- Optional thread sidebar: rendered when `threads` input is non-empty

### `<chat-input>` (primitive — styled template update)

- Pill-shaped container: `var(--chat-input-bg)`, `var(--chat-radius-input)` border-radius
- Auto-expanding textarea (CSS `field-sizing: content` or JS fallback)
- Circular send button on the right: `var(--chat-send-bg)`, fully round
- Focus state: `var(--chat-input-focus-border)` with `transition: border-color 0.2s`
- Disabled state: `opacity: 0.5` when `ref.isLoading()`

### `<chat-typing-indicator>`

- Three-dot pulse animation: 5px dots, staggered 0.2s delay
- Rendered below last AI message, with avatar badge matching AI message style
- Dot color: `var(--chat-text-muted)`

### `<chat-error>`

- Inline banner above input area
- `var(--chat-error-bg)` background, `var(--chat-error-text)` text
- `var(--chat-radius-card)` corners
- Subtle, non-intrusive

### `<chat-interrupt-panel>`

- Warning banner: `var(--chat-warning-bg)` with `var(--chat-warning-text)`
- Action buttons: neutral `var(--chat-bg-alt)` with `var(--chat-border)` — not colored per-action
- `var(--chat-radius-card)` corners

### `<chat-tool-call-card>` and `<chat-subagent-card>`

- Cards: `var(--chat-bg-alt)` background, `var(--chat-border)` border, `var(--chat-radius-card)` corners
- Collapsible with smooth height transition
- Monospace font for JSON content
- Status badges use `var(--chat-text-muted)` with colored dot indicators

### `<chat-debug>`

- Same theme variables throughout — inherits the full system
- Debug panel: `var(--chat-bg)` background, `var(--chat-border)` left border
- Checkpoint cards, state inspector, diff: all use `var(--chat-bg-alt)`, `var(--chat-border)`, `var(--chat-radius-card)`

---

## Files Changed

| File | Change | Type |
|------|--------|------|
| `libs/chat/src/lib/styles/chat-theme.css` | New | CSS custom properties + dark/light defaults |
| `libs/chat/src/lib/compositions/chat/chat.component.ts` | Rewrite template + add theme import | Composition |
| `libs/chat/src/lib/primitives/chat-input/chat-input.component.ts` | Style the template | Primitive |
| `libs/chat/src/lib/primitives/chat-typing-indicator/chat-typing-indicator.component.ts` | Dot animation + themed | Primitive |
| `libs/chat/src/lib/primitives/chat-error/chat-error.component.ts` | Styled error banner | Primitive |
| `libs/chat/src/lib/compositions/chat-interrupt-panel/chat-interrupt-panel.component.ts` | Restyle with theme vars | Composition |
| `libs/chat/src/lib/compositions/chat-tool-call-card/chat-tool-call-card.component.ts` | Restyle with theme vars | Composition |
| `libs/chat/src/lib/compositions/chat-subagent-card/chat-subagent-card.component.ts` | Restyle with theme vars | Composition |
| `libs/chat/src/lib/compositions/chat-debug/chat-debug.component.ts` | Restyle with theme vars | Composition |
| `cockpit/langgraph/streaming/angular/src/app/streaming.component.ts` | Update selector `chat-ui` → `chat` | Cockpit example |

**No changes to:** headless primitive logic, types, DI providers, public-api.ts exports, tests.

---

## Key Decisions Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Design direction | Apple-clean (Option A) | Industry-standard ChatGPT-like pattern, clean and modern |
| Color palette | Neutral grays, no brand color | Works in any application, developers add brand via CSS vars |
| AI message style | No bubble, plain text + avatar | ChatGPT pattern, reduces visual noise, focuses on content |
| Human message style | Subtle surface bubble, asymmetric radius | Clear visual distinction without strong brand color |
| Theming | CSS custom properties | Most flexible, no runtime overhead, works with any CSS framework |
| Dark/light mode | `prefers-color-scheme` + `data-chat-theme` attribute | Automatic system detection + manual override for app control |
| Extensibility | Template overrides via `chatMessageTemplate` | Full rendering control per message type, Angular-idiomatic |
| Responsive | 720px centered → full-bleed mobile | Optimal reading width desktop, maximum space mobile |
| Selector | `chat` (not `chat-ui`) | Simple, memorable |
| Input shape | Pill (24px radius) | Apple/ChatGPT convention, modern feel |
