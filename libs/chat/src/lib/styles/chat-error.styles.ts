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
  .chat-error__retry {
    flex-shrink: 0;
    background: transparent;
    color: var(--ngaf-chat-error-text);
    border: 1px solid var(--ngaf-chat-error-border);
    border-radius: var(--ngaf-chat-radius-card);
    padding: 2px 10px;
    font-size: var(--ngaf-chat-font-size-sm);
    cursor: pointer;
    transition: background 150ms ease, color 150ms ease;
    white-space: nowrap;
  }
  .chat-error__retry:hover {
    background: var(--ngaf-chat-error-border);
    color: var(--ngaf-chat-error-text);
  }
  .chat-error__retry:focus-visible {
    outline: 2px solid var(--ngaf-chat-error-border);
    outline-offset: 2px;
  }
`;
