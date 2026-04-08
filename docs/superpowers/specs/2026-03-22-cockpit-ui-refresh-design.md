# Cockpit UI Refresh Design

**Date:** 2026-03-22  
**Status:** Approved in-session  
**Scope:** Visual and interaction design for the cockpit shell experience on top of the existing manifest-driven architecture.

---

## Goal

Turn the cockpit into a simple, modern React application that still functions as a marketing surface, while keeping the primary experience centered on runnable examples and implementation visibility.

The shell should feel like a polished product, not an internal tool. It should inherit the visual language of the website while reducing visual noise and keeping attention on the selected example.

---

## Product Direction

The cockpit home is a workspace-first product surface.

It is not a separate landing page and it is not a dense engineering dashboard. Users should land directly inside the application shell, with:

- a stable left rail for language and capability selection
- a clear example title and context header
- a default `Run` mode that opens the live surface immediately
- alternate `Code` and `Docs` modes that meaningfully recompose the main workspace
- a prompt asset interaction that is close at hand but not promoted to a top-level mode

The shell should still sell the product, but it should do so through restraint, clarity, and confidence rather than large hero copy blocks.

---

## Visual Language

The cockpit should align with the website's current design system:

- dark editorial background
- cool blue accent
- serif headline moments paired with restrained sans-serif UI text
- monospaced labels and code surfaces

The cockpit should be visually flatter and calmer than the current website landing page:

- fewer nested cards
- fewer stacked rounded boxes
- larger continuous surfaces
- more whitespace
- clearer alignment and stronger typographic hierarchy

The end result should feel like the website's product interior, not like a second unrelated app.

---

## Shell Layout

### Desktop

The cockpit is a full-height application shell with two persistent zones:

- left rail
- main workspace

The left rail remains visible on desktop and contains:

- product branding
- custom language picker
- grouped capability navigation
- a short supporting note

The left rail groups entries under small bold group headers such as:

- `Deep Agents`
- `LangGraph`

The main workspace contains:

- contextual header
- primary mode switch
- mode-specific content surface

### Mobile / Narrow Screens

The layout should remain responsive, but the interaction model stays the same:

- left rail can stack above content or become collapsible later if needed
- prompt viewer becomes a bottom-anchored or narrow slide-over treatment
- mode switching remains visible and simple

This spec does not require a mobile drawer redesign yet, only a responsive implementation of the same shell.

---

## Language Control

Language selection should live in the left rail and use a custom UI component, not the browser's native `select`.

Requirements:

- visually aligned with the rest of the shell
- supports `Python` and `TypeScript`
- reflects current active language clearly
- supports future richer states such as unavailable parity or fallback messaging

This is both a functional control and part of the product polish.

---

## Navigation Model

Capability navigation should stay grouped and readable.

Requirements:

- grouped by product area
- selected item clearly highlighted
- quiet inactive state
- no excessive badge clutter in the first version

The navigation should communicate structure without competing with the main content area.

---

## Primary Modes

The shell uses exactly three primary modes:

- `Run`
- `Code`
- `Docs`

These are not superficial tabs. Each mode should recompose the main workspace to match the user's intent.

### Run

`Run` is the default mode.

It prioritizes:

- the live example surface
- runtime feedback or logs
- a compact supporting rail with relevant context

The shell should make it obvious that users can interact with a working reference immediately.

### Code

`Code` is a focused implementation-reading mode.

Requirements:

- no left-side file column inside the code surface
- code files represented as tabs across the top of the code interface
- only one active file open at a time
- tabs represent the relevant frontend and backend files for the selected example
- editor header still shows the full file path or context

This should feel closer to an IDE than to a docs sidebar.

### Docs

`Docs` is a clean implementation guide.

It should feel like a documentation page, not a dashboard:

- strong title and intro
- explanatory narrative
- inline code samples where useful
- prompt-related copy affordances
- clear threading between run behavior, code, and prompts

The docs mode should help the user understand the example as one system.

---

## Prompt Interaction

Prompt assets remain important, but they are not a fourth primary mode.

The shell should expose a clear `Open prompt assets` call to action from the header.

Requirements:

- opens a responsive slide-over panel
- keeps the main shell visible underneath
- supports switching between prompt assets
- supports copy-oriented actions
- can later support deeper links into code mode or docs mode

This makes prompts feel intentional and accessible without overloading the top-level information architecture.

---

## Content Model In The UI

The cockpit should continue using manifest-driven content selection.

The UI should surface:

- current product / topic / language context
- relevant frontend and backend files
- prompt assets
- docs bundle content

The shell should not hardcode per-example page logic for layout decisions beyond the general mode system.

---

## Interaction Principles

- Default to `Run`
- Keep navigation stable
- Let modes recompose the workspace
- Keep prompt access secondary but obvious
- Prefer fewer, larger surfaces over nested boxes
- Keep code visibility concrete and implementation-oriented
- Treat frontend and backend as one example system

---

## Non-Goals

This design does not define:

- new capability taxonomy
- new manifest identity rules
- capability-specific runtime controls
- matrix rollout changes
- mobile-specific information architecture beyond responsiveness

---

## Success Criteria

This design is successful when:

- the cockpit looks aligned with the website but calmer and more product-like
- the shell feels simple and modern rather than dense
- users land in a runnable experience by default
- code mode feels like a real implementation-reading surface
- docs mode reads like a high-quality technical guide
- prompt assets are easy to access without becoming a top-level mode
