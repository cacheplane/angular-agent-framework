// SPDX-License-Identifier: MIT
export const CHAT_ERROR_STYLES = `
  :host { display: block; }
  .chat-error {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    background: var(--ngaf-chat-error-bg);
    border: 1px solid var(--ngaf-chat-error-border);
    color: var(--ngaf-chat-error-text);
    border-radius: var(--ngaf-chat-radius-card);
    padding: 8px 12px;
    font-size: var(--ngaf-chat-font-size-sm);
    margin: 0 var(--ngaf-chat-space-6) var(--ngaf-chat-space-2);
  }
  .chat-error__icon { flex-shrink: 0; width: 16px; height: 16px; margin-top: 2px; }
  .chat-error__msg { flex: 1; min-width: 0; word-break: break-word; }
`;
