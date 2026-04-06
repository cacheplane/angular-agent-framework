// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

const DARK = `
  --chat-bg: #171717;
  --chat-bg-alt: #222222;
  --chat-bg-hover: #2a2a2a;
  --chat-text: #e0e0e0;
  --chat-text-muted: #777777;
  --chat-text-placeholder: #666666;
  --chat-border: #333333;
  --chat-border-light: #2a2a2a;
  --chat-user-bg: #2a2a2a;
  --chat-user-text: #f5f5f5;
  --chat-user-border: #333333;
  --chat-avatar-bg: #333333;
  --chat-avatar-text: #aaaaaa;
  --chat-input-bg: #222222;
  --chat-input-border: #333333;
  --chat-input-focus-border: #555555;
  --chat-send-bg: #444444;
  --chat-send-text: #aaaaaa;
  --chat-error-bg: #2d1515;
  --chat-error-text: #f87171;
  --chat-warning-bg: #2d2315;
  --chat-warning-text: #fbbf24;
  --chat-success: #4ade80;
  --chat-radius-message: 20px;
  --chat-radius-input: 24px;
  --chat-radius-card: 12px;
  --chat-radius-avatar: 8px;
  --chat-max-width: 720px;
  --chat-font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif;
  --chat-font-size: 15px;
  --chat-line-height: 1.6;
`;

const LIGHT = `
  --chat-bg: #ffffff;
  --chat-bg-alt: #f5f5f5;
  --chat-bg-hover: #ebebeb;
  --chat-text: #1a1a1a;
  --chat-text-muted: #999999;
  --chat-text-placeholder: #999999;
  --chat-border: #e5e5e5;
  --chat-border-light: #f0f0f0;
  --chat-user-bg: #f0f0f0;
  --chat-user-text: #1a1a1a;
  --chat-user-border: transparent;
  --chat-avatar-bg: #f0f0f0;
  --chat-avatar-text: #666666;
  --chat-input-bg: #f5f5f5;
  --chat-input-border: #e5e5e5;
  --chat-input-focus-border: #cccccc;
  --chat-send-bg: #e5e5e5;
  --chat-send-text: #999999;
  --chat-error-bg: #fef2f2;
  --chat-error-text: #dc2626;
  --chat-warning-bg: #fffbeb;
  --chat-warning-text: #d97706;
  --chat-success: #16a34a;
`;

/**
 * Shared theme styles for chat composition components.
 * Defines CSS custom properties on :host for dark/light mode.
 * Import into any composition's `styles` array.
 */
export const CHAT_THEME_STYLES = `
  :host {
    ${DARK}
    font-family: var(--chat-font-family);
    font-size: var(--chat-font-size);
    line-height: var(--chat-line-height);
    color: var(--chat-text);
    background: var(--chat-bg);
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }
  @media (prefers-color-scheme: light) {
    :host:not([data-chat-theme="dark"]) { ${LIGHT} }
  }
  :host([data-chat-theme="light"]) { ${LIGHT} }
`;
