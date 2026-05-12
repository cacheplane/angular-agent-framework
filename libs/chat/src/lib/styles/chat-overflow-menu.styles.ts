// libs/chat/src/lib/styles/chat-overflow-menu.styles.ts
// SPDX-License-Identifier: MIT
export const CHAT_OVERFLOW_MENU_STYLES = `
  :host { display: contents; }
  .chat-overflow-menu__scrim {
    position: fixed;
    inset: 0;
    background: transparent;
    z-index: 59;
    border: 0;
    padding: 0;
    cursor: default;
  }
  .chat-overflow-menu {
    position: fixed;
    z-index: 60;
    min-width: 160px;
    padding: 4px;
    margin: 0;
    list-style: none;
    background: var(--ngaf-chat-bg);
    border: 1px solid var(--ngaf-chat-separator);
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  }
  .chat-overflow-menu__item {
    display: block;
    padding: 8px 12px;
    border-radius: 4px;
    color: var(--ngaf-chat-text);
    font-size: var(--ngaf-chat-font-size-sm);
    cursor: pointer;
    user-select: none;
  }
  .chat-overflow-menu__item:hover {
    background: var(--ngaf-chat-surface-alt);
  }
  .chat-overflow-menu__item:focus-visible {
    outline: 2px solid var(--ngaf-chat-primary);
    outline-offset: -2px;
  }
  .chat-overflow-menu__item--destructive {
    color: var(--ngaf-chat-error-text);
  }
  .chat-overflow-menu__item--disabled {
    color: var(--ngaf-chat-text-muted);
    cursor: not-allowed;
    pointer-events: none;
  }
`;
