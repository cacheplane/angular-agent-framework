# Prefers-Reduced-Motion Audit — Design

**Status:** Approved
**Date:** 2026-05-12
**Scope:** `libs/chat` (primitives, compositions, styles, a2ui catalog)
**Out of scope:** marketing website (`apps/website`), other libs

## Goal

Honor the user's `prefers-reduced-motion: reduce` OS-level setting across every chat surface. WCAG 2.3.3 compliance. No JavaScript involvement — pure CSS.

## Background

`libs/chat` currently has 77 motion declarations across primitives, compositions, styles, and the a2ui catalog: transitions on hover/focus, transform-based drawer slides, mount animations, and six infinite-loop indicators. Zero existing `prefers-reduced-motion` media queries.

The a2ui catalog uses three tokenized durations (`--a2ui-motion-duration-{short,medium,long}`) defined in the optional `chat.css`. Everything else is hardcoded (`200ms ease`, `cubic-bezier(...)`, etc.). No unified chat motion-duration token exists.

## Decisions Locked During Brainstorming

| Decision | Choice |
|---|---|
| Scope | `libs/chat` end-to-end (primitives + compositions + a2ui catalog) |
| Approach | Blanket override via a single `@media (prefers-reduced-motion: reduce)` block |
| Loop animations | Static fallback (`animation: none`), not slowed or kept |
| Injection point | `ROOT_TOKEN_STYLES` in `libs/chat/src/lib/styles/chat-tokens.ts` (auto-injected at document root) |

## Architecture

Single CSS block appended to the existing `ROOT_TOKEN_STYLES` constant in `libs/chat/src/lib/styles/chat-tokens.ts`. The chat library already injects this stylesheet into the document head on first component bootstrap. The a2ui catalog renders inside the same document, so a universal selector reaches both lib surfaces.

No new TypeScript, no new file, no consumer migration required. The change is invisible to chat consumers — opt-in by the OS, not the integrator.

## The Media Block

Appended to `ROOT_TOKEN_STYLES` after the existing `@keyframes` definitions:

```css
@media (prefers-reduced-motion: reduce) {
  /* Universal — collapses all transitions/animations to instant.
     `!important` overrides component-scoped inline styles; intentional
     for accessibility. */
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }

  /* Loop indicators — static fallback instead of frozen mid-loop.
     Loading state remains accessible via aria-busy / surrounding text. */
  .tcc__pill[data-status="running"] svg,
  .ngaf-chat-typing-dot,
  .ngaf-chat-caret,
  .ngaf-chat-welcome__pulse,
  .chat-genui-skeleton,
  .chat-debug__pill--active {
    animation: none !important;
    opacity: 1 !important;
  }

  /* Spinner SVG: also cancel any inline transform applied by the
     animation's last frame. */
  .tcc__pill[data-status="running"] svg {
    transform: none !important;
  }
}
```

## Components Affected

The universal rule covers all 77 sites without per-component edits. The targeted overrides handle the six infinite loops:

| Selector | Original loop | Static fallback |
|---|---|---|
| `.tcc__pill[data-status="running"] svg` | `tcc-spin` (rotate, 0.8s) | No rotation; spinner rests in default orientation |
| `.ngaf-chat-typing-dot` | `ngaf-chat-typing-dot` (opacity, 1.4s) | Three steady dots at full opacity |
| `.ngaf-chat-caret` | `ngaf-chat-caret-blink` + `caret-fade-in` | Solid caret while streaming |
| `.ngaf-chat-welcome__pulse` | `ngaf-chat-pulse` (2s) | Static element |
| `.chat-genui-skeleton` | `chat-genui-skeleton-shimmer` (1.4s) | Flat placeholder rectangle |
| `.chat-debug__pill--active` | `chat-debug-pill-pulse` (1.2s) | Static pill |

Mount animations (`chat-debug-panel-enter`, `ngaf-chat-welcome-mount`) and transform-based slides (sidenav drawer, sidebar, popup, interrupt panel, scroll bubble) get the universal `transition-duration: 0.01ms` / `animation-duration: 0.01ms` treatment — they snap to their target state instead of animating.

## Data Flow

None. The CSS media query is reactive at the rendering-engine level. OS setting changes propagate to all open tabs without app involvement. No subscription, no signal, no JavaScript.

## Error Handling

None needed.

- Engines that don't recognize `prefers-reduced-motion` silently ignore the block (very old browsers — well outside ngaf's support matrix).
- The `!important` flag will override any inline `style="transition: ..."` that future code might write. That's intentional and called out via comment in the block.

## Testing

### Unit test

Extend `libs/chat/src/lib/styles/chat-tokens.spec.ts` with one assertion:

```ts
it('includes a prefers-reduced-motion media block in ROOT_TOKEN_STYLES', () => {
  expect(ROOT_TOKEN_STYLES).toContain('@media (prefers-reduced-motion: reduce)');
  expect(ROOT_TOKEN_STYLES).toMatch(/\*,\s*\*::before,\s*\*::after/);
  expect(ROOT_TOKEN_STYLES).toContain('animation-duration: 0.01ms');
  expect(ROOT_TOKEN_STYLES).toContain('transition-duration: 0.01ms');
});
```

Smoke-level — verifies wiring, not CSS semantics (jsdom can't simulate the media query reliably).

### Manual verification

Documented in the PR description as a checklist:

1. **macOS:** System Settings → Accessibility → Display → Reduce Motion → on.
2. **Reload** the chat example at `localhost:4200`.
3. Confirm:
   - Sidenav drawer snaps open/closed (no slide-in).
   - Typing dots are three steady dots (no blink).
   - Tool-call spinner is a static SVG (no rotation).
   - Welcome pulse off.
   - Shimmer skeleton is flat.
   - Debug panel snaps in (no fade).
   - Drag-to-reorder pinned threads still works (grip transitions are instant; drop indicator still visible).
4. **Toggle off**, reload, confirm all motion returns.

Skipping Playwright e2e — the value-add vs. manual verification for "does this *look* right" is low.

## Scope Boundaries

**In scope:**
- `libs/chat/src/lib/styles/chat-tokens.ts` (CSS block + comment)
- `libs/chat/src/lib/styles/chat-tokens.spec.ts` (one new assertion)
- This spec doc + implementation plan
- PR description with manual verification checklist

**Out of scope (deferred):**
- Refactoring the 77 hardcoded motion sites to use a unified token (no consumer-facing benefit; large diff).
- Marketing website motion (`apps/website` — separate phase, scroll/parallax concerns).
- New design-token surface for motion.
- JavaScript-side reduced-motion detection (none of our motion is JS-driven).
- E2E test using Playwright's `prefers-reduced-motion` emulation.

## References

- WCAG 2.3.3 Animation from Interactions
- MDN: `prefers-reduced-motion`
- W3C: Understanding Success Criterion 2.3.3
