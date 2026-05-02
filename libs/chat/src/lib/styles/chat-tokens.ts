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
  --ngaf-chat-warning-bg: #fffbeb;
  --ngaf-chat-warning-text: #b45309;
  --ngaf-chat-success: #16a34a;
  --ngaf-chat-shadow-sm: 0 1px 2px rgba(0,0,0,.05);
  --ngaf-chat-shadow-md: 0 4px 6px -1px rgba(0,0,0,.10), 0 2px 4px -1px rgba(0,0,0,.06);
  --ngaf-chat-shadow-lg: 0 10px 15px -3px rgba(0,0,0,.10), 0 4px 6px -2px rgba(0,0,0,.05);
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
  --ngaf-chat-warning-bg: rgb(45, 35, 21);
  --ngaf-chat-warning-text: #fbbf24;
  --ngaf-chat-success: #4ade80;
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
 * Token defaults written to `<head>` once on first chat-component
 * construction. Wrapped in `@layer ngaf-chat` so the consumer's unlayered
 * `:root { --ngaf-chat-*: ... }` rule beats the lib's defaults regardless
 * of source order — the standard CSS pattern for framework defaults.
 *
 * Theme switching:
 *   - `prefers-color-scheme: dark` → dark by default.
 *   - `[data-ngaf-chat-theme="dark"]` on `<html>` / `<body>` / any wrapper
 *     forces dark.
 *   - `[data-ngaf-chat-theme="light"]` forces light.
 */
const ROOT_TOKEN_STYLES = `
@layer ngaf-chat {
  :root {
    ${LIGHT_TOKENS}
    ${GEOMETRY_TOKENS}
    ${TYPOGRAPHY_TOKENS}
    ${SPACING_TOKENS}
  }
  @media (prefers-color-scheme: dark) {
    :root { ${DARK_TOKENS} }
  }
  :root[data-ngaf-chat-theme="light"],
  [data-ngaf-chat-theme="light"] { ${LIGHT_TOKENS} }
  :root[data-ngaf-chat-theme="dark"],
  [data-ngaf-chat-theme="dark"] { ${DARK_TOKENS} }
}
${KEYFRAMES}
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
ensureChatRootStyles();
