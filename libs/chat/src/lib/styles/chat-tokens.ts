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
`;

/**
 * Component-host design tokens. Import into every chat component's `styles`
 * array so CSS custom properties resolve on `:host` without consumer setup.
 * Light tokens are default; dark applies via prefers-color-scheme OR via the
 * `[data-ngaf-chat-theme="dark"]` attribute on the host. Consumers can force
 * light by setting `[data-ngaf-chat-theme="light"]`.
 */
export const CHAT_HOST_TOKENS = `
  :host {
    ${LIGHT_TOKENS}
    ${GEOMETRY_TOKENS}
    ${TYPOGRAPHY_TOKENS}
    ${SPACING_TOKENS}
    font-family: var(--ngaf-chat-font-family);
    color: var(--ngaf-chat-text);
  }
  @media (prefers-color-scheme: dark) {
    :host:not([data-ngaf-chat-theme="light"]) { ${DARK_TOKENS} }
  }
  :host([data-ngaf-chat-theme="dark"]) { ${DARK_TOKENS} }
  ${KEYFRAMES}
`;
