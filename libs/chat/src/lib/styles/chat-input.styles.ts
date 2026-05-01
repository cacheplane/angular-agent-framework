// libs/chat/src/lib/styles/chat-input.styles.ts
// SPDX-License-Identifier: MIT
export const CHAT_INPUT_STYLES = `
  :host { display: block; background: var(--ngaf-chat-bg); }
  .chat-input__container { padding: 0 0 15px 0; background: var(--ngaf-chat-bg); }
  .chat-input__pill {
    cursor: text;
    position: relative;
    background: var(--ngaf-chat-surface-alt);
    border: 1px solid var(--ngaf-chat-separator);
    border-radius: var(--ngaf-chat-radius-input);
    padding: 12px 14px;
    padding-right: 56px;
    min-height: 75px;
    margin: 0 auto;
    width: 95%;
    box-sizing: border-box;
    display: flex;
    align-items: flex-start;
    transition: border-color 200ms ease;
  }
  .chat-input__pill:focus-within { border-color: var(--ngaf-chat-text-muted); }
  .chat-input__textarea {
    flex: 1;
    outline: 0;
    border: 0;
    resize: none;
    background: transparent;
    color: var(--ngaf-chat-text);
    font-family: inherit;
    font-size: var(--ngaf-chat-font-size-sm);
    line-height: 1.5rem;
    width: 100%;
    margin: 0;
    padding: 0;
    field-sizing: content;
    min-height: 1.5rem;
    max-height: 9rem;
    overflow-y: auto;
  }
  .chat-input__textarea::placeholder { color: var(--ngaf-chat-text-muted); opacity: 1; }
  .chat-input__textarea::-webkit-scrollbar { width: 6px; }
  .chat-input__textarea::-webkit-scrollbar-thumb { background: var(--ngaf-chat-separator); border-radius: 10px; }
  .chat-input__controls {
    position: absolute;
    right: 14px;
    bottom: 12px;
    display: flex;
    gap: 3px;
  }
  .chat-input__send {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 0;
    background: var(--ngaf-chat-primary);
    color: var(--ngaf-chat-on-primary);
    border-radius: var(--ngaf-chat-radius-button);
    cursor: pointer;
    transition: transform 200ms ease, background 200ms ease;
  }
  .chat-input__send:hover:not(:disabled) { transform: scale(1.05); }
  .chat-input__send:disabled { background: var(--ngaf-chat-muted); color: var(--ngaf-chat-on-primary); cursor: not-allowed; }
  .chat-input__send svg { width: 16px; height: 16px; }
`;
