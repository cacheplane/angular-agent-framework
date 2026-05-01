// libs/chat/src/lib/styles/chat-launcher-button.styles.ts
// SPDX-License-Identifier: MIT
export const CHAT_LAUNCHER_BUTTON_STYLES = `
  :host { display: inline-block; }
  .chat-launcher-button {
    width: 56px;
    height: 56px;
    border-radius: var(--ngaf-chat-radius-launcher);
    background: var(--ngaf-chat-primary);
    color: var(--ngaf-chat-on-primary);
    border: 0;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: var(--ngaf-chat-shadow-md);
    transition: transform 200ms ease;
  }
  .chat-launcher-button:hover { transform: scale(1.05); }
  .chat-launcher-button svg { width: 24px; height: 24px; }
`;
