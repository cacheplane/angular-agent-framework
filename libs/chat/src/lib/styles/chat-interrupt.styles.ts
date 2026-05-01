// SPDX-License-Identifier: MIT
export const CHAT_INTERRUPT_STYLES = `
  :host { display: block; }
  .chat-interrupt {
    background: var(--ngaf-chat-warning-bg);
    color: var(--ngaf-chat-warning-text);
    border-left: 3px solid var(--ngaf-chat-warning-text);
    border-radius: var(--ngaf-chat-radius-card);
    padding: 12px 16px;
    margin: 0 var(--ngaf-chat-space-6) var(--ngaf-chat-space-2);
    font-size: var(--ngaf-chat-font-size-sm);
  }
  .chat-interrupt__title { font-weight: 600; margin: 0 0 4px; display: flex; align-items: center; gap: 6px; }
  .chat-interrupt__body { margin: 0 0 8px; opacity: 0.95; }
  .chat-interrupt__actions { display: flex; gap: 8px; flex-wrap: wrap; }
`;
