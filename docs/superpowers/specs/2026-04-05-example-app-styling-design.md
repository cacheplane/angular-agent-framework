# Example App Styling & Layout Design

## Problem

The 14 cockpit Angular example apps use a hardcoded dark navy theme (`background: #08111f`) with no CSS variables, no Tailwind, and no reference to the shared design system. They render inside the cockpit's iframe with visually jarring dark backgrounds against the cockpit's light glassmorphism shell. The cockpit sidebar also surfaces "overview" page links that are unnecessary, and code blocks in documentation overflow their containers horizontally.

## Goal

Align all 14 Angular example apps with the website's light glassmorphism theme by consuming `@cacheplane/design-tokens` via a shared CSS custom properties file and adding Tailwind v4. Remove the "overview" sidebar links and fix the code overflow layout issue.

## Constraints

- The `@cacheplane/chat` library is being rebuilt separately and is **out of scope**. That library will use Tailwind + CSS vars (`--chat-*`) and will consume the same token vars we're setting up here.
- Angular apps render inside iframes in the cockpit — no CSS inheritance from the parent shell.
- Angular apps should remain full-bleed (no header/chrome — the cockpit shell provides all context).
- Must use Tailwind v4 (`@import "tailwindcss"` + `@theme` block) to match the website and cockpit.

## Architecture

### Token Distribution

```
@cacheplane/design-tokens
├── src/lib/colors.ts        (existing TS objects)
├── src/lib/glass.ts         (existing TS objects)
├── src/lib/gradients.ts     (existing TS objects)
├── src/lib/typography.ts    (existing TS objects)
├── src/lib/tokens.css       ← NEW: CSS custom properties
└── src/index.ts             (existing barrel export)
```

**Three consumers, one token source:**

| Consumer | How it imports tokens |
|----------|---------------------|
| Website (Next.js) | TS objects → injects as CSS vars at runtime |
| Cockpit Shell (Next.js) | TS via `@cacheplane/ui-react` `cssVars` → CSS vars |
| 14 Angular apps | `@import "@cacheplane/design-tokens/tokens.css"` → CSS vars |

### New: `tokens.css`

A hand-maintained CSS file in the design-tokens library that defines all tokens as `--ds-*` custom properties on `:root`. This uses the same `--ds-` prefix already used by the cockpit shell's `cssVars` injection, ensuring consistency.

```css
:root {
  /* Colors */
  --ds-bg: #f8f9fc;
  --ds-surface: #ffffff;
  --ds-accent: #004090;
  --ds-accent-hover: #003070;
  --ds-text-primary: #1a1a2e;
  --ds-text-secondary: #555770;
  --ds-text-muted: #8b8fa3;
  --ds-border: rgba(0, 64, 144, 0.08);
  --ds-error: #ef4444;
  --ds-success: #22c55e;

  /* Glass */
  --ds-glass-bg: rgba(255, 255, 255, 0.45);
  --ds-glass-border: rgba(255, 255, 255, 0.5);
  --ds-glass-blur: 16px;
  --ds-glass-shadow: 0 8px 32px rgba(0, 0, 0, 0.06);

  /* Gradient */
  --ds-gradient-bg: linear-gradient(135deg, #fff5f5 0%, #f0e6ff 40%, #e6f0ff 100%);

  /* Typography */
  --ds-font-serif: 'EB Garamond', Georgia, serif;
  --ds-font-sans: 'Inter', system-ui, -apple-system, sans-serif;
  --ds-font-mono: 'JetBrains Mono', 'Fira Code', monospace;
}
```

The values mirror what's in the TS objects (`colors.ts`, `glass.ts`, etc.). They change rarely — this is a design system, not application state.

### Angular App `styles.css` — New Structure

Each Angular app's `styles.css` replaces the 4-line dark reset with:

```css
@import "@cacheplane/design-tokens/tokens.css";
@import "tailwindcss";

@theme {
  --color-bg: var(--ds-bg);
  --color-surface: var(--ds-surface);
  --color-accent: var(--ds-accent);
  --color-text-primary: var(--ds-text-primary);
  --color-text-secondary: var(--ds-text-secondary);
  --color-text-muted: var(--ds-text-muted);
  --color-border: var(--ds-border);
  --color-error: var(--ds-error);
  --color-success: var(--ds-success);
  --font-sans: var(--ds-font-sans);
  --font-serif: var(--ds-font-serif);
  --font-mono: var(--ds-font-mono);
}

body {
  margin: 0;
  font-family: var(--ds-font-sans);
  background: var(--ds-bg);
  color: var(--ds-text-primary);
}
```

This gives every Angular app:
- All design tokens as CSS custom properties (via `tokens.css`)
- Tailwind v4 utility classes (via `@import "tailwindcss"`)
- Tailwind-aware token aliases (via `@theme` block) — e.g., `bg-bg`, `text-accent`, `font-mono`
- A light theme body matching the website

### Tailwind v4 Setup per Angular App

Each Angular app needs:

1. **`tailwindcss` as a dev dependency** — added to the root `package.json` (already present for website/cockpit)
2. **Updated `styles.css`** — as shown above
3. **No `tailwind.config.js`** — Tailwind v4 uses CSS-native `@theme` blocks instead

The Angular build toolchain (`@angular/build:application` via esbuild) supports CSS imports natively. The `@import "tailwindcss"` directive is processed by the CSS pipeline at build time.

### Cockpit Fixes

#### Remove "Overview" Sidebar Link

The cockpit sidebar surfaces navigation links generated from the manifest. The "overview" entries in the manifest (or the sidebar rendering logic) need to be filtered out so that "overview" doesn't appear as a clickable page link. The default behavior of showing Run mode when navigating to a capability remains unchanged.

#### Fix Code Overflow

Code blocks in the documentation mode overflow their container on the x-axis, causing layout issues (visible at e.g., `/langgraph/core-capabilities/persistence/overview/python`). The fix is a CSS constraint — `max-width: 100%` and `overflow-x: auto` on the code block container in the cockpit's doc rendering styles.

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `libs/design-tokens/src/lib/tokens.css` | CSS custom properties for all design tokens |
| Modify | `libs/design-tokens/package.json` | Add `exports` entry for `tokens.css` |
| Modify | `cockpit/langgraph/*/angular/src/styles.css` (8 files) | Replace dark theme with token-based light theme + Tailwind |
| Modify | `cockpit/deep-agents/*/angular/src/styles.css` (6 files) | Same as above |
| Modify | `apps/cockpit/src/components/sidebar/navigation-groups.tsx` | Filter out "overview" entries |
| Modify | `apps/cockpit/src/app/cockpit.css` | Fix code block overflow (`max-width`, `overflow-x: auto`) |

## Out of Scope

- Chat component redesign (`@cacheplane/chat` rebuild is a separate effort)
- Adding headers/chrome to Angular apps (full-bleed chat, cockpit provides context)
- Routing changes in the cockpit
- Website or cockpit shell styling changes
- Tailwind classes in Angular component templates (that comes with the chat lib)
