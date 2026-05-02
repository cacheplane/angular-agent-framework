// libs/chat/src/lib/styles/chat-message-actions.styles.ts
// SPDX-License-Identifier: MIT
//
// Action-button row underneath assistant messages. Mirrors copilotkit's
// AssistantMessage controls — hidden by default, fades in on hover/focus
// of the parent chat-message, always visible on mobile.
export const CHAT_MESSAGE_ACTIONS_STYLES = `
  :host {
    display: flex;
    gap: 0.5rem;
    padding: 4px 0 0 0;
    opacity: 0;
    transition: opacity 200ms ease;
    pointer-events: none;
  }
  :host-context(chat-message[data-role="assistant"]:hover),
  :host-context(chat-message[data-role="assistant"]:focus-within),
  :host-context(chat-message[data-role="assistant"][data-current="true"]) {
    opacity: 1;
    pointer-events: auto;
  }
  :host-context(chat-message[data-streaming="true"]) {
    /* Hide while the message is actively streaming — copilotkit pattern. */
    opacity: 0 !important;
    pointer-events: none !important;
  }
  @media (max-width: 768px) {
    :host-context(chat-message[data-role="assistant"]) {
      opacity: 1;
      pointer-events: auto;
    }
  }
  .chat-message-actions__btn {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 0;
    padding: 0;
    margin: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--ngaf-chat-text-muted);
    cursor: pointer;
    transition: color 150ms ease, transform 150ms ease, background 150ms ease;
  }
  .chat-message-actions__btn:hover {
    color: var(--ngaf-chat-text);
    transform: scale(1.05);
    background: var(--ngaf-chat-surface-alt);
  }
  .chat-message-actions__btn:focus-visible {
    outline: 2px solid var(--ngaf-chat-text-muted);
    outline-offset: 2px;
  }
  .chat-message-actions__btn.is-active {
    color: var(--ngaf-chat-text);
    background: var(--ngaf-chat-surface-alt);
  }
  .chat-message-actions__btn svg {
    width: 16px;
    height: 16px;
    pointer-events: none;
  }
  .chat-message-actions__check {
    font-size: 14px;
    font-weight: 700;
    line-height: 1;
    color: var(--ngaf-chat-success, #16a34a);
  }
`;
