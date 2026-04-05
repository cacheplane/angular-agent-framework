# Cockpit Design Polish — Sidebar, Language Picker, Code Mode

## Problem

Three design inconsistencies between the cockpit and website:
1. Sidebar section labels are long ("DEEP AGENTS · CORE CAPABILITIES") and entries repeat the product name
2. Language picker dropdown has background bleed-through and inconsistent styling
3. Code mode uses pill tabs with no whitespace, no glass frame around code blocks, no copy button

## Changes

### 1. Sidebar — Flat sections like website

Replace the current "PRODUCT · SECTION" combined labels with simple product-level collapsible sections:
- "Deep Agents" (red, collapsible)
- "LangGraph" (blue, collapsible)

Within each product section, group entries by section type with a subtle sub-heading:
- "Getting Started" as a muted sub-label (not collapsible, just visual grouping)
- "Core Capabilities" as a muted sub-label

Strip the product name prefix from entry titles: "Deep Agents Planning" → "Planning".

### 2. Language Picker — Fix dropdown

Keep the dropdown approach but fix:
- Solid glass background with proper `backdrop-filter`
- Higher z-index to prevent bleed-through
- `position: absolute` with `right: 0` alignment
- Opaque white background fallback for browsers without backdrop-filter support
- Click-outside-to-close already implemented

### 3. Code Mode — Underline tabs + glass-framed code

Replace Radix pill-style tabs with underline-style tabs matching the website's `Tabs` component:
- Bottom border on tab bar
- Active tab: accent text + 2px accent bottom border
- Inactive: muted text, transparent border

Code blocks get a glass-framed container:
- Glass border (`var(--ds-glass-border)`) + shadow
- Dark header with filename + copy button (matching the docs mode code blocks)
- More whitespace between tabs and code (12px gap)

Remove the `|` separator between frontend/backend/prompt tabs — all tabs in one flat row.

## Files

| File | Change |
|------|--------|
| `apps/cockpit/src/components/sidebar/navigation-groups.tsx` | Flat product sections, strip title prefix |
| `apps/cockpit/src/components/sidebar/language-picker.tsx` | Fix dropdown glass treatment |
| `apps/cockpit/src/components/code-mode/code-mode.tsx` | Underline tabs, glass-framed code blocks |
| `apps/cockpit/src/components/ui/tabs.tsx` | Update TabsTrigger to underline style |
