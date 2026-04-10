# Mobile Docs Nav Redesign

**Date:** 2026-04-09
**Status:** Approved

## Overview

Redesign the mobile docs navigation as a full-screen overlay with a tab-based interface. Primary tabs ("Site" | "Docs") separate global navigation from docs navigation. Library sub-tabs ("Agent" | "Render" | "Chat") switch between doc libraries. Inspired by hashbrown.dev's mobile menu pattern.

## Design

### Full-Screen Overlay

When hamburger is tapped, a full-screen overlay covers the viewport below the fixed header. White/glass background, scrollable.

### Primary Tabs

Full-width row of equal-width buttons: "Site" and "Docs". Active tab gets `accentSurface` background + `accent` text. Inactive: transparent + `textSecondary`. Inter 15px, 500 weight, 44px height, 8px border-radius.

- On `/docs/*` pages: "Docs" tab active by default
- On non-docs pages: no tab bar shown (only site links)

### Library Sub-Tabs (Docs tab only)

Row of tabs: "Agent" | "Render" | "Chat". Active library determined by URL. Mono 12px, 600 weight, 36px height. Active: `accentSurface` + `accent` text.

### Docs Content

Sections matching desktop sidebar: collapsible groups (Getting Started, Guides, Concepts, API Reference). Section headers: mono 11px uppercase, accent color, 44px tap target, chevron toggle. Current section expanded by default.

Page links: Inter 16px, 12px horizontal / 10px vertical padding, 44px min-height, full-width. Active page: `accentSurface` bg, `accent` color, 8px border-radius.

### Site Content

Large touch target links (48px height): Pilot to Prod, Docs, API, Examples, Pricing, GitHub, Get Started CTA.

### Close

Tapping ✕, a page link, or outside the overlay closes it.

## File

- Modify: `apps/website/src/components/shared/Nav.tsx`
