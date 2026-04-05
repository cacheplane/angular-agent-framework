# Cockpit Light Theme Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the cockpit from dark navy theme to the website's light glassmorphism theme using `@cacheplane/design-tokens` CSS variables and `@cacheplane/ui-react` components.

**Architecture:** Replace `cockpit.css` dark tokens with design-token CSS variables (`--ds-*`). Update all components from dark Tailwind classes to light theme. Replace cockpit-specific shadcn `ui/button.tsx` and `ui/tabs.tsx` with shared `@cacheplane/ui-react` components where possible. Keep Radix Tabs for the mode switcher (it needs controlled state). Update doc component CSS for light backgrounds. Change Shiki theme from `github-dark` to `tokyo-night` to match the website's dark-code-on-light-bg pattern.

**Tech Stack:** Tailwind v4, `@cacheplane/design-tokens`, `@cacheplane/ui-react`, Radix UI, Shiki

---

## File Map

| Action | File | Change |
|--------|------|--------|
| Modify | `apps/cockpit/src/app/cockpit.css` | Replace dark tokens with `--ds-*` CSS vars, update doc component colors |
| Modify | `apps/cockpit/src/app/layout.tsx` | Light body classes, gradient background |
| Modify | `apps/cockpit/src/components/cockpit-shell.tsx` | Light glass sidebar/workspace, update text colors |
| Modify | `apps/cockpit/src/components/sidebar/cockpit-sidebar.tsx` | Glass panel treatment |
| Modify | `apps/cockpit/src/components/sidebar/navigation-groups.tsx` | Light text colors |
| Modify | `apps/cockpit/src/components/sidebar/language-picker.tsx` | Light button/menu styles |
| Modify | `apps/cockpit/src/components/modes/mode-switcher.tsx` | Light tab styling |
| Modify | `apps/cockpit/src/components/run-mode/run-mode.tsx` | Light empty state |
| Modify | `apps/cockpit/src/components/code-mode/code-mode.tsx` | Light tab bar, keep dark code blocks |
| Modify | `apps/cockpit/src/components/narrative-docs/narrative-docs.tsx` | Light prose colors |
| Modify | `apps/cockpit/src/components/api-mode/api-mode.tsx` | Light card colors |
| Modify | `apps/cockpit/src/components/ui/tabs.tsx` | Update to light styling |
| Modify | `apps/cockpit/src/components/ui/button.tsx` | Update to use `GlassButton` pattern |
| Modify | `apps/cockpit/src/lib/content-bundle.ts` | Change Shiki theme to `tokyo-night` |
| Modify | `apps/cockpit/src/lib/render-markdown.ts` | Change Shiki theme to `tokyo-night` |
| Modify | `apps/cockpit/package.json` | Remove `@radix-ui/react-dialog` |

---

### Task 1: Replace cockpit.css with light theme + design-token CSS vars

**Files:**
- Modify: `apps/cockpit/src/app/cockpit.css`
- Modify: `apps/cockpit/src/app/layout.tsx`

- [ ] **Step 1: Replace cockpit.css entirely**

Replace all content of `apps/cockpit/src/app/cockpit.css` with a light theme that:
- Uses `@import "tailwindcss"`
- Defines `@theme` with the design-token values (colors, fonts)
- Sets `:root` CSS variables using `--ds-*` naming from the `cssVars` helper
- Updates all `.doc-*` component classes for light backgrounds
- Changes code block styling for dark-on-light

The CSS should wire the design tokens as CSS custom properties that Tailwind and the `ui-react` components reference via `var(--ds-*)`.

Key color changes:
- Background: `#f8f9fc` (light cream, not `#08111f` navy)
- Text primary: `#1a1a2e` (dark ink, not `#edf3ff` white)
- Accent: `#004090` (blue, not `#7dd3fc` cyan)
- Glass: `rgba(255,255,255,0.45)` (white glass, not dark card)
- Borders: `rgba(255,255,255,0.6)` (white glass border, not dark border)
- Muted text: `#8b8fa3`
- Fonts: EB Garamond (serif), Inter (sans), JetBrains Mono (mono)

Doc component color updates:
- `.doc-callout__content` color: `#555770` (not `#c8d6e5`)
- `.doc-prompt__content` color: `#555770` (not `#d4c6e8`)
- `.doc-api-table td` color: `#555770` (not `#c8d6e5`)
- `.doc-summary` bg: `rgba(0, 64, 144, 0.04)` border: `rgba(0, 64, 144, 0.12)` (blue, not cyan)
- `.doc-callout--tip` bg/border: use `rgba(0, 64, 144, *)` (blue, not cyan)
- `.doc-step__number` bg: `var(--ds-accent)` text: `#fff`
- `.doc-codeblock__header` bg: `rgba(26, 27, 38, 0.95)` (dark header on light page)

- [ ] **Step 2: Update layout.tsx for light theme**

Replace body className with light theme classes:
```tsx
<body className="min-h-screen bg-[var(--ds-bg)] text-[var(--ds-text-primary)] font-sans antialiased"
      style={{ background: 'var(--ds-gradient-bg-flow)' }}>
```

Remove `color-scheme: dark` from CSS.

- [ ] **Step 3: Commit**

```bash
git add apps/cockpit/src/app/
git commit -m "feat(cockpit): migrate CSS to light glassmorphism theme with design tokens"
```

---

### Task 2: Update shell, sidebar, and navigation for light theme

**Files:**
- Modify: `apps/cockpit/src/components/cockpit-shell.tsx`
- Modify: `apps/cockpit/src/components/sidebar/cockpit-sidebar.tsx`
- Modify: `apps/cockpit/src/components/sidebar/navigation-groups.tsx`
- Modify: `apps/cockpit/src/components/sidebar/language-picker.tsx`

- [ ] **Step 1: Update CockpitShell**

Replace dark Tailwind classes with light:
- Workspace: `bg-card/88 backdrop-blur-[14px]` → `bg-[var(--ds-glass-bg)] backdrop-blur-[var(--ds-glass-blur)] [-webkit-backdrop-filter:blur(var(--ds-glass-blur))]`
- Text muted: `text-muted-foreground` → `text-[var(--ds-text-muted)]`
- Border color: `text-border` → `text-[var(--ds-accent-border)]`
- Title: `text-sm font-medium` → `text-sm font-medium text-[var(--ds-text-primary)]`

- [ ] **Step 2: Update CockpitSidebar**

Replace `bg-card/88 backdrop-blur-[14px]` with glass treatment:
- `bg-[var(--ds-glass-bg)] backdrop-blur-[var(--ds-glass-blur)] [-webkit-backdrop-filter:blur(var(--ds-glass-blur))]`
- Border: `border-r border-[var(--ds-glass-border)]`
- Header text: `text-[var(--ds-text-muted)]`

- [ ] **Step 3: Update NavigationGroups**

- Product headings: `text-[var(--ds-text-primary)]`
- Section headings: `text-[var(--ds-text-muted)]`
- Links: `text-[var(--ds-text-secondary)]`
- Active link: `text-[var(--ds-accent)]`

- [ ] **Step 4: Update LanguagePicker**

- Button: glass treatment with `bg-[var(--ds-glass-bg)]` border `var(--ds-glass-border)`
- Menu: glass panel with shadow
- Active item: `text-[var(--ds-accent)]`

- [ ] **Step 5: Commit**

```bash
git add apps/cockpit/src/components/cockpit-shell.tsx apps/cockpit/src/components/sidebar/
git commit -m "feat(cockpit): update shell and sidebar for light glass theme"
```

---

### Task 3: Update mode switcher and tabs for light theme

**Files:**
- Modify: `apps/cockpit/src/components/modes/mode-switcher.tsx`
- Modify: `apps/cockpit/src/components/ui/tabs.tsx`

- [ ] **Step 1: Update Tabs component styling**

In `ui/tabs.tsx`, replace dark pill styling with light glass:
- TabsList: remove dark shadow, use glass bg
- TabsTrigger: `bg-[var(--ds-glass-bg)]` border `var(--ds-glass-border)`, active state uses `bg-[var(--ds-accent)]` text `white`
- Text: `text-[var(--ds-text-secondary)]`

- [ ] **Step 2: Update ModeSwitcher**

Update the TabsList wrapper:
- Remove dark shadow `shadow-[0_24px_80px_rgba(3,9,18,0.45)]`
- Use `bg-[var(--ds-glass-bg)] shadow-[var(--ds-glass-shadow)] border border-[var(--ds-glass-border)]`

- [ ] **Step 3: Commit**

```bash
git add apps/cockpit/src/components/modes/ apps/cockpit/src/components/ui/
git commit -m "feat(cockpit): update mode switcher and tabs for light theme"
```

---

### Task 4: Update content surfaces for light theme

**Files:**
- Modify: `apps/cockpit/src/components/run-mode/run-mode.tsx`
- Modify: `apps/cockpit/src/components/code-mode/code-mode.tsx`
- Modify: `apps/cockpit/src/components/narrative-docs/narrative-docs.tsx`
- Modify: `apps/cockpit/src/components/api-mode/api-mode.tsx`

- [ ] **Step 1: Update RunMode**

- Empty state text: `text-[var(--ds-text-muted)]`

- [ ] **Step 2: Update CodeMode**

- File path label: `text-[var(--ds-text-muted)]`
- Empty state: `text-[var(--ds-text-muted)]`
- Tab separator: `text-[var(--ds-accent-border)]`
- Prompt tabs: `text-[var(--ds-accent)]/70` active `text-[var(--ds-accent)]`

- [ ] **Step 3: Update NarrativeDocs**

Replace dark prose selectors with light:
- `[&_h1]`, `[&_h2]`, `[&_h3]`: `text-[var(--ds-text-primary)]`
- `[&_p]`, `[&_li]`: `text-[var(--ds-text-secondary)]`
- `[&_strong]`: `text-[var(--ds-text-primary)]`
- `[&_a]`: `text-[var(--ds-accent)]`
- `[&_code]`: `text-[var(--ds-accent)] bg-[var(--ds-accent-surface)]`

- [ ] **Step 4: Update ApiMode**

- Section headers: `text-[var(--ds-text-muted)]`
- Article titles: `text-[var(--ds-text-primary)]`
- Source file label: `text-[var(--ds-text-muted)]`
- Signature: `text-[var(--ds-accent)]`
- Description: `text-[var(--ds-text-secondary)]`
- Param name code: `text-[var(--ds-accent)] bg-[var(--ds-accent-surface)]`
- Card border: `border-[var(--ds-accent-border)]`
- Card header bg: `bg-[var(--ds-accent-surface)]`

- [ ] **Step 5: Commit**

```bash
git add apps/cockpit/src/components/
git commit -m "feat(cockpit): update content surfaces for light theme"
```

---

### Task 5: Update Shiki theme and fix tests

**Files:**
- Modify: `apps/cockpit/src/lib/content-bundle.ts`
- Modify: `apps/cockpit/src/lib/render-markdown.ts`
- Modify: Various test files

- [ ] **Step 1: Change Shiki theme from github-dark to tokyo-night**

In `content-bundle.ts`, replace `theme: 'github-dark'` with `theme: 'tokyo-night'`.
In `render-markdown.ts`, replace `theme: 'github-dark'` with `theme: 'tokyo-night'`.

- [ ] **Step 2: Run full test suite and fix failures**

Run: `npx nx test cockpit -- --run --reporter=verbose`

Fix any failures caused by:
- Tests asserting on dark-theme CSS classes that changed
- Tests checking for specific color values

- [ ] **Step 3: Commit**

```bash
git add apps/cockpit/src/
git commit -m "feat(cockpit): switch Shiki to tokyo-night theme and fix tests"
```

---

### Task 6: Cleanup and remove unused deps

**Files:**
- Modify: `apps/cockpit/package.json`
- Delete: `apps/cockpit/components.json` (shadcn config, no longer needed)

- [ ] **Step 1: Remove @radix-ui/react-dialog from package.json**

The Sheet component was already removed. `@radix-ui/react-dialog` is no longer imported anywhere. Remove it.

Keep `@radix-ui/react-tabs` (still used by mode switcher) and `@radix-ui/react-slot` (still used by button).

- [ ] **Step 2: Delete components.json if it exists**

```bash
rm apps/cockpit/components.json 2>/dev/null
```

- [ ] **Step 3: Commit**

```bash
git add apps/cockpit/package.json
git add -A apps/cockpit/components.json
git commit -m "chore(cockpit): remove unused shadcn deps and config"
```

---

### Task 7: Visual verification and push

- [ ] **Step 1: Restart dev server and verify at 1440x900**

Check all four modes:
- **Run**: Light background, glass workspace, dark iframe content
- **Code**: Light tab bar, dark code blocks (tokyo-night), glass separators
- **Docs**: Light prose, blue accent callouts, dark code blocks, purple prompt block
- **API**: Light cards with blue accent headers

Check sidebar:
- Glass treatment
- Light text
- Blue active state

- [ ] **Step 2: Push**

```bash
git push
```
