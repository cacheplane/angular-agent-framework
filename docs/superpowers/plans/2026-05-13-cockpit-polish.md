# Cockpit Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship cockpit polish — chat lib theme-attribute rename, cockpit.css hardcoded-color cleanup, border-pattern standardization on Tailwind arbitrary values, and revert of the in-flight `data-ngaf-chat-theme` shim in `installEmbeddedTheme`.

**Architecture:** The chat lib already implements a three-layer cascade (default → `prefers-color-scheme` → programmatic override) — rename only the override selector to `[data-theme]`. Cockpit's `cockpit.css` has dead `@theme inline` + shadcn alias blocks (no Tailwind utilities consume them); replace with direct `var(--ds-*)` references. Border styles standardize on Tailwind arbitrary-value classes (`border-b border-[var(--ds-border)]`).

**Tech Stack:** Tailwind v4, Angular 21, Vitest, Nx, npm workspaces.

**Spec:** `docs/superpowers/specs/2026-05-13-cockpit-polish-design.md`

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Modify | `libs/chat/src/lib/styles/chat-tokens.ts` | Rename `data-ngaf-chat-theme` → `data-theme` (4 selectors + 2 doc comments) |
| Modify | `libs/example-layouts/src/lib/install-embedded-theme.ts` | Remove `dataset.ngafChatTheme` line + comment (added in-flight, no longer needed) |
| Modify | `apps/cockpit/src/app/cockpit.css` | Drop `@theme inline` + shadcn alias block; replace 12 hardcoded rgba literals with `var(--ds-*)` |
| Modify | `apps/cockpit/src/components/cockpit-shell.tsx` | Border inline → Tailwind class (already keeps edge-to-edge padding fix from in-flight) |
| Modify | `apps/cockpit/src/components/mobile-nav-overlay.tsx` | Border inline → Tailwind class |
| Modify | `apps/cockpit/src/components/api-mode/api-mode.tsx` | `borderBottomColor` inline → Tailwind class |
| Modify | `apps/cockpit/src/components/sidebar/cockpit-sidebar.tsx` | `borderRightColor` inline → Tailwind class |
| Modify | `apps/cockpit/src/components/sidebar/navigation-groups.tsx` | `borderLeft` inline → conditional Tailwind class |
| Modify | `apps/cockpit/src/components/code-mode/code-mode.tsx` | Hardcoded `rgba(255,255,255,0.06)` → `var(--ds-border)` |
| Modify | `libs/chat/package.json` | Patch bump |
| Modify | `libs/example-layouts/package.json` | Patch bump |

---

## Task 1: Chat lib attribute rename

**Files:**
- Modify: `libs/chat/src/lib/styles/chat-tokens.ts`

The chat lib already has the right three-layer cascade — only the override selector needs renaming. Six instances of the literal string `data-ngaf-chat-theme` exist in the file (4 in CSS selectors, 2 in JSDoc comments).

- [ ] **Step 1: Read current file to confirm exact line content**

```bash
grep -n "data-ngaf-chat-theme" libs/chat/src/lib/styles/chat-tokens.ts
```

Expected output: six lines (175, 177, 190, 191, 192, 193).

- [ ] **Step 2: Rename the attribute everywhere in this file**

Use Edit's `replace_all` flag on the literal string `data-ngaf-chat-theme` → `data-theme`.

After the edit, the file should contain selectors:

```ts
:root[data-theme="light"],
[data-theme="light"] { ${LIGHT_TOKENS} }
:root[data-theme="dark"],
[data-theme="dark"] { ${DARK_TOKENS} }
```

And JSDoc references like `[data-theme="dark"]` and `[data-theme="light"]`.

- [ ] **Step 3: Verify no other files in the chat lib reference the old attribute**

```bash
rg "data-ngaf-chat-theme" libs/chat
```

Expected: no matches.

- [ ] **Step 4: Run chat lib tests**

```bash
pnpm nx test chat
```

Expected: all green. (No test currently asserts the old attribute string, so the rename should be invisible to tests. If a test does fail because it asserts the literal `data-ngaf-chat-theme`, update the assertion to `data-theme`.)

- [ ] **Step 5: Commit**

```bash
git add libs/chat/src/lib/styles/chat-tokens.ts
git commit -m "refactor(chat): rename theme attribute data-ngaf-chat-theme → data-theme"
```

---

## Task 2: Drop redundant `dataset.ngafChatTheme` in `installEmbeddedTheme`

**Files:**
- Modify: `libs/example-layouts/src/lib/install-embedded-theme.ts`

After Task 1's rename, the chat lib reads `data-theme` directly — no need to also set `data-ngaf-chat-theme`. Revert the in-flight change.

- [ ] **Step 1: Edit the file**

Open `libs/example-layouts/src/lib/install-embedded-theme.ts`. The current `apply` function (after the in-flight change) looks like:

```ts
const apply = (theme: Theme) => {
  document.documentElement.dataset.theme = theme;
  // @ngaf/chat keys its internal tokens off `data-ngaf-chat-theme`,
  // not `data-theme`. Set both so the chat lib flips alongside the
  // design-tokens palette.
  document.documentElement.dataset.ngafChatTheme = theme;
  const vars = cssVars(theme) as Record<string, string>;
  for (const [key, value] of Object.entries(vars)) {
    document.documentElement.style.setProperty(key, value);
  }
};
```

Remove the comment block and the `dataset.ngafChatTheme` line. Result:

```ts
const apply = (theme: Theme) => {
  document.documentElement.dataset.theme = theme;
  const vars = cssVars(theme) as Record<string, string>;
  for (const [key, value] of Object.entries(vars)) {
    document.documentElement.style.setProperty(key, value);
  }
};
```

Also update the docblock above the function. Current:

```ts
/**
 * Bootstraps an embedded example app's theme. Call once before the
 * framework (Angular, Vue, etc.) bootstraps.
 *
 * Behavior:
 *   1. Applies the default theme synchronously: sets `data-theme` and
 *      `data-ngaf-chat-theme` on `<html>` (the latter tells `@ngaf/chat`
 *      to use its matching dark/light token set), plus every `--ds-*`
 *      CSS variable on the same element.
 *   ...
```

Replace the relevant paragraph with:

```ts
/**
 * Bootstraps an embedded example app's theme. Call once before the
 * framework (Angular, Vue, etc.) bootstraps.
 *
 * Behavior:
 *   1. Applies the default theme synchronously: sets `data-theme` on
 *      `<html>` (which both `@ngaf/design-tokens`-aware code and
 *      `@ngaf/chat` honor) plus every `--ds-*` CSS variable on the
 *      same element.
 *   ...
```

- [ ] **Step 2: Run example-layouts tests**

```bash
pnpm nx test example-layouts
```

Expected: all green. The existing test asserts `data-theme` is set; it never asserted `data-ngaf-chat-theme`, so removing that line doesn't break the test surface.

- [ ] **Step 3: Commit**

```bash
git add libs/example-layouts/src/lib/install-embedded-theme.ts
git commit -m "refactor(example-layouts): drop redundant data-ngaf-chat-theme set"
```

---

## Task 3: Rewrite `cockpit.css` — drop dead aliases, migrate literals to tokens

**Files:**
- Modify: `apps/cockpit/src/app/cockpit.css`

Two things in this task:
- **Drop dead code**: the `@theme inline` block (lines 3-15) and the shadcn `:root` alias block (lines 17-30). Grep confirms no Tailwind utility in cockpit consumes `bg-background`, `bg-card`, `text-muted`, etc. — they're entirely unused.
- **Replace 12 hardcoded rgba literals** with `var(--ds-*)` tokens.

- [ ] **Step 1: Read the current file**

```bash
cat apps/cockpit/src/app/cockpit.css
```

Note the exact line numbers of `@theme inline` (around 3-15), `:root` block (17-30), and the rgba literals.

- [ ] **Step 2: Delete the `@theme inline` block and the `:root` shadcn alias block**

Replace the top of the file from `@import "tailwindcss";` through the end of the `:root` block:

```css
@import "tailwindcss";
```

The `@theme inline` block goes away (those `--color-*` vars had no consumers). The `:root` block with `--background`, `--foreground`, `--primary`, `--card`, `--muted`, `--border`, `--input`, `--ring` goes away (also no consumers).

- [ ] **Step 3: Replace `rgba(0, 64, 144, 0.04)` literals**

In `cockpit.css`, find lines containing `rgba(0, 64, 144, 0.04)` (callout backgrounds, two sites). Replace with `var(--ds-accent-surface)`.

- [ ] **Step 4: Replace `rgba(0, 64, 144, 0.06)` literal**

Find the line containing `rgba(0, 64, 144, 0.06)` (was the shadcn `--muted` alias — but if the alias block is gone, this literal may not appear anymore; verify with grep). If it does appear elsewhere, replace with `var(--ds-accent-surface)`.

- [ ] **Step 5: Replace `rgba(0, 64, 144, 0.08)` literal**

Find `rgba(0, 64, 144, 0.08)` (the bottom border around line 227). Replace with `var(--ds-accent-border)`.

- [ ] **Step 6: Replace `rgba(0, 64, 144, 0.12)` literals**

Find each `rgba(0, 64, 144, 0.12)` (callout borders, divider). Replace with `var(--ds-accent-border)`.

- [ ] **Step 7: Replace `rgba(0, 64, 144, 0.15)` literals**

Find each `rgba(0, 64, 144, 0.15)` (active state highlights, around lines 108 and 149). Replace with `var(--ds-accent-border)`.

- [ ] **Step 8: Replace the dark-assumed `rgba(26, 27, 38, 0.95)`**

Find the single occurrence of `rgba(26, 27, 38, 0.95)` (code-block header bg, around line 142). Replace with `var(--ds-surface)`.

- [ ] **Step 9: Verify no rgba literals remain**

```bash
grep -nE "rgba\(0, 64, 144|rgba\(26, 27, 38" apps/cockpit/src/app/cockpit.css
```

Expected: no matches.

- [ ] **Step 10: Verify no orphaned references to dropped shadcn aliases**

```bash
grep -nE "var\(--(background|foreground|primary|card|muted|border|input|ring)\)\b" apps/cockpit/src/app/cockpit.css
```

Expected: no matches. (If any remain — they referenced the now-deleted block — replace with appropriate `var(--ds-*)`. The bottom `border-bottom: 1px solid var(--border)` should become `border-bottom: 1px solid var(--ds-border)`.)

- [ ] **Step 11: Run cockpit build to confirm CSS still compiles**

```bash
pnpm nx build cockpit
```

Expected: clean build. Any unresolved CSS variable would surface as a build warning.

- [ ] **Step 12: Commit**

```bash
git add apps/cockpit/src/app/cockpit.css
git commit -m "refactor(cockpit): drop dead shadcn aliases, migrate hardcoded rgba to --ds-* tokens"
```

---

## Task 4: Migrate inline border styles to Tailwind arbitrary values

**Files:**
- Modify: `apps/cockpit/src/components/cockpit-shell.tsx`
- Modify: `apps/cockpit/src/components/mobile-nav-overlay.tsx`
- Modify: `apps/cockpit/src/components/api-mode/api-mode.tsx`
- Modify: `apps/cockpit/src/components/sidebar/cockpit-sidebar.tsx`
- Modify: `apps/cockpit/src/components/sidebar/navigation-groups.tsx`
- Modify: `apps/cockpit/src/components/code-mode/code-mode.tsx`

Six files have inline border styles. Migrate each to the Tailwind arbitrary-value pattern (`border-b border-[var(--ds-border)]`). Note that some preserve the in-flight padding fix in `cockpit-shell.tsx`.

- [ ] **Step 1: `cockpit-shell.tsx`**

Currently in the `<header>` element (around line 84):

```tsx
<header
  className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between px-4 py-3"
  style={{ borderBottom: '1px solid var(--ds-border)' }}
>
```

Replace with:

```tsx
<header
  className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between px-4 py-3 border-b border-[var(--ds-border)]"
>
```

(The `style={...}` prop and its contents go away. The `px-4 py-3` from the in-flight padding fix is preserved.)

- [ ] **Step 2: `mobile-nav-overlay.tsx`**

Find the line with `style={{ borderBottom: '1px solid var(--ds-border)' }}`. Migrate the same way: add `border-b border-[var(--ds-border)]` to the element's `className`, drop the `style` prop.

- [ ] **Step 3: `api-mode/api-mode.tsx`**

Find the line containing `borderBottomColor: 'var(--ds-accent-border)'`. The element likely has `style={{ borderBottom: '1px solid', borderBottomColor: '...' }}` or similar. Read context (3-5 lines before/after) to understand the full inline-style, then replace with:

```tsx
className="<existing> border-b border-[var(--ds-accent-border)]"
```

Drop the inline `borderBottom`/`borderBottomColor`/`borderBottomStyle` properties from `style={}`. If the only `style` prop entries were the border ones, drop the entire `style` prop.

- [ ] **Step 4: `sidebar/cockpit-sidebar.tsx`**

Find the line containing `borderRightColor: 'var(--ds-border-strong)'`. Read context — likely paired with `borderRight: '1px solid'` or similar. Replace inline with:

```tsx
className="<existing> border-r border-[var(--ds-border-strong)]"
```

- [ ] **Step 5: `sidebar/navigation-groups.tsx`**

Find the line containing `borderLeft: isActive ? '2px solid var(--ds-accent)' : 'none'`. This is a conditional pattern — needs to stay conditional. Replace with Tailwind classes via conditional:

```tsx
className={`<existing> ${isActive ? 'border-l-2 border-[var(--ds-accent)]' : 'border-l-2 border-transparent'}`}
```

The `border-l-2 border-transparent` on the inactive branch reserves the layout space so the active state doesn't shift the row. (If the existing inline style was using `2px` only on active and `none` on inactive, content shifts when active toggles. Preserving the transparent border keeps layout stable. Verify visually after edit.)

If the existing behavior was intentionally shifting on activation, omit the `border-transparent` and use empty string on the inactive branch.

- [ ] **Step 6: `code-mode/code-mode.tsx`**

Find the line `borderBottom: '1px solid rgba(255,255,255,0.06)'`. This is a dark-mode-assumed hardcoded color. Replace with token-driven Tailwind:

```tsx
className="<existing> border-b border-[var(--ds-border)]"
```

Drop the inline `borderBottom` from `style={}`. If `style` is now empty, drop it.

- [ ] **Step 7: Verify no inline border styles remain in cockpit components**

```bash
rg -g '*.tsx' "borderBottom|borderRight|borderTop|borderLeft" apps/cockpit/src/components
```

Expected: no matches.

- [ ] **Step 8: Run cockpit build**

```bash
pnpm nx build cockpit
```

Expected: clean build.

- [ ] **Step 9: Commit**

```bash
git add apps/cockpit/src/components
git commit -m "refactor(cockpit): migrate inline border styles to Tailwind arbitrary-value classes"
```

---

## Task 5: Version bumps + full check stack

**Files:**
- Modify: `libs/chat/package.json` (patch bump)
- Modify: `libs/example-layouts/package.json` (patch bump)

- [ ] **Step 1: Read current versions**

```bash
grep '"version"' libs/chat/package.json libs/example-layouts/package.json
```

- [ ] **Step 2: Bump patch versions**

Increment the last digit of each. Patch-only release rule applies — never bump to 0.1.x.

- [ ] **Step 3: Run the full check stack**

```bash
pnpm nx run-many -t lint,test -p design-tokens,ui-react,example-layouts,chat,cockpit
```

Expected: all green.

```bash
pnpm nx e2e cockpit
```

Expected: all green.

```bash
pnpm nx build website
```

Expected: green.

```bash
pnpm nx build cockpit-chat-timeline-angular
```

Expected: green.

If any failure surfaces:
- **Chat lib tests** — likely a test asserted the literal `data-ngaf-chat-theme` somewhere. Update assertion to `data-theme`.
- **Cockpit tests** — possibly a snapshot test or a CSS-class-presence test referencing the old `--muted` / `--border` aliases. Update the test to use `--ds-*` references.
- **Cockpit e2e** — if any test asserted a specific color value, it may shift slightly (alpha 0.04 → 0.06 etc.). Update the assertion to match the new computed color.
- **Cockpit build** — unresolved CSS var; grep cockpit.css to find which `var(--*)` reference doesn't resolve.

- [ ] **Step 4: Commit version bumps**

```bash
git add libs/chat/package.json libs/example-layouts/package.json
git commit -m "chore: bump chat and example-layouts patch versions"
```

---

## Task 6: Open PR + merge on green

- [ ] **Step 1: Push branch**

```bash
git push -u origin cockpit-polish
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --title "refactor(cockpit): polish — chat lib data-theme, token migration, border standardization" --body "$(cat <<'EOF'
## Summary

First in a three-PR sequence (spec: \`docs/superpowers/specs/2026-05-13-cockpit-polish-design.md\`).

- **Chat lib theme attribute rename:** \`[data-ngaf-chat-theme]\` → \`[data-theme]\`. Aligns with Tailwind v4 / shadcn / Storybook conventions. The lib's existing three-layer cascade (default → \`prefers-color-scheme\` → programmatic override) is preserved — only the override selector renames.
- **\`installEmbeddedTheme\` cleanup:** drop the in-flight \`dataset.ngafChatTheme\` set. After the chat lib rename, \`data-theme\` is sufficient.
- **\`cockpit.css\` token migration:** drop dead \`@theme inline\` block and unused shadcn alias \`:root\` block (no Tailwind utility in cockpit consumed them). Replace 12 hardcoded \`rgba(0, 64, 144, X)\` and \`rgba(26, 27, 38, 0.95)\` literals with \`--ds-*\` tokens — code blocks and callouts now theme correctly in light AND dark.
- **Border standardization:** migrate ~6 inline \`style={{ borderBottom: ... }}\` sites to Tailwind arbitrary-value classes (\`border-b border-[var(--ds-border)]\`). Consistent with cockpit's dominant Tailwind-arbitrary-value pattern.
- Preserves edge-to-edge content padding in \`cockpit-shell.tsx\` (from in-flight pre-spec change).

PR 2 (chat lib polish — text-wrap bug + bubble width handling) and PR 3 (cockpit ↔ website style alignment) follow.

## Test plan

- [x] \`pnpm nx run-many -t lint,test -p design-tokens,ui-react,example-layouts,chat,cockpit\` — green
- [x] \`pnpm nx e2e cockpit\` — green
- [x] \`pnpm nx build website\` — green
- [x] \`pnpm nx build cockpit-chat-timeline-angular\` — green
- [ ] Manual chrome MCP smoke: cockpit + timeline pilot in light + dark — no white callouts in dark, no dark code-block headers in light, chat input flips with host theme

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Wait for green CI**

```bash
gh pr checks --watch
```

- [ ] **Step 4: Squash-merge**

```bash
gh pr merge --squash --delete-branch
```

---

## Self-review

**Spec coverage:**
- ✅ Decision 1 (chat lib attribute rename) → Task 1
- ✅ Decision 2 (border/divider Tailwind convention) → Task 4
- ✅ Decision 3 (hardcoded color mapping) → Task 3
- ✅ Decision 4 (no backwards compat — drop shadcn aliases) → Task 3 (drop `@theme inline` + `:root` blocks)
- ✅ Decision 5 (installEmbeddedTheme cleanup) → Task 2

**Adjustments from spec during plan-prep exploration:**
1. **Bonus dead-code finding:** the `@theme inline` Tailwind v4 token block in `cockpit.css` is also unused — no `bg-background`/`bg-card`/`text-muted` utilities in cockpit source. Dropping the whole `@theme inline` block alongside the `:root` aliases (spec only mentioned the `:root` block, but plan extends the cleanup since they're paired and equally dead).
2. **`code-mode.tsx` has its own hardcoded color** — `rgba(255,255,255,0.06)` border. Not in spec's 12-literal count but discovered during plan-prep and added to Task 4 Step 6.
3. **Two more inline-border sites than spec estimated** — `api-mode.tsx` borderBottomColor and `navigation-groups.tsx` borderLeft (conditional). All covered in Task 4.

**Placeholder scan:** No "TBD" / "TODO". One conditional pattern in Task 4 Step 5 (the `border-transparent` for layout stability) is described with reasoning, not gestured at.

**Type consistency:** No new types. Attribute name `data-theme` consistent across Tasks 1 and 2. CSS var names `--ds-accent-surface`, `--ds-accent-border`, `--ds-border`, `--ds-border-strong`, `--ds-accent` consistent across Tasks 3 and 4.
