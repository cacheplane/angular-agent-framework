# Unified control-plane production polish

## Status

Approved through interactive design review after production Chrome validation on 2026-09-01. This is the first implementation PR in the control-plane follow-up and is intentionally independent of custom runtime targets.

## Summary

Finish the small interaction and visual details exposed by the production audit without redesigning the unified rail and context shell. The current responsive layout, icon system, section hierarchy, rounded active states, mode history, mobile search handoff, and runtime persistence all passed validation and remain unchanged.

The implementation centers the page-actions control as a first-class header action, gives it a 44px target at every pointer mode, adds a visible tooltip, and locks in the approved minimal heading and icon treatment through focused regression coverage.

## Production evidence

Chrome validation covered the Docs and Cockpit production deployments at 320, 768, 1024, and 1440 CSS pixels.

- No tested width produced horizontal page overflow.
- Desktop rail plus context pane, tablet rail plus drawer, and mobile modal layouts behaved correctly.
- Docs, Run, Code, and API mode changes preserved the mounted runtime and browser history.
- Capability navigation and mobile Search restored focus correctly.
- Active and hover rows were fully rounded and had no left-edge marker.
- Context headings were quiet title case with readable weight and no uppercase microcopy.
- Current Lucide icons and chevrons used the approved clean 2px stroke treatment.
- The page-actions menu itself was polished and correctly contained On this page and Copy page as Markdown.
- The page-actions trigger measured 36 by 36 pixels at every tested width, below the 44px interaction baseline and visually lighter than its surrounding header controls.

## Goals

1. Make Page actions feel intentional in the branded page header at every responsive width.
2. Meet a minimum 44 by 44 CSS-pixel target for mouse, touch, pen, and keyboard users.
3. Preserve the icon-led menu and all existing menu behavior.
4. Add visible tooltip and focus treatment without making the tooltip the accessible name.
5. Prevent regressions to uppercase section headings, thin icons, partial active borders, or square hover states.

## Non-goals

- Redesigning the rail, context pane, page header, or menu information architecture.
- Adding direct On this page or Copy page buttons outside the overflow menu.
- Replacing Lucide, changing the shared 2px icon stroke, or adding decorative icons.
- Changing article typography, navigation labels, shell breakpoints, or runtime behavior.
- Implementing command palette, pins, recents, Activity filters, or custom runtime targets.
- Removing Cockpit links or retiring the Cockpit surface; that is the following dedicated PR.
- Committing screenshot baselines from the manual production audit.

## Page-actions control

`PageActions` remains an icon-only ellipsis button in `DocsPageHeader`. The header retains its current article-aligned measure and places the trigger at the right edge of the branded library/section row.

- The trigger is implemented at 44 by 44 CSS pixels at all pointer modes, not only under `pointer: coarse`; tests enforce 44 pixels as the minimum.
- The visual icon remains a Lucide horizontal ellipsis with a 2px stroke at an optically balanced 18–20px size.
- Default color is muted; hover, focus-visible, and expanded states use the existing primary text and rounded surface tokens.
- The hit area and hover/active background use the same rounded geometry as other docs controls.
- A shared-style tooltip reading `Page actions` uses the existing 120ms opacity/visibility transition with no additional delay on hover and keyboard focus. It is suppressed while the menu is open and on coarse pointers. The button's `aria-label` remains the accessible name.
- The control does not introduce a border or left-edge active marker in normal color modes. Forced colors retain the explicit system-color boundary already used by the docs controls.

The menu retains the current order and labels:

1. On this page.
2. Copy page as Markdown.
3. Open in ChatGPT.
4. View as Markdown.
5. Edit on GitHub.

The menu remains right-aligned to the trigger, at least 224px wide, and clamped inside the visual viewport with safe-area spacing. Existing arrow, Home, End, Escape, outside-click, copy feedback, heading expansion, and focus-restoration behavior remains authoritative.

## Heading and icon contract

No broad visual change is required because the deployed hierarchy passed review. This PR records and tests the accepted contract:

- Control-plane section headings and disclosure labels use title case, the shared sans family, 12px readable sizing, 600 weight, normal letter spacing, and muted text tokens.
- Article headings retain the existing serif treatment.
- Rail, utility, action, and disclosure icons remain Lucide icons with the shared 2px stroke and current optical sizes.
- Disclosure chevrons use the shared 15–16px treatment and rotate as a unit; no hand-drawn caret or thin text glyph is introduced.
- Active and hover rows use complete rounded backgrounds. No navigation item uses a left border or partial rounded-left marker.
- Icon-only actions retain accessible names and visible tooltips on fine pointers; mobile never depends on a tooltip as its only label.

The contract should be asserted at the smallest stable selector or component boundary. It should not duplicate implementation tokens across multiple tests.

## Responsive behavior

- 1440 and 1024: Page actions remains aligned with the article header and does not drift into unused workspace width.
- 768: the 44px trigger does not collide with the context-drawer trigger or force horizontal overflow.
- 320: the trigger, branded label, breadcrumb, and menu stay within the viewport; long breadcrumb text may continue to truncate.
- Forced colors preserves a visible trigger boundary, focus, and menu selection.
- Reduced motion removes non-essential menu and tooltip transitions.

## Error handling

- A failed Markdown fetch leaves the menu open and returns to the normal Copy page as Markdown label; it never reports success.
- If the wide On this page table of contents is unavailable, the existing nested heading links remain the fallback.
- Tooltip failure or suppression never removes the button's accessible name.
- Menu positioning failure must not create document-level horizontal scrolling.

## Testing

- Extend the `PageActions` component tests for tooltip visibility/suppression, unchanged menu contents, keyboard traversal, and focus restoration.
- Add a stable CSS contract asserting the 44px trigger outside coarse-pointer media queries and the absence of a normal-mode border marker.
- Extend website Playwright coverage to assert a computed target of at least 44 by 44 pixels and a menu bounding box inside the viewport.
- Cover 320, 768, 1024, and 1440 widths in the focused shell/page-actions matrix.
- Retain existing forced-colors and reduced-motion shell coverage; add page-actions assertions only where they exercise new behavior.
- Run existing website unit, lint, build, and project-scoped E2E targets. No Cockpit code change is expected, so Cockpit coverage is a regression smoke rather than a new feature matrix.
- Repeat the production Chrome journey after deployment: Docs to Run to Code to API, back/forward, capability navigation, mobile Search, and both Docs and Cockpit control-plane drawers.

## Acceptance criteria

1. Page actions measures at least 44 by 44 CSS pixels at all four target widths and pointer modes.
2. The trigger is visually aligned with the branded page header and retains the approved rounded hover, expanded, and focus states.
3. A visible Page actions tooltip works for hover and keyboard focus without replacing the accessible name or appearing on coarse pointers.
4. On this page and Copy page as Markdown remain inside the three-dot menu; no quick-action row is introduced.
5. Menu keyboard behavior, copy feedback, viewport containment, and focus restoration continue to pass.
6. Automated contracts prevent uppercase micro-headings, thin or hand-drawn chevrons, partial active borders, and square navigation states from returning.
7. The focused production journey passes at 320, 768, 1024, and 1440 without horizontal overflow.
