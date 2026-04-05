# Cockpit Code Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all Critical and Important issues from the cockpit code review: deduplicate code-mode rendering, wire `@cacheplane/design-tokens` via `cssVars`, replace deep relative imports with Nx aliases, clean up dead code and CSS, add missing accessibility attributes, and align docs typography with the website.

**Architecture:** Seven independent tasks that can mostly be executed in parallel. Task 1 (cssVars wiring) changes the CSS foundation but doesn't affect component code since all components already reference `var(--ds-*)`. Tasks 2-7 are all independent file-level fixes.

**Tech Stack:** TypeScript, React, `@cacheplane/design-tokens`, `@cacheplane/ui-react`, Tailwind, Vitest

---

## File Map

| Action | File | Change |
|--------|------|--------|
| Modify | `apps/cockpit/src/app/layout.tsx` | Wire `cssVars` from ui-react |
| Modify | `apps/cockpit/src/app/cockpit.css` | Remove manual `:root` token block, remove unused `@theme` vars |
| Modify | `apps/cockpit/src/components/code-mode/code-mode.tsx` | Extract shared `CodeFileTab`, fix copy button |
| Modify | `apps/cockpit/src/components/cockpit-shell.tsx` | Replace deep import, add aria-label to hamburger |
| Modify | `apps/cockpit/src/components/sidebar/cockpit-sidebar.tsx` | Replace deep import |
| Modify | `apps/cockpit/src/components/sidebar/navigation-groups.tsx` | Replace deep import, add aria-expanded |
| Modify | `apps/cockpit/src/components/sidebar/language-picker.tsx` | Replace deep import, fix aria-current, add Escape handler |
| Modify | `apps/cockpit/src/lib/route-resolution.ts` | Replace deep import |
| Modify | `apps/cockpit/src/lib/cockpit-page.ts` | Replace deep import, fix import ordering |
| Modify | `apps/cockpit/src/components/api-mode/api-mode.tsx` | Derive section labels from data |
| Modify | `apps/cockpit/src/components/narrative-docs/narrative-docs.tsx` | Add Garamond headings, align font sizes |
| Modify | `apps/cockpit/src/components/pane-rendering.spec.tsx` | Fix missing narrativeDocs |
| Delete | `apps/cockpit/src/components/language-switcher.tsx` | Dead code |
| Delete | `apps/cockpit/src/components/language-switcher.spec.tsx` | Dead test |
| Delete | `apps/cockpit/src/components/navigation/navigation-tree.tsx` | Dead code |

---

### Task 1: Wire cssVars from ui-react and clean up cockpit.css

**Files:**
- Modify: `apps/cockpit/src/app/layout.tsx`
- Modify: `apps/cockpit/src/app/cockpit.css`

- [ ] **Step 1: Update layout.tsx to apply cssVars**

Read `apps/cockpit/src/app/layout.tsx`. Import `cssVars` from `@cacheplane/ui-react` and spread it into the `<html>` element's style prop:

```tsx
import type { ReactNode } from 'react';
import { cssVars } from '@cacheplane/ui-react';
import './cockpit.css';

export const metadata = {
  title: 'Cockpit',
  description: 'Integrated cockpit for manifest-driven developer reference demos.',
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" style={cssVars as React.CSSProperties}>
      <body
        className="min-h-screen font-sans antialiased"
        style={{
          background: 'var(--ds-gradient-bg-flow)',
          color: 'var(--ds-text-primary)',
        }}
      >
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Strip the manual `:root` tokens and unused `@theme` block from cockpit.css**

Read `apps/cockpit/src/app/cockpit.css`. Remove:
- The `@theme { --color-ds-* }` block (lines 3-15) — these vars are unused
- The `@theme inline { }` block (lines 17-26) — shadcn semantic vars, keep only if Tailwind references them
- The `:root { --ds-* }` block (lines 28-74) — now provided by `cssVars` on `<html>`
- The `:root { --background through --ring }` shadcn vars (lines 62-73) — keep these since Tailwind's `@theme inline` references them

Actually, the simplest approach: keep the `@theme inline` block and the shadcn semantic vars in `:root`, but remove the `--ds-*` custom properties since they come from `cssVars`. Also remove the unused `@theme { --color-ds-* }` block.

The resulting CSS should be:
```css
@import "tailwindcss";

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
}

:root {
  /* shadcn semantic vars for Tailwind utilities */
  --background: #f8f9fc;
  --foreground: #1a1a2e;
  --primary: #004090;
  --primary-foreground: #ffffff;
  --card: rgba(255, 255, 255, 0.45);
  --card-foreground: #1a1a2e;
  --muted: rgba(0, 64, 144, 0.06);
  --muted-foreground: #555770;
  --border: rgba(0, 64, 144, 0.15);
  --input: rgba(0, 64, 144, 0.15);
  --ring: #004090;
}

/* Everything below (Shiki, doc components) stays unchanged */
```

- [ ] **Step 3: Run tests**

Run: `npx nx test cockpit -- --run`
Expected: ALL PASS (components reference `var(--ds-*)` which are now set by cssVars on `<html>`)

- [ ] **Step 4: Commit**

```bash
git add apps/cockpit/src/app/
git commit -m "refactor(cockpit): wire cssVars from ui-react, remove manual token definitions"
```

---

### Task 2: Extract shared CodeFileTab and fix copy button

**Files:**
- Modify: `apps/cockpit/src/components/code-mode/code-mode.tsx`

- [ ] **Step 1: Extract a CodeFileTab component**

Read the current file. The `codeAssetPaths` and `backendAssetPaths` loops render identical code (45 lines each). Extract a `CodeFileContent` component:

```tsx
function CodeFileContent({ path, content }: { path: string; content: string | undefined }) {
  if (!content) {
    return <p className="text-sm text-[var(--ds-text-muted)]">No source available for {getTabLabel(path)}</p>;
  }

  return (
    <div className="code-mode-block" style={{
      borderRadius: 8,
      border: '1px solid var(--ds-glass-border)',
      boxShadow: 'var(--ds-glass-shadow)',
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '6px 12px',
        background: 'rgba(26, 27, 38, 0.95)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <span style={{ fontFamily: 'var(--ds-font-mono)', fontSize: '0.7rem', color: '#a9b1d6' }}>{path}</span>
        <button
          aria-label={`Copy ${getTabLabel(path)}`}
          onClick={() => {
            const el = document.querySelector(`[data-code-path="${CSS.escape(path)}"] pre code`);
            if (el) navigator.clipboard.writeText(el.textContent ?? '');
          }}
          style={{
            padding: '2px 8px',
            borderRadius: 4,
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'transparent',
            color: '#4A527A',
            fontSize: '0.65rem',
            cursor: 'pointer',
          }}
        >Copy</button>
      </div>
      <div data-code-path={path} dangerouslySetInnerHTML={{ __html: content }} />
    </div>
  );
}
```

Then both loops become:
```tsx
{[...codeAssetPaths, ...backendAssetPaths].map((path) => (
  <TabsContent key={path} value={path} className="flex-1 overflow-auto mt-4">
    <CodeFileContent path={path} content={codeFiles[path]} />
  </TabsContent>
))}
```

- [ ] **Step 2: Commit**

```bash
git add apps/cockpit/src/components/code-mode/code-mode.tsx
git commit -m "refactor(cockpit): extract CodeFileContent, deduplicate code block rendering"
```

---

### Task 3: Replace all deep relative imports with Nx aliases

**Files:**
- Modify: 6 files in `apps/cockpit/src/`

- [ ] **Step 1: Replace all `../../../../libs/cockpit-registry/src/index` and `../../../../../libs/cockpit-registry/src/index` with `@cacheplane/cockpit-registry`**

Files to update:
- `apps/cockpit/src/components/cockpit-shell.tsx`
- `apps/cockpit/src/components/sidebar/cockpit-sidebar.tsx`
- `apps/cockpit/src/components/sidebar/navigation-groups.tsx`
- `apps/cockpit/src/components/sidebar/language-picker.tsx` (two imports)
- `apps/cockpit/src/lib/route-resolution.ts`
- `apps/cockpit/src/lib/cockpit-page.ts`

Use sed:
```bash
find apps/cockpit/src -name '*.tsx' -o -name '*.ts' | xargs grep -l "libs/cockpit-registry" | xargs sed -i '' "s|from '[^']*libs/cockpit-registry/src/index'|from '@cacheplane/cockpit-registry'|g"
```

Also need to add `@cacheplane/cockpit-registry` to the cockpit's `tsconfig.json` paths (it uses `baseUrl: "."` which overrides the base paths).

- [ ] **Step 2: Add cockpit-registry path alias to cockpit tsconfig.json**

Add to `apps/cockpit/tsconfig.json` paths:
```json
"@cacheplane/cockpit-registry": ["../../libs/cockpit-registry/src/index.ts"]
```

- [ ] **Step 3: Fix cockpit-page.ts import ordering**

Move the `export { cockpitManifest }` after all imports.

- [ ] **Step 4: Run tests**

Run: `npx nx test cockpit -- --run`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add apps/cockpit/src/ apps/cockpit/tsconfig.json
git commit -m "refactor(cockpit): replace deep relative imports with @cacheplane/cockpit-registry alias"
```

---

### Task 4: Fix accessibility — aria labels, keyboard handlers

**Files:**
- Modify: `apps/cockpit/src/components/cockpit-shell.tsx` (hamburger aria-label)
- Modify: `apps/cockpit/src/components/sidebar/navigation-groups.tsx` (aria-expanded on collapse)
- Modify: `apps/cockpit/src/components/sidebar/language-picker.tsx` (aria-current, Escape key)

- [ ] **Step 1: Add aria-label to hamburger button in cockpit-shell.tsx**

Find the hamburger `<button className="md:hidden"` and add:
```tsx
aria-label={isSidebarOpen ? 'Close navigation' : 'Open navigation'}
aria-expanded={isSidebarOpen}
```

Also add `aria-hidden="true"` to the `MenuIcon` SVG.

- [ ] **Step 2: Add aria-expanded to collapse buttons in navigation-groups.tsx**

On the product group toggle button, add:
```tsx
aria-expanded={open}
aria-label={`${open ? 'Collapse' : 'Expand'} ${label}`}
```

- [ ] **Step 3: Fix language-picker.tsx — aria-current and Escape key**

Change `aria-current={isActive ? 'true' : undefined}` to `aria-current={isActive ? 'page' : undefined}`.

Add Escape key handler to the existing `useEffect`:
```tsx
const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') setIsOpen(false);
};
document.addEventListener('keydown', handleKeyDown);
return () => {
  document.removeEventListener('mousedown', handleClick);
  document.removeEventListener('keydown', handleKeyDown);
};
```

- [ ] **Step 4: Commit**

```bash
git add apps/cockpit/src/components/
git commit -m "fix(cockpit): accessibility — aria-labels, aria-expanded, Escape key handlers"
```

---

### Task 5: Align docs typography with website (Garamond headings)

**Files:**
- Modify: `apps/cockpit/src/components/narrative-docs/narrative-docs.tsx`

- [ ] **Step 1: Update heading styles to use Garamond serif font**

In the article className, update heading selectors:
- `[&_h1]:text-xl` → `[&_h1]:text-[1.875rem]` (matches website `h1: 1.875rem`)
- Add `[&_h1]:font-[var(--ds-font-serif)]`
- `[&_h2]:text-lg` → `[&_h2]:text-[1.5rem]`
- Add `[&_h2]:font-[var(--ds-font-serif)]`
- `[&_h3]:text-base` → `[&_h3]:text-[1.25rem]`
- Add `[&_h3]:font-[var(--ds-font-serif)]`

- [ ] **Step 2: Commit**

```bash
git add apps/cockpit/src/components/narrative-docs/narrative-docs.tsx
git commit -m "fix(cockpit): align docs typography with website — Garamond headings, matching sizes"
```

---

### Task 6: Fix API mode labels + fix test fixtures

**Files:**
- Modify: `apps/cockpit/src/components/api-mode/api-mode.tsx`
- Modify: `apps/cockpit/src/components/pane-rendering.spec.tsx`

- [ ] **Step 1: Derive section labels from source file extensions instead of hardcoded "Angular"/"LangGraph"**

Replace the hardcoded `<h3>Angular</h3>` / `<h3>LangGraph</h3>` with labels derived from the section's language:

```tsx
const languageLabels: Record<string, string> = {
  typescript: 'TypeScript',
  python: 'Python',
};
```

Then: `<h3>{languageLabels[tsSections[0]?.language] ?? 'TypeScript'}</h3>`

- [ ] **Step 2: Fix pane-rendering.spec.tsx — add narrativeDocs**

Add `narrativeDocs: []` to all `contentBundle` objects in `pane-rendering.spec.tsx`.

- [ ] **Step 3: Run tests**

Run: `npx nx test cockpit -- --run`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add apps/cockpit/src/components/api-mode/ apps/cockpit/src/components/pane-rendering.spec.tsx
git commit -m "fix(cockpit): derive API section labels from data, fix test fixture"
```

---

### Task 7: Delete dead code and clean up unused @theme

**Files:**
- Delete: `apps/cockpit/src/components/language-switcher.tsx`
- Delete: `apps/cockpit/src/components/language-switcher.spec.tsx`
- Delete: `apps/cockpit/src/components/navigation/navigation-tree.tsx`

- [ ] **Step 1: Delete dead files**

```bash
rm apps/cockpit/src/components/language-switcher.tsx
rm apps/cockpit/src/components/language-switcher.spec.tsx
rm apps/cockpit/src/components/navigation/navigation-tree.tsx
rmdir apps/cockpit/src/components/navigation/ 2>/dev/null
```

- [ ] **Step 2: Run tests to verify nothing breaks**

Run: `npx nx test cockpit -- --run`
Expected: Test count drops by 2 (the dead language-switcher tests), all remaining pass

- [ ] **Step 3: Commit**

```bash
git add -A apps/cockpit/src/components/language-switcher.tsx apps/cockpit/src/components/language-switcher.spec.tsx apps/cockpit/src/components/navigation/
git commit -m "chore(cockpit): remove dead components (LanguageSwitcher, NavigationTree)"
```

---

### Task 8: Run full test suite, build, and push

- [ ] **Step 1: Run full test suite**

Run: `npx nx test cockpit -- --run --reporter=verbose`
Expected: ALL PASS

- [ ] **Step 2: Build cockpit**

Run: `npx nx build cockpit --skip-nx-cache`
Expected: SUCCESS

- [ ] **Step 3: Push**

```bash
git push
```
