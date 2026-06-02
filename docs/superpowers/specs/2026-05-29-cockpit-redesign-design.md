# Cockpit Redesign — Branded Dark Console, Chat-Aligned

**Date:** 2026-05-29
**Status:** Design — pending review
**Scope:** `apps/cockpit` (Next.js). No changes to `libs/chat`, the example graphs, or the marketing site beyond what is needed to share fonts/tokens.

## Goal

Redesign the cockpit web app so it (1) reads as a branded member of the Threadplane family, (2) aligns its palette and surfaces with the **chat library** so the embedded demo and the surrounding chrome form one seamless surface, and (3) presents Code / Docs / API content with the same polish as the marketing website.

This is a **reskin + layout cleanup of the cockpit chrome and content modes**, not a re-architecture. The route resolution, manifest, mode-switching, and iframe runtime model stay as they are.

## Direction (validated)

Chosen direction: **Branded Dark Console** (keep the dark, focused, "Linear-style" app feel; add the missing brand layer). Rejected: a light editorial reskin (pulls toward the marketing voice, away from the chat library) and a per-product accent scheme (weakens shell↔demo cohesion).

Locked decisions from brainstorming:

- **Dark-first, single accent.** One accent — the chat library's sky-blue `#64C3FD` — everywhere: section labels, active states, links, and the demo's own accent. No per-product accent colors in the sidebar.
- **Sans chrome, no capability title.** The cockpit chrome stays sans-serif (Inter). The current small capability-title `<h2>` in the header is **removed** entirely; the breadcrumb carries context.
- **Serif stays in docs only.** EB Garamond remains the heading face for narrative-docs articles (website alignment), and is *not* introduced into the chrome.
- **Light mode is preserved** and continues to propagate into the example iframe via the existing `ThemedFrame` → `useEmbeddedTheme()` postMessage handshake. Nothing about that mechanism changes.

## Palette & tokens (already defined, apply consistently)

The design system already encodes a chat-aligned dark theme in `libs/design-tokens`. The redesign **consumes these tokens** rather than introducing new colors, and removes hardcoded color literals from cockpit components.

| Role | Token | Value (dark) |
|------|-------|--------------|
| Canvas | `--ds-canvas` | `rgb(17,17,17)` |
| Surface | `--ds-surface` | `rgb(28,28,28)` |
| Surface tinted | `--ds-surface-tinted` | `rgb(44,44,44)` |
| Border | `--ds-border` | `rgb(45,45,45)` |
| Text primary / secondary / muted | `--ds-text-*` | `#f5f5f5` / `#c8c8c8` / `#a0a0a0` |
| Accent | `--ds-accent` | `#64C3FD` |

Code-body syntax colors (Tokyo Night `#1a1b26` bg / `#a9b1d6` fg, JetBrains Mono 13px) already match the website's Shiki output and stay as-is in **both** themes. Only the code-block *chrome* (header bar) becomes theme-aware.

## Work areas

### 1. Shell chrome & branding — `cockpit-shell.tsx`, `cockpit-sidebar.tsx`

- **Header (`cockpit-shell.tsx`):** remove the `entryTitle` `<h2>` and the `|` divider. Keep the breadcrumb (`contextLabel`, mono, muted) on the left and the `ModeSwitcher` on the right. The header becomes a thin context+controls bar.
- **Brand lockup (`cockpit-sidebar.tsx`):** replace the bare mono `Cockpit` text with a Threadplane logo lockup — the bird mark + "Threadplane" wordmark and a mono `cockpit` qualifier. Reuse the website's logo asset. The `LanguagePicker` stays to its right.
- **Tokens:** ensure shell/sidebar use `--ds-*` tokens throughout (already mostly true). The existing `ThemeToggle` at the sidebar foot stays.

### 2. Fonts — `apps/cockpit/src/app/layout.tsx`

- Load **Inter, JetBrains Mono, EB Garamond** via `next/font/google`, exposing `--font-inter`, `--font-mono`, `--font-garamond` on `<html>` — mirroring `apps/website/src/app/layout.tsx`. Today the cockpit loads none of these, so mono labels and serif docs headings fall back to system fonts. This makes the design tokens' font families actually render and matches the website.

### 3. Code mode — `code-mode/code-mode.tsx`, new shared code-block component, `cockpit.css`

- **Unify code-block chrome.** Create one shared code-block component used by **both** Code mode and narrative docs, replacing the divergent `.code-mode-block` (inline hardcoded `#a9b1d6` / `rgba(26,27,38,.95)` / `#4A527A`) and `.doc-codeblock` treatments.
- **Header:** short **filename only** (not the full repo path), a small language chip (`TS` / `PY` / `MD`), and a legible Copy button. Colors from tokens, so the header adapts to light/dark; the code body stays Tokyo Night in both.
- **Overflow fix:** the code **body** owns `overflow-x: auto` (long lines scroll inside the block); the mode pane owns vertical scroll. Long filenames truncate with ellipsis. This resolves the "overflow is not correct" issue where long lines widened the whole pane.
- **De-clutter:** tab strip shows filenames with the active tab underlined in `--ds-accent`; prompt files (`.md`) keep the accent tint they have today.

### 4. Docs mode — `narrative-docs/narrative-docs.tsx`, `cockpit.css`

- Replace the long inline `[&_h1]:…` arbitrary-variant chains with a shared **`prose` layer** (Tailwind Typography, `prose-invert` in dark) tuned to the website's article styling: ~42rem measure, serif `h1/h2/h3` (kept), Inter body, accent links, inline code in accent tint.
- Use the **shared code-block component** for fenced code; keep the existing callout / step / summary doc components, mapping their colors to tokens.
- Fully responsive single column with comfortable padding on mobile.

### 5. API mode — `api-mode/api-mode.tsx`

- Move into the **same prose container** as Docs for consistent measure and rhythm.
- Render signatures in the shared code-block style.
- Replace the cramped flex param rows with a real **responsive table** (Parameter / Type / Description). Keep grouping by language (TypeScript / Python) with a mono language label.

## Out of scope

- The empty-state content gaps ("No runtime available", "No documentation available") — these are content/runtime issues, not redesign. The redesign only restyles the empty-state messages to match.
- Any change to `libs/chat`, the example Angular apps, or the LangGraph graphs.
- Marketing website changes (other than reusing its logo asset and font setup as references).
- Information architecture / navigation restructuring.

## Risks & notes

- **Shared code-block component** is the only genuinely new abstraction; it must serve both server-highlighted HTML (Shiki, via `dangerouslySetInnerHTML`) in Code mode and fenced blocks inside markdown docs. Keep its API minimal: `{ filename, lang, html | children }`.
- **Tailwind Typography** (`@tailwindcss/typography`) may need adding to the cockpit's Tailwind setup if not already present; verify before relying on `prose`.
- **Light-mode regression risk:** every hardcoded color removed must be replaced with a token so light mode renders correctly; test both themes, and confirm the iframe still receives the theme after the reskin.
- **Patch release only** per project convention (`@ngaf`/`@threadplane` packages stay at `0.0.x`); the cockpit app itself isn't published, so this is moot for cockpit but relevant if shared libs (`ui-react`, `design-tokens`) change.

## Verification

- Run `npx nx serve cockpit` and exercise a capability page (e.g. `deep-agents/planning`) in **both** light and dark:
  - Chrome: logo lockup present, no capability title, single sky-blue accent, mono labels rendering in JetBrains Mono.
  - Run mode: embedded chat demo theme follows the host toggle (postMessage handshake intact).
  - Code mode: clean header (filename + lang chip + Copy), long lines scroll inside the block, header adapts to theme.
  - Docs mode: prose article, serif headings (EB Garamond actually loading), shared code block, responsive.
  - API mode: prose container, responsive param table.
- Existing component specs (`*.spec.tsx`) updated to match the restructured markup.
