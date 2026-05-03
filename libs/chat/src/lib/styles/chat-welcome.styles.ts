// libs/chat/src/lib/styles/chat-welcome.styles.ts
// SPDX-License-Identifier: MIT
export const CHAT_WELCOME_STYLES = `
  :host {
    display: flex;
    flex: 1 1 auto;
    align-items: center;
    justify-content: center;
    width: 100%;
    min-height: 0;
    padding: var(--ngaf-chat-welcome-padding, 24px);
    box-sizing: border-box;
    animation: ngaf-chat-welcome-mount 200ms ease-out both;
  }
  .chat-welcome__inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--ngaf-chat-welcome-gap, 1.25rem);
    width: 100%;
    max-width: var(--ngaf-chat-welcome-max-width, 36rem);
    text-align: center;
  }
  .chat-welcome__beacon {
    display: inline-block;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: radial-gradient(circle at 30% 30%,
      var(--ngaf-chat-text) 0%,
      var(--ngaf-chat-text-muted) 70%,
      transparent 100%);
    animation: ngaf-chat-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    margin-bottom: 8px;
  }
  .chat-welcome__title {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 500;
    color: var(--ngaf-chat-text);
    line-height: 1.3;
  }
  @media (min-width: 768px) {
    .chat-welcome__title { font-size: 1.5rem; }
  }
  .chat-welcome__input {
    width: 100%;
    margin-top: 0.5rem;
  }
  .chat-welcome__suggestions {
    width: 100%;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
    margin-top: 4px;
  }
  .chat-welcome__suggestions:empty { display: none; }
`;

export const CHAT_WELCOME_SUGGESTION_STYLES = `
  :host { display: inline-block; }
  .chat-welcome-suggestion {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 10px 16px;
    background: var(--ngaf-chat-surface);
    border: 1px solid var(--ngaf-chat-separator);
    border-radius: 9999px;
    color: var(--ngaf-chat-text);
    font-family: inherit;
    font-size: var(--ngaf-chat-font-size-sm);
    text-align: center;
    cursor: pointer;
    transition: background 150ms ease, border-color 150ms ease, transform 120ms ease;
  }
  .chat-welcome-suggestion:hover {
    background: var(--ngaf-chat-surface-alt);
    border-color: var(--ngaf-chat-text-muted);
  }
  .chat-welcome-suggestion:active { transform: scale(0.98); }
  .chat-welcome-suggestion:focus-visible {
    outline: 2px solid var(--ngaf-chat-text-muted);
    outline-offset: 2px;
  }
  .chat-welcome-suggestion__label { white-space: nowrap; }
  .chat-welcome-suggestion__chevron { display: none; }
`;
