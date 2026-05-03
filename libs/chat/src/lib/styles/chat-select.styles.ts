// libs/chat/src/lib/styles/chat-select.styles.ts
// SPDX-License-Identifier: MIT
export const CHAT_SELECT_STYLES = `
  :host {
    display: inline-block;
    position: relative;
  }
  .chat-select__trigger {
    height: 32px;
    padding: 0 10px;
    border: 0;
    border-radius: 9999px;
    background: transparent;
    color: var(--ngaf-chat-text-muted);
    font: inherit;
    font-size: var(--ngaf-chat-font-size-sm);
    display: inline-flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
    transition: background 120ms ease, color 120ms ease;
  }
  .chat-select__trigger:hover:not(:disabled) {
    background: var(--ngaf-chat-surface-alt);
    color: var(--ngaf-chat-text);
  }
  .chat-select__trigger:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .chat-select__chevron {
    width: 12px;
    height: 12px;
    transition: transform 120ms ease;
    flex: none;
  }
  .chat-select__trigger.is-open .chat-select__chevron {
    transform: rotate(180deg);
  }
  .chat-select__menu {
    position: absolute;
    bottom: calc(100% + 8px);
    right: 0;
    min-width: 180px;
    max-height: 320px;
    overflow-y: auto;
    background: var(--ngaf-chat-surface);
    border: 1px solid var(--ngaf-chat-separator);
    border-radius: 12px;
    box-shadow: var(--ngaf-chat-shadow-lg);
    padding: 4px;
    z-index: 10;
  }
  .chat-select__option {
    display: block;
    width: 100%;
    text-align: left;
    border: 0;
    background: transparent;
    padding: 8px 10px;
    border-radius: 8px;
    color: var(--ngaf-chat-text);
    font: inherit;
    font-size: var(--ngaf-chat-font-size-sm);
    cursor: pointer;
  }
  .chat-select__option:hover:not(:disabled),
  .chat-select__option:focus-visible {
    background: var(--ngaf-chat-surface-alt);
    outline: none;
  }
  .chat-select__option.is-active {
    background: var(--ngaf-chat-surface-alt);
    font-weight: 500;
  }
  .chat-select__option:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;
