// libs/chat/src/lib/styles/chat-tokens.ts
// SPDX-License-Identifier: MIT

const LIGHT_TOKENS = `
  --ngaf-chat-bg: rgb(255, 255, 255);
  --ngaf-chat-surface: rgb(255, 255, 255);
  --ngaf-chat-surface-alt: rgb(251, 251, 251);
  --ngaf-chat-primary: rgb(28, 28, 28);
  --ngaf-chat-on-primary: rgb(255, 255, 255);
  --ngaf-chat-text: rgb(28, 28, 28);
  --ngaf-chat-text-muted: rgb(115, 115, 115);
  --ngaf-chat-separator: rgb(229, 229, 229);
  --ngaf-chat-muted: rgb(200, 200, 200);
  --ngaf-chat-error-bg: #fef2f2;
  --ngaf-chat-error-border: #fecaca;
  --ngaf-chat-error-text: #dc2626;
  --ngaf-chat-destructive: #dc2626;
  --ngaf-chat-warning-bg: #fffbeb;
  --ngaf-chat-warning-text: #b45309;
  --ngaf-chat-success: #16a34a;
  --ngaf-chat-shadow-sm: 0 1px 2px rgba(0,0,0,.05);
  --ngaf-chat-shadow-md: 0 4px 6px -1px rgba(0,0,0,.10), 0 2px 4px -1px rgba(0,0,0,.06);
  --ngaf-chat-shadow-lg: 0 10px 15px -3px rgba(0,0,0,.10), 0 4px 6px -2px rgba(0,0,0,.05);

  /* --a2ui-* light variant */
  --a2ui-primary: #4f8df5;
  --a2ui-on-primary: #ffffff;
  --a2ui-primary-hover: #3a78e0;
  --a2ui-secondary: #5f6470;
  --a2ui-on-secondary: #ffffff;
  --a2ui-surface: #ffffff;
  --a2ui-on-surface: #1a1d23;
  --a2ui-surface-variant: rgba(0, 0, 0, 0.04);
  --a2ui-on-surface-variant: rgba(0, 0, 0, 0.6);
  --a2ui-outline: rgba(0, 0, 0, 0.12);
  --a2ui-outline-variant: rgba(0, 0, 0, 0.06);
  --a2ui-error: #dc2626;
  --a2ui-on-error: #ffffff;
  --a2ui-scrim: rgba(0, 0, 0, 0.4);
  --a2ui-elevation-0: none;
  --a2ui-elevation-1: 0 1px 2px rgba(0, 0, 0, 0.06);
  --a2ui-elevation-2: 0 2px 4px rgba(0, 0, 0, 0.08);
  --a2ui-elevation-3: 0 4px 8px rgba(0, 0, 0, 0.10);
  --a2ui-elevation-4: 0 8px 16px rgba(0, 0, 0, 0.14);
  --a2ui-elevation-5: 0 16px 32px rgba(0, 0, 0, 0.18);
`;

const DARK_TOKENS = `
  --ngaf-chat-bg: rgb(17, 17, 17);
  --ngaf-chat-surface: rgb(28, 28, 28);
  --ngaf-chat-surface-alt: rgb(44, 44, 44);
  --ngaf-chat-primary: rgb(255, 255, 255);
  --ngaf-chat-on-primary: rgb(28, 28, 28);
  --ngaf-chat-text: rgb(245, 245, 245);
  --ngaf-chat-text-muted: rgb(160, 160, 160);
  --ngaf-chat-separator: rgb(45, 45, 45);
  --ngaf-chat-muted: rgb(60, 60, 60);
  --ngaf-chat-error-bg: rgb(45, 21, 21);
  --ngaf-chat-error-border: #dc2626;
  --ngaf-chat-error-text: #fca5a5;
  --ngaf-chat-destructive: #ef4444;
  --ngaf-chat-warning-bg: rgb(45, 35, 21);
  --ngaf-chat-warning-text: #fbbf24;
  --ngaf-chat-success: #4ade80;

  /* --a2ui-* dark variant (preserves current chat.css values) */
  --a2ui-primary: #4f8df5;
  --a2ui-on-primary: #ffffff;
  --a2ui-primary-hover: #6699f7;
  --a2ui-secondary: #8a92a3;
  --a2ui-on-secondary: #ffffff;
  --a2ui-surface: #1a1d23;
  --a2ui-on-surface: #ffffff;
  --a2ui-surface-variant: rgba(255, 255, 255, 0.05);
  --a2ui-on-surface-variant: rgba(255, 255, 255, 0.7);
  --a2ui-outline: rgba(255, 255, 255, 0.1);
  --a2ui-outline-variant: rgba(255, 255, 255, 0.05);
  --a2ui-error: #f5524f;
  --a2ui-on-error: #ffffff;
  --a2ui-scrim: rgba(0, 0, 0, 0.6);
  --a2ui-elevation-0: none;
  --a2ui-elevation-1: 0 1px 2px rgba(0, 0, 0, 0.3);
  --a2ui-elevation-2: 0 2px 4px rgba(0, 0, 0, 0.35);
  --a2ui-elevation-3: 0 4px 8px rgba(0, 0, 0, 0.4);
  --a2ui-elevation-4: 0 8px 16px rgba(0, 0, 0, 0.45);
  --a2ui-elevation-5: 0 16px 32px rgba(0, 0, 0, 0.5);
`;

const GEOMETRY_TOKENS = `
  --ngaf-chat-radius-bubble: 15px;
  --ngaf-chat-radius-input: 20px;
  --ngaf-chat-radius-card: 8px;
  --ngaf-chat-radius-button: 8px;
  --ngaf-chat-radius-launcher: 9999px;
  --ngaf-chat-max-width: 48rem;
`;

const TYPOGRAPHY_TOKENS = `
  --ngaf-chat-font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
  --ngaf-chat-font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  --ngaf-chat-font-size: 1rem;
  --ngaf-chat-font-size-sm: 0.875rem;
  --ngaf-chat-font-size-xs: 0.75rem;
  --ngaf-chat-line-height: 1.6;
  --ngaf-chat-line-height-tight: 1.5;
`;

const SPACING_TOKENS = `
  --ngaf-chat-space-1: 4px;
  --ngaf-chat-space-2: 8px;
  --ngaf-chat-space-3: 12px;
  --ngaf-chat-space-4: 16px;
  --ngaf-chat-space-5: 20px;
  --ngaf-chat-space-6: 24px;
  --ngaf-chat-space-8: 32px;
  --ngaf-chat-edge-pad: 16px;
  --ngaf-chat-input-gap: 0.75rem;
  --ngaf-chat-sidenav-width-expanded: 280px;
  --ngaf-chat-sidenav-width-collapsed: 56px;
  --ngaf-chat-sidenav-width-drawer: 280px;
`;

const LAYER_TOKENS = `
  /* Z-index layers — documented for consumers + future primitives.
   * Default values listed; overridable per-app via :root or :host.
   * Modal layers sit above drawer so palettes/dialogs stay reachable
   * when the drawer is open. */
  --ngaf-chat-z-overlay-content: 30;   /* chat-sidebar panel, chat-popup window */
  --ngaf-chat-z-drawer-scrim: 1000;    /* chat-sidenav-scrim backdrop */
  --ngaf-chat-z-drawer: 1001;          /* chat-sidenav drawer mode host */
  --ngaf-chat-z-modal-scrim: 1100;     /* chat-history-search-palette backdrop */
  --ngaf-chat-z-modal: 1101;           /* chat-history-search-palette dialog */
`;

const EDGE_CLAIM_TOKENS = `
  /* Edge-claim primitive — peer-aware panel coexistence.
     Each docked panel publishes the edge it occupies via a
     data-ngaf-chat-* attribute on <html>; other panels read these
     custom properties to leave room. Defaults to 0px so consumers
     not using chat-sidebar/chat-debug see zero overhead.

     TWO LAYERS:
     1. Per-component claim vars (--ngaf-chat-<component>-claim-<edge>)
        are read by PEERS only — never by the component that wrote
        them. This eliminates self-feedback (where a right-docked
        panel would offset itself by reading its own claim).
     2. Aggregate occupy-* vars are convenience reads for external
        consumers and for cases where any-panel-on-edge matters. */
  --ngaf-chat-occupy-top:    0px;
  --ngaf-chat-occupy-right:  0px;
  --ngaf-chat-occupy-bottom: 0px;
  --ngaf-chat-occupy-left:   0px;

  /* Per-component claims (peer-only reads). */
  --ngaf-chat-sidebar-claim-right:  0px;
  --ngaf-chat-debug-claim-top:      0px;
  --ngaf-chat-debug-claim-right:    0px;
  --ngaf-chat-debug-claim-bottom:   0px;
  --ngaf-chat-debug-claim-left:     0px;

  /* Sizes the chat-debug dock contributes when it claims an edge.
     Split by orientation so consumers can override independently. */
  --ngaf-chat-debug-panel-size-h: 40vh;
  --ngaf-chat-debug-panel-size-w: 420px;
`;

const KEYFRAMES = `
  @keyframes ngaf-chat-spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  @keyframes ngaf-chat-typing-dot {
    0%, 80%, 100% { transform: scale(0.5); opacity: 0.5; }
    40% { transform: scale(1); opacity: 1; }
  }
  @keyframes ngaf-chat-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }
  @keyframes ngaf-chat-caret-blink {
    0%, 50% { opacity: 1; }
    50.01%, 100% { opacity: 0; }
  }
  @keyframes ngaf-chat-caret-fade-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes ngaf-chat-welcome-mount {
    from { opacity: 0; transform: translateY(-8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
`;

/**
 * Component-scoped styles. Imported into every chat component's `styles`
 * array. Carries only:
 *   - `:host` font-family + color (so the component inherits text styling)
 *   - keyframes the components use
 *
 * Token *defaults* are NOT set on `:host` — they're set on `:root` via the
 * shared style element below (`ensureChatRootStyles()`). That shift is what
 * makes the documented `:root { --ngaf-chat-*: ... }` consumer override
 * actually work, because direct-on-host token settings would shadow
 * inheritance regardless of CSS specificity.
 */
export const CHAT_HOST_TOKENS = `
  :host {
    font-family: var(--ngaf-chat-font-family);
    color: var(--ngaf-chat-text);
  }
`;
// Note: @keyframes are NOT placed in CHAT_HOST_TOKENS. Angular's emulated
// view encapsulation scopes @keyframes names per-component, which can
// desynchronise from animation property references when styles are
// concatenated across helper strings. They're injected globally via
// ROOT_TOKEN_STYLES below so the names match what `animation: ngaf-chat-*`
// references in component styles (which Angular leaves untouched).

/**
 * WCAG 2.3.3 — honor the OS-level "Reduce Motion" preference. Collapses
 * every transition/animation in the chat lib (and the a2ui catalog,
 * which renders in the same document) to instant. The `!important`
 * flag intentionally overrides any inline `style="transition: ..."`
 * applied by future code — accessibility wins.
 *
 * Infinite-loop indicators (spinner, typing dots, caret, etc.) need
 * explicit `animation: none` because `iteration-count: 1` alone would
 * freeze them mid-loop, which reads as a bug.
 */
const REDUCED_MOTION_STYLES = `
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }

  .tcc__pill[data-status="running"] svg,
  .ngaf-chat-typing-dot,
  .ngaf-chat-caret,
  .ngaf-chat-welcome__pulse,
  .chat-genui-skeleton,
  .chat-debug__pill--active {
    animation: none !important;
    opacity: 1 !important;
  }

  .tcc__pill[data-status="running"] svg {
    transform: none !important;
  }
}
`;

/**
 * Token defaults written to `<head>` once on first chat-component
 * construction. Wrapped in `@layer ngaf-chat` so the consumer's unlayered
 * `:root { --ngaf-chat-*: ... }` rule beats the lib's defaults regardless
 * of source order — the standard CSS pattern for framework defaults.
 *
 * Theme switching:
 *   - `prefers-color-scheme: dark` → dark by default.
 *   - `[data-theme="dark"]` on `<html>` / `<body>` / any wrapper
 *     forces dark.
 *   - `[data-theme="light"]` forces light.
 */
const A2UI_INVARIANT_TOKENS = `
  /* --a2ui-* theme-invariant tokens (spacing, typography, shape, motion, focus, aliases) */

  /* Spacing scale (4px base) */
  --a2ui-spacing-1: 4px;
  --a2ui-spacing-2: 8px;
  --a2ui-spacing-3: 12px;
  --a2ui-spacing-4: 16px;
  --a2ui-spacing-5: 24px;
  --a2ui-spacing-6: 32px;
  --a2ui-spacing-7: 40px;

  /* Typography (per Text usageHint) */
  --a2ui-typography-h1-size: 32px;
  --a2ui-typography-h1-weight: 700;
  --a2ui-typography-h1-line-height: 1.2;
  --a2ui-typography-h2-size: 24px;
  --a2ui-typography-h2-weight: 600;
  --a2ui-typography-h2-line-height: 1.3;
  --a2ui-typography-h3-size: 20px;
  --a2ui-typography-h3-weight: 600;
  --a2ui-typography-h3-line-height: 1.3;
  --a2ui-typography-h4-size: 18px;
  --a2ui-typography-h4-weight: 500;
  --a2ui-typography-h4-line-height: 1.4;
  --a2ui-typography-h5-size: 16px;
  --a2ui-typography-h5-weight: 500;
  --a2ui-typography-h5-line-height: 1.4;
  --a2ui-typography-body-size: 14px;
  --a2ui-typography-body-weight: 400;
  --a2ui-typography-body-line-height: 1.5;
  --a2ui-typography-caption-size: 12px;
  --a2ui-typography-caption-weight: 400;
  --a2ui-typography-caption-line-height: 1.4;
  --a2ui-typography-label-size: 12px;
  --a2ui-typography-label-weight: 500;

  /* Shape radius */
  --a2ui-shape-extra-small: 4px;
  --a2ui-shape-small: 8px;
  --a2ui-shape-medium: 12px;
  --a2ui-shape-large: 16px;
  --a2ui-shape-extra-large: 28px;

  /* Focus ring */
  --a2ui-focus-ring-color: var(--a2ui-primary);
  --a2ui-focus-ring-width: 2px;

  /* Motion */
  --a2ui-motion-duration-short: 100ms;
  --a2ui-motion-duration-medium: 200ms;
  --a2ui-motion-duration-long: 300ms;
  --a2ui-motion-easing-standard: cubic-bezier(0.2, 0, 0, 1);
  --a2ui-motion-easing-emphasized: cubic-bezier(0.2, 0, 0, 1.4);

  /* Aliases (kept for back-compat) */
  --a2ui-card-bg: var(--a2ui-surface);
  --a2ui-input-bg: var(--a2ui-surface-variant);
  --a2ui-input-text: var(--a2ui-on-surface);
  --a2ui-label: var(--a2ui-on-surface-variant);
  --a2ui-caption: var(--a2ui-on-surface-variant);
  --a2ui-border: var(--a2ui-outline);
`;

export const ROOT_TOKEN_STYLES = `
@layer ngaf-chat {
  :root {
    ${LIGHT_TOKENS}
    ${GEOMETRY_TOKENS}
    ${TYPOGRAPHY_TOKENS}
    ${SPACING_TOKENS}
    ${LAYER_TOKENS}
    ${EDGE_CLAIM_TOKENS}
    ${A2UI_INVARIANT_TOKENS}
  }
  @media (prefers-color-scheme: dark) {
    :root { ${DARK_TOKENS} }
  }
  :root[data-theme="light"],
  [data-theme="light"],
  :root[data-ngaf-chat-theme="light"],
  [data-ngaf-chat-theme="light"] { ${LIGHT_TOKENS} }
  :root[data-theme="dark"],
  [data-theme="dark"],
  :root[data-ngaf-chat-theme="dark"],
  [data-ngaf-chat-theme="dark"] { ${DARK_TOKENS} }

  /* Edge-claim attribute mappings.
     chat-sidebar sets data-ngaf-chat-sidebar="open" while its panel is open.
     chat-debug sets data-ngaf-chat-debug to its current dock while open. */
  :root[data-ngaf-chat-sidebar="open"] {
    --ngaf-chat-sidebar-claim-right: var(--ngaf-chat-sidebar-width-drawer, 28rem);
    --ngaf-chat-occupy-right: var(--ngaf-chat-sidebar-width-drawer, 28rem);
  }
  :root[data-ngaf-chat-debug="bottom"] {
    --ngaf-chat-debug-claim-bottom: var(--ngaf-chat-debug-panel-size-h, 40vh);
    --ngaf-chat-occupy-bottom: var(--ngaf-chat-debug-panel-size-h, 40vh);
  }
  :root[data-ngaf-chat-debug="right"] {
    --ngaf-chat-debug-claim-right: var(--ngaf-chat-debug-panel-size-w, 420px);
    --ngaf-chat-occupy-right: var(--ngaf-chat-debug-panel-size-w, 420px);
  }
  :root[data-ngaf-chat-debug="left"] {
    --ngaf-chat-debug-claim-left: var(--ngaf-chat-debug-panel-size-w, 420px);
    --ngaf-chat-occupy-left: var(--ngaf-chat-debug-panel-size-w, 420px);
  }
}
${KEYFRAMES}
${REDUCED_MOTION_STYLES}
`;

const STYLE_ELEMENT_ID = 'ngaf-chat-root-tokens';

/**
 * Idempotent: appends a `<style id="ngaf-chat-root-tokens">` to `<head>`
 * the first time it's called. Subsequent calls are no-ops.
 *
 * No-op outside the browser (server-side rendering).
 */
export function ensureChatRootStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ELEMENT_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ELEMENT_ID;
  style.textContent = ROOT_TOKEN_STYLES;
  document.head.appendChild(style);
}

// Auto-inject on module evaluation. Every chat component imports
// `CHAT_HOST_TOKENS` from this file, so the first chat component to load
// triggers this once. Safe to evaluate eagerly: idempotent + SSR-guarded.
//
// Note: this side-effect call is the "fast path" — it normally fires
// during the first chat-component import on the client. But production
// bundlers with aggressive tree-shaking can drop it if they treat the
// published artifact as side-effect-free (the published `sideEffects`
// field doesn't match the bundled fesm filename, and TS-path consumers
// route through the source where it does match). The top-level chat
// compositions (`ChatComponent`, `ChatPopupComponent`,
// `ChatSidebarComponent`, `ChatDebugComponent`) also call this from
// their constructors so the injection is guaranteed even when the
// module-eval call gets stripped. Both paths are idempotent.
ensureChatRootStyles();
