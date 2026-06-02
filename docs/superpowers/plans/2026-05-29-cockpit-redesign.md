# Cockpit Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reskin the cockpit app as a branded dark console whose palette and surfaces align with the `@threadplane/chat` library, and clean up the Code / Docs / API content modes to match the marketing website.

**Architecture:** Pure `apps/cockpit` (Next.js, Tailwind v4) change. Consume the existing chat-aligned dark tokens from `@threadplane/design-tokens`, remove hardcoded color literals, add a brand logo lockup, load the brand webfonts, and consolidate the two divergent code-block treatments onto the existing `.doc-codeblock` CSS classes (made theme-aware). Light mode and the `ThemedFrame`→iframe theme handshake are preserved unchanged.

**Tech Stack:** Next.js 16, React, Tailwind v4 (CSS-based, no config file), Radix Tabs, Shiki (Tokyo Night), Vitest + jsdom (tests use `createRoot`/`act`, not testing-library), `next/font/google`.

**Spec:** `docs/superpowers/specs/2026-05-29-cockpit-redesign-design.md`

**Conventions:**
- Tests follow the existing harness style (see `apps/cockpit/src/components/code-mode/code-mode.spec.tsx`): `createRoot`, `act`, query the DOM, no `@testing-library`.
- Run a single test file with: `npx nx test cockpit -- <relative-spec-path>` (or `npx vitest run <path>` from repo root — confirm which the repo uses by checking `apps/cockpit/project.json` `test` target).
- Commit after each task.

---

## File map

| File | Change |
|------|--------|
| `apps/cockpit/src/app/layout.tsx` | Load Inter / JetBrains Mono / EB Garamond via `next/font`, expose `--font-inter` `--font-mono` `--font-garamond` on `<html>`. |
| `apps/cockpit/src/components/branding/logo.tsx` | **NEW** — Threadplane logo lockup (🛩️ + serif wordmark + mono `cockpit`). |
| `apps/cockpit/src/components/branding/logo.spec.tsx` | **NEW** — test. |
| `apps/cockpit/src/components/sidebar/cockpit-sidebar.tsx` | Replace bare "Cockpit" text with `<Logo />`. |
| `apps/cockpit/src/components/cockpit-shell.tsx` | Remove the capability-title `<h2>` and `|` divider from the header. |
| `apps/cockpit/src/app/cockpit.css` | Make `.doc-codeblock` header theme-aware (tokens, not hardcoded); ensure code body `overflow-x`; add consolidated `.cockpit-prose` class. |
| `apps/cockpit/src/components/code-mode/code-mode.tsx` | Render the shared `.doc-codeblock` markup with a **short filename** (not full path); drop inline hardcoded colors. |
| `apps/cockpit/src/components/code-mode/code-mode.spec.tsx` | Update header assertion to short filename. |
| `apps/cockpit/src/components/narrative-docs/narrative-docs.tsx` | Replace the long `[&_h1]:…` chains with `className="cockpit-prose"`. |
| `apps/cockpit/src/components/api-mode/api-mode.tsx` | Wrap in `.cockpit-prose`; render params as a responsive `<table>`; signatures in shared code style; drop hardcoded colors. |
| `apps/cockpit/src/components/api-mode/api-mode.spec.tsx` | Add assertion for table markup. |

---

## Task 1: Load brand webfonts

**Files:**
- Modify: `apps/cockpit/src/app/layout.tsx`

The cockpit currently loads none of the brand fonts, so mono labels fall back to system mono and serif docs headings fall back to Georgia. Mirror `apps/website/src/app/layout.tsx`.

- [ ] **Step 1: Add the font imports and variables**

At the top of `apps/cockpit/src/app/layout.tsx`, after the existing imports add:

```tsx
import { EB_Garamond, Inter, JetBrains_Mono } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });
const garamond = EB_Garamond({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-garamond', display: 'swap' });
```

- [ ] **Step 2: Apply the variables to `<html>`**

Change the `<html>` open tag to include the font variable classes alongside the existing `data-theme` and `style`:

```tsx
<html
  lang="en"
  data-theme={theme}
  className={`${inter.variable} ${mono.variable} ${garamond.variable}`}
  style={cssVars(theme) as React.CSSProperties}
>
```

- [ ] **Step 3: Verify existing tests still pass**

Run: `npx nx test cockpit`
Expected: PASS (no behavioral change; layout has no spec that asserts fonts).

- [ ] **Step 4: Browser verify**

Run `npx nx serve cockpit`, open `http://localhost:4201/deep-agents/core-capabilities/planning/overview/python`, switch to Docs mode. Sidebar section labels render in JetBrains Mono; docs `h1/h2/h3` render in EB Garamond (serif), not Georgia.

- [ ] **Step 5: Commit**

```bash
git add apps/cockpit/src/app/layout.tsx
git commit -m "feat(cockpit): load brand webfonts (Inter, JetBrains Mono, EB Garamond)"
```

---

## Task 2: Logo lockup component

**Files:**
- Create: `apps/cockpit/src/components/branding/logo.tsx`
- Test: `apps/cockpit/src/components/branding/logo.spec.tsx`

Mirrors `apps/website/src/components/ui/LogoMark.tsx` but uses theme tokens (`var(--ds-text-primary)`) so it adapts to light/dark, and adds a mono `cockpit` qualifier.

- [ ] **Step 1: Write the failing test**

```tsx
/** @vitest-environment jsdom */
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { Logo } from './logo';

describe('Logo', () => {
  let container: HTMLDivElement | undefined;
  let root: ReturnType<typeof createRoot> | undefined;

  afterEach(() => {
    act(() => { root?.unmount(); });
    container?.remove();
  });

  it('renders the Threadplane wordmark and the cockpit qualifier', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => { root!.render(<Logo />); });

    expect(container.textContent).toContain('Threadplane');
    expect(container.textContent).toContain('cockpit');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test cockpit -- src/components/branding/logo.spec.tsx`
Expected: FAIL — cannot resolve `./logo`.

- [ ] **Step 3: Write the component**

```tsx
import type { HTMLAttributes } from 'react';

export function Logo({ className, style, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      data-ui="cockpit-logo"
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 8, lineHeight: 1, ...style }}
      {...rest}
    >
      <span aria-hidden="true" style={{ fontSize: 20, lineHeight: 1 }}>🛩️</span>
      <span style={{ fontFamily: 'var(--font-garamond), "EB Garamond", Georgia, serif', fontSize: 16, fontWeight: 600, color: 'var(--ds-text-primary)' }}>
        Threadplane
      </span>
      <span style={{ fontFamily: 'var(--font-mono), "JetBrains Mono", monospace', fontSize: 12, color: 'var(--ds-text-muted)' }}>
        cockpit
      </span>
    </span>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx nx test cockpit -- src/components/branding/logo.spec.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/cockpit/src/components/branding/logo.tsx apps/cockpit/src/components/branding/logo.spec.tsx
git commit -m "feat(cockpit): add Threadplane logo lockup component"
```

---

## Task 3: Use the logo in the sidebar

**Files:**
- Modify: `apps/cockpit/src/components/sidebar/cockpit-sidebar.tsx`

- [ ] **Step 1: Import and swap the header text**

Add `import { Logo } from '../branding/logo';` to the imports. Replace the header `<p>…Cockpit…</p>` (lines ~31-34) so the header becomes:

```tsx
<header className="flex items-center justify-between px-4">
  <Logo />
  <LanguagePicker manifest={manifest} entry={entry} />
</header>
```

- [ ] **Step 2: Run sidebar tests**

Run: `npx nx test cockpit -- src/components/sidebar/cockpit-sidebar.spec.tsx`
Expected: PASS. If a test asserts the literal text `Cockpit` in the header, update it to assert `Threadplane`.

- [ ] **Step 3: Browser verify**

Reload the cockpit; the sidebar top shows the 🛩️ + "Threadplane" + mono "cockpit" lockup in both light and dark.

- [ ] **Step 4: Commit**

```bash
git add apps/cockpit/src/components/sidebar/cockpit-sidebar.tsx apps/cockpit/src/components/sidebar/cockpit-sidebar.spec.tsx
git commit -m "feat(cockpit): show Threadplane logo lockup in sidebar"
```

---

## Task 4: Remove the capability title from the header

**Files:**
- Modify: `apps/cockpit/src/components/cockpit-shell.tsx`

The header keeps the mono breadcrumb (`contextLabel`) and the mode switcher; the `entryTitle` prop stays (Run mode uses it for the iframe title, Code mode for fallbacks) but is no longer shown in the header.

- [ ] **Step 1: Remove the title markup**

In `cockpit-shell.tsx`, inside the header `<div className="flex items-center gap-3">`, delete these two lines:

```tsx
<span className="hidden md:block text-[var(--ds-accent-border)]">|</span>
<h2 className="text-sm font-medium text-[var(--ds-text-primary)]">{entryTitle}</h2>
```

Leave the `MenuIcon` button and the `contextLabel` `<p>` in place.

- [ ] **Step 2: Run pane-rendering tests**

Run: `npx nx test cockpit -- src/components/pane-rendering.spec.tsx`
Expected: PASS. (It passes `entryTitle` as a prop but does not assert the header `<h2>`; if any assertion checks the title text in the header, remove that assertion.)

- [ ] **Step 3: Browser verify**

Reload; the header shows only the breadcrumb on the left and Run/Code/Docs/API on the right — no large title.

- [ ] **Step 4: Commit**

```bash
git add apps/cockpit/src/components/cockpit-shell.tsx
git commit -m "refactor(cockpit): drop redundant capability title from header"
```

---

## Task 5: Make the shared code block theme-aware

**Files:**
- Modify: `apps/cockpit/src/app/cockpit.css`

`.doc-codeblock` is the canonical clean code block (filename + lang + Copy). Its header currently uses hardcoded colors that don't adapt to light mode. Move them to tokens and ensure the code body scrolls horizontally on its own.

- [ ] **Step 1: Replace the hardcoded header/copy colors**

In `cockpit.css`, update the `.doc-codeblock__*` rules so they read:

```css
.doc-codeblock__header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.75rem;
  border-bottom: 1px solid var(--ds-border);
  background: var(--ds-surface-tinted);
  font-size: 0.7rem;
}
.doc-codeblock__file { color: var(--ds-text-secondary); font-family: var(--font-mono), "JetBrains Mono", monospace; }
.doc-codeblock__lang {
  padding: 0.1rem 0.35rem;
  border-radius: 0.2rem;
  background: var(--ds-accent-surface);
  color: var(--ds-accent);
  font-size: 0.6rem;
  font-family: var(--font-mono), "JetBrains Mono", monospace;
}
.doc-codeblock__copy {
  margin-left: auto;
  padding: 0.1rem 0.5rem;
  border: 1px solid var(--ds-border);
  border-radius: 0.25rem;
  background: transparent;
  color: var(--ds-text-muted);
  cursor: pointer;
}
.doc-codeblock__copy:hover { color: var(--ds-text-primary); border-color: var(--ds-border-strong); }
```

Also change the existing `.doc-codeblock__file` line that read `color: #a9b1d6` (≈ line 116) — it is replaced by the rule above; delete the stale duplicate.

- [ ] **Step 2: Ensure the code body scrolls horizontally inside the block**

Confirm the `pre.shiki` rule keeps `overflow-x: auto` (it does, ~line 7). Add, after it:

```css
.doc-codeblock pre.shiki { margin: 0; border-radius: 0; }
.doc-codeblock { max-width: 100%; }
```

- [ ] **Step 3: Run markdown renderer tests**

Run: `npx nx test cockpit -- src/lib/render-markdown.spec.ts`
Expected: PASS (class names unchanged; only CSS values changed).

- [ ] **Step 4: Browser verify (both themes)**

In Docs mode, a fenced code block shows a token-colored header that adapts when you toggle the theme; long lines scroll inside the block, not the page.

- [ ] **Step 5: Commit**

```bash
git add apps/cockpit/src/app/cockpit.css
git commit -m "fix(cockpit): make shared code block theme-aware and contain overflow"
```

---

## Task 6: Code mode adopts the shared code block

**Files:**
- Modify: `apps/cockpit/src/components/code-mode/code-mode.tsx`
- Modify: `apps/cockpit/src/components/code-mode/code-mode.spec.tsx`

Replace the bespoke `.code-mode-block` (full path header, hardcoded `#a9b1d6`/`rgba(26,27,38,.95)`/`#4A527A`) with the shared `.doc-codeblock` markup, showing the **short filename**.

- [ ] **Step 1: Update the failing test first**

In `code-mode.spec.tsx`, the first test currently only checks `.shiki` and tab labels. Add an assertion that the block header shows the short filename (not the full path):

```tsx
const fileLabel = container.querySelector('.doc-codeblock__file');
expect(fileLabel?.textContent).toBe('page.tsx');
```

Add this right after the `expect(container.querySelector('.shiki')).not.toBeNull();` line in the first test.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test cockpit -- src/components/code-mode/code-mode.spec.tsx`
Expected: FAIL — `.doc-codeblock__file` not found (current markup uses `.code-mode-block` with the full path).

- [ ] **Step 3: Rewrite `CodeFileContent` to use the shared markup**

Replace the `CodeFileContent` function body in `code-mode.tsx` with:

```tsx
function CodeFileContent({
  path,
  content,
  capability,
}: {
  path: string;
  content: string | undefined;
  capability?: string;
}) {
  if (!content) {
    return <p className="text-sm text-[var(--ds-text-muted)]">No source available for {getTabLabel(path)}</p>;
  }

  const ext = (getTabLabel(path).split('.').pop() ?? '').toUpperCase();

  return (
    <div className="doc-codeblock">
      <div className="doc-codeblock__header">
        <span className="doc-codeblock__file">{getTabLabel(path)}</span>
        {ext ? <span className="doc-codeblock__lang">{ext}</span> : null}
        <button
          className="doc-codeblock__copy"
          aria-label={`Copy ${getTabLabel(path)}`}
          onClick={() => {
            track('cockpit:code_copied', { capability, surface: 'code_mode', file_path: path });
            const el = document.querySelector(`[data-code-path="${CSS.escape(path)}"] pre code`);
            if (el) navigator.clipboard.writeText(el.textContent ?? '');
          }}
        >Copy</button>
      </div>
      <div data-code-path={path} dangerouslySetInnerHTML={{ __html: content }} />
    </div>
  );
}
```

(Note: the `data-code-path` wrapper is kept so the existing Copy query selector still works.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx nx test cockpit -- src/components/code-mode/code-mode.spec.tsx`
Expected: PASS (short filename rendered; the Copy-tracking test still passes — `aria-label` and `track` call are unchanged).

- [ ] **Step 5: Browser verify**

Code mode shows a clean header (short filename + uppercase ext chip + legible Copy); long lines scroll inside the block; toggling the theme adapts the header.

- [ ] **Step 6: Commit**

```bash
git add apps/cockpit/src/components/code-mode/code-mode.tsx apps/cockpit/src/components/code-mode/code-mode.spec.tsx
git commit -m "refactor(cockpit): code mode uses shared theme-aware code block"
```

---

## Task 7: Consolidate docs prose

**Files:**
- Modify: `apps/cockpit/src/app/cockpit.css`
- Modify: `apps/cockpit/src/components/narrative-docs/narrative-docs.tsx`

Replace the long inline `[&_h1]:…` Tailwind chains with a single `.cockpit-prose` class that both Docs and API will use.

- [ ] **Step 1: Add the `.cockpit-prose` class to `cockpit.css`**

Append (and fold in the existing `.docs-article h1/h2/h3 { font-family: var(--ds-font-serif) }` rule, replacing it):

```css
/* Shared prose layer — docs + api */
.cockpit-prose {
  max-width: 42rem;
  font-size: 0.9rem;
  line-height: 1.7;
  color: var(--ds-text-secondary);
}
.cockpit-prose h1, .cockpit-prose h2, .cockpit-prose h3 {
  font-family: var(--font-garamond), var(--ds-font-serif);
  color: var(--ds-text-primary);
  letter-spacing: -0.01em;
}
.cockpit-prose h1 { font-size: 1.875rem; line-height: 1.1; margin: 0 0 0.5rem; padding-bottom: 0.75rem; border-bottom: 1px solid var(--ds-accent-border); }
.cockpit-prose h2 { font-size: 1.5rem; margin: 2.25rem 0 0.75rem; }
.cockpit-prose h3 { font-size: 1.25rem; margin: 1.5rem 0 0.5rem; }
.cockpit-prose p { margin: 0 0 0.75rem; }
.cockpit-prose ul { margin: 0 0 0.75rem; padding-left: 1.25rem; list-style: disc; }
.cockpit-prose li { margin-bottom: 0.25rem; }
.cockpit-prose a { color: var(--ds-accent); text-decoration: none; }
.cockpit-prose a:hover { text-decoration: underline; }
.cockpit-prose code { color: var(--ds-accent); background: var(--ds-accent-surface); padding: 0.1rem 0.3rem; border-radius: 0.25rem; font-size: 0.85em; font-family: var(--font-mono), "JetBrains Mono", monospace; }
.cockpit-prose strong { color: var(--ds-text-primary); font-weight: 600; }
```

- [ ] **Step 2: Use the class in `narrative-docs.tsx`**

Replace the long `className="docs-article …[&_h1]:…"` value on the `<article>` with just:

```tsx
className="cockpit-prose"
```

Keep `docs-article` too if any other CSS targets it: `className="docs-article cockpit-prose"`. Keep the `onClick` delegation and `dangerouslySetInnerHTML` unchanged.

- [ ] **Step 3: Run docs tests**

Run: `npx nx test cockpit -- src/components/narrative-docs/narrative-docs.spec.tsx`
Expected: PASS (markup/content unchanged; only class names).

- [ ] **Step 4: Browser verify (responsive + both themes)**

Docs mode renders a readable prose column with serif headings, the shared code block, and callouts. Resize to a narrow viewport: single column, no horizontal overflow.

- [ ] **Step 5: Commit**

```bash
git add apps/cockpit/src/app/cockpit.css apps/cockpit/src/components/narrative-docs/narrative-docs.tsx
git commit -m "refactor(cockpit): consolidate docs styling into shared .cockpit-prose"
```

---

## Task 8: API mode — prose container + responsive param table

**Files:**
- Modify: `apps/cockpit/src/components/api-mode/api-mode.tsx`
- Modify: `apps/cockpit/src/components/api-mode/api-mode.spec.tsx`

Wrap sections in `.cockpit-prose`, render signatures in the shared code style, and turn the cramped flex param rows into a responsive `<table>`. The existing spec asserts on text content (names/descriptions), which the table preserves.

- [ ] **Step 1: Add a table-markup assertion to the spec**

In `api-mode.spec.tsx`, after the existing `expect(html).toContain('The user message');` add:

```tsx
expect(html).toContain('<table');
expect(html).toContain('Parameter');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test cockpit -- src/components/api-mode/api-mode.spec.tsx`
Expected: FAIL — no `<table>` in current markup.

- [ ] **Step 3: Refactor `DocArticle` to use a table and tokens**

Replace the params block inside `DocArticle` (the `section.params.length > 0` branch) with a table, and drop the inline-styled flex rows:

```tsx
{section.params.length > 0 ? (
  <div>
    <h5 className="text-xs font-mono uppercase tracking-wide mb-1.5" style={{ color: 'var(--ds-text-muted)' }}>
      Parameters
    </h5>
    <table className="params w-full text-sm">
      <thead>
        <tr>
          <th style={{ textAlign: 'left', color: 'var(--ds-text-muted)' }}>Parameter</th>
          <th style={{ textAlign: 'left', color: 'var(--ds-text-muted)' }}>Description</th>
        </tr>
      </thead>
      <tbody>
        {section.params.map((param) => (
          <tr key={param.name}>
            <td style={{ verticalAlign: 'top', paddingRight: '1rem' }}>
              <code className="px-1 py-0.5 rounded text-xs font-mono" style={{ background: 'var(--ds-accent-surface)', color: 'var(--ds-accent)' }}>
                {param.name}
              </code>
            </td>
            <td style={{ verticalAlign: 'top', color: 'var(--ds-text-muted)' }}>
              {renderInlineCode(param.description)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
) : null}
```

Then wrap the outer `<section aria-label="API mode" …>` content in a prose container by adding `className="cockpit-prose"` to a wrapping `<div>` around the language groups (keep the `section` for the scroll container):

```tsx
<section aria-label="API mode" className="h-full overflow-auto py-4 px-4 md:px-8">
  <div className="cockpit-prose" style={{ maxWidth: '48rem' }}>
    {/* existing tsSections / pySections blocks */}
  </div>
</section>
```

- [ ] **Step 4: Add minimal table CSS**

In `cockpit.css`, append:

```css
.cockpit-prose table.params { border-collapse: collapse; margin: 0.5rem 0; }
.cockpit-prose table.params th { font-family: var(--font-mono), monospace; font-size: 0.6rem; letter-spacing: 0.06em; text-transform: uppercase; padding-bottom: 0.5rem; border-bottom: 1px solid var(--ds-border); }
.cockpit-prose table.params td { padding: 0.5rem 0.75rem 0.5rem 0; border-bottom: 1px solid var(--ds-border); }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx nx test cockpit -- src/components/api-mode/api-mode.spec.tsx`
Expected: PASS.

- [ ] **Step 6: Browser verify (responsive)**

API mode shows a prose column; params render as a table; on a narrow viewport the section scrolls without breaking layout.

- [ ] **Step 7: Commit**

```bash
git add apps/cockpit/src/components/api-mode/api-mode.tsx apps/cockpit/src/components/api-mode/api-mode.spec.tsx apps/cockpit/src/app/cockpit.css
git commit -m "refactor(cockpit): API mode prose container + responsive param table"
```

---

## Task 9: Full cross-theme verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full cockpit test suite**

Run: `npx nx test cockpit`
Expected: PASS (all specs green).

- [ ] **Step 2: Run lint/typecheck**

Run: `npx nx lint cockpit && npx nx typecheck cockpit` (use whichever targets exist in `apps/cockpit/project.json`).
Expected: PASS.

- [ ] **Step 3: Manual browser pass (light + dark)**

Serve cockpit, visit `deep-agents/core-capabilities/planning`. For BOTH themes (toggle in sidebar):
- Chrome: logo lockup present, no capability title, single sky-blue (`#64C3FD`) accent, mono labels in JetBrains Mono.
- Run mode: the embedded chat demo follows the host theme (postMessage handshake intact — verify by toggling and watching the iframe).
- Code mode: clean header, in-block horizontal scroll, header adapts to theme.
- Docs mode: prose column, serif headings, responsive at narrow width.
- API mode: prose container, responsive param table.

- [ ] **Step 4: Final commit (if any verification fixups were needed)**

```bash
git add -A && git commit -m "chore(cockpit): redesign verification fixups"
```

---

## Self-review notes

- **Spec coverage:** shell/branding (T2–T4), fonts (T1), code mode unify + overflow (T5–T6), docs prose (T7), API prose+table (T8), light-mode preserved (verified T9 step 3). All five spec work areas covered.
- **Shared code block:** implemented as shared CSS (`.doc-codeblock`) rather than a new React component, because docs code blocks are produced server-side by `render-markdown.ts` while Code mode is React — a shared CSS contract unifies both producers with the least churn and keeps `render-markdown.spec.ts` green.
- **Prose:** implemented as a `.cockpit-prose` CSS class, not `@tailwindcss/typography` (not installed; project is Tailwind v4 with no config). This avoids a new dependency and matches the existing hand-rolled pattern.
- **Risk — light mode:** Tasks 5 and 8 remove the last hardcoded color literals; T9 step 3 explicitly checks both themes including the iframe handshake.
