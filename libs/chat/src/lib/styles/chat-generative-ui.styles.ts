// SPDX-License-Identifier: MIT
export const CHAT_GENERATIVE_UI_STYLES = `
  :host {
    display: block;
    color: var(--ngaf-chat-text);
    font-size: var(--ngaf-chat-font-size);
    line-height: var(--ngaf-chat-line-height);
  }
  .chat-generative-ui__error {
    color: var(--ngaf-chat-error-text);
    background: var(--ngaf-chat-error-bg);
    border: 1px solid var(--ngaf-chat-error-border);
    border-radius: var(--ngaf-chat-radius-card);
    padding: 8px 12px;
    font-size: var(--ngaf-chat-font-size-sm);
  }
`;
