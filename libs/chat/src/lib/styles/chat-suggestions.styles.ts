// SPDX-License-Identifier: MIT
export const CHAT_SUGGESTIONS_STYLES = `
  :host { display: block; }
  .chat-suggestions { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
  .chat-suggestion {
    padding: 6px 10px;
    font-size: var(--ngaf-chat-font-size-xs);
    border-radius: var(--ngaf-chat-radius-bubble);
    border: 1px solid var(--ngaf-chat-muted);
    background: transparent;
    color: var(--ngaf-chat-text);
    cursor: pointer;
    transition: transform 200ms ease;
  }
  .chat-suggestion:hover { transform: scale(1.03); }
  .chat-suggestion:disabled { cursor: wait; opacity: 0.6; }
`;
