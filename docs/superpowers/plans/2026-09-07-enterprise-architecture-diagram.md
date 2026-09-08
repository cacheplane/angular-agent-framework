# Enterprise Architecture Diagram Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the homepage's "Where Threadplane fits" scope table with the researched enterprise architecture diagram, pixel-aligned on an 8px grid, every card linking to its docs page, verified by a geometry unit test and a text-overflow e2e, and shown to the user before merge.

**Architecture:** Geometry and copy live in a typed data module so the component, the unit test, and the e2e read the same numbers. The component is a server-rendered SVG inside the kit's `DiagramFrame`. The mockup generator in this session's scratchpad is the reference; the data module ports its coordinates verbatim.

**Tech Stack:** Next.js server components, the docs diagram kit (`DiagramFrame`, `DiagramSection`), Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-07-enterprise-architecture-diagram-design.md`.

---

### Task 1: The data module
**Files:** create `apps/website/src/lib/architecture-diagram.ts`, `architecture-diagram.spec.ts`.
- [ ] Types: `Zone { id, label, owner, y, height, fill, stroke, mark? }`, `Card { id, zoneId, x, y, width, height, title, icon?, tint?, href, tag?, rows: Row[] }`, `Row` = `{ kind: 'chips', y, chips: { mark?: string; label: string; href?: string }[] } | { kind: 'text', y, text } | { kind: 'mono', y, text } | { kind: 'caps', y, caps: { icon, label, href }[] }`, `Arrow { x, y1, y2, caption }`. Constants `VIEW = { width: 1280, height: 1088 }`, `GRID = 8`, `MAJOR = 40`, `ZONE_PAD = 32`, `CARD_GAP = 40`.
- [ ] Data: port every coordinate from the approved mockup (three zones at y 40/360/624, heights 280/224/424; cards per spec §3 with the mockup's x/y/width/height; arrows at x 444 between zones with their captions).
- [ ] Spec: every zone and card coordinate divisible by 8; cards inside their zone with ≥ 24px inset; no two cards in a zone overlap; gaps between horizontally adjacent cards equal `CARD_GAP`; every href starts with `/docs/` and the corresponding `apps/website/content/docs/<path>.mdx` exists (or `/render` → `src/app/render/page.tsx`); every `mark` names a file under `apps/website/public/logos/`.
- [ ] Commit `feat(website): architecture diagram geometry and copy as data`.

### Task 2: The component and the section
**Files:** create `apps/website/src/components/landing/EnterpriseArchitecture.tsx`, `EnterpriseArchitecture.spec.tsx`; modify `apps/website/src/app/page.tsx`, `apps/website/src/lib/positioning.ts` (+spec), `apps/website/src/styles/landing.css`; delete `ScopeTable.tsx` + spec and `FINAL_MILE_*`.
- [ ] Component: `DiagramSection id="architecture" eyebrow="Architecture" headline=… body=…` wrapping `DiagramFrame slug="enterprise-architecture" viewWidth=1280 viewHeight=1088 scale="marketing" label=…`; draws zones, cards, rows, arrows from the data module; icons as inline paths keyed by name; logos as `<image href="/logos/…">`; each card an `<a href>` with a "docs ↗" text at top-right (none on the Threadplane card); `data-grid` attribute on the figure toggles a hidden 8/40px grid `<g>` (rendered only when the attribute is present, for review).
- [ ] CSS: `.arch-*` text classes mirroring the mockup's type ramp (title 15/600, body 12.5, chip 11.5/500, mono 11.5, zone label 11.5 tracked, owner 11, tag 10.5 tracked blue, docs 10.5 blue), fills via tokens where they exist (`--color-text-primary`, `--color-text-secondary`, border tokens) and literal gradient stops otherwise; `.tp-diagram-figure` minimum width 1024px inside the landing scroll frame.
- [ ] Spec: renders 3 zones, 10 cards, 12+ links with the data module's hrefs; the `data-grid` group is absent by default and present with the attribute; the heading id is `architecture-heading`.
- [ ] `page.tsx`: `<EnterpriseArchitecture />` where `<ScopeTable />` was; remove `ScopeTable`, `FINAL_MILE_*`, the `.scope-table*` CSS; update `positioning.spec.ts` and `e2e/website.spec.ts` (`why-heading` → `architecture-heading`).
- [ ] Commit `feat(website): enterprise architecture diagram replaces the scope table`.

### Task 3: e2e and visual proof
**Files:** create `apps/website/e2e/home-architecture.spec.ts`.
- [ ] At 1440×900: for every `text` inside `[data-diagram="enterprise-architecture"]`, `getBBox()` lies inside the nearest ancestor card rect (from `data-card` on the group) with ≥ 6px margin; every chip rect inside its card; every `image` has a non-zero bbox; the section heading text and the 12 card hrefs match. At 390×844: the figure's scroll width ≥ 1024 and `scrollWidth > clientWidth`.
- [ ] Render PNGs at 1440 and 390 (Playwright) for the user, plus one with the alignment grid on.
- [ ] Run `npx nx test website`, lint, `npx nx build website`, `npx nx e2e website -- --grep "homepage architecture|landing page|homepage stage"`.
- [ ] Commit `test(website): architecture diagram geometry and overflow guards`; push; open the PR WITHOUT auto-merge; show the user the frames; merge only on their word.
