// libs/chat/src/lib/styles/chat-confirm-dialog.styles.ts
// SPDX-License-Identifier: MIT
export const CHAT_CONFIRM_DIALOG_STYLES = `
  :host { display: contents; }
  .chat-confirm-dialog__scrim {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 70;
    border: 0;
    padding: 0;
    cursor: pointer;
  }
  .chat-confirm-dialog {
    position: fixed;
    top: 30vh;
    left: 50%;
    transform: translateX(-50%);
    width: min(420px, 90vw);
    z-index: 71;
    padding: 20px;
    background: var(--ngaf-chat-bg);
    border: 1px solid var(--ngaf-chat-separator);
    border-radius: 12px;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.25);
  }
  .chat-confirm-dialog__title {
    margin: 0 0 8px 0;
    color: var(--ngaf-chat-text);
    font-size: 1.125rem;
    font-weight: 600;
  }
  .chat-confirm-dialog__body {
    margin: 0 0 16px 0;
    color: var(--ngaf-chat-text-muted);
    font-size: var(--ngaf-chat-font-size-sm);
    line-height: 1.5;
  }
  .chat-confirm-dialog__actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
  .chat-confirm-dialog__cancel,
  .chat-confirm-dialog__confirm {
    padding: 8px 16px;
    border-radius: 6px;
    font: inherit;
    font-size: var(--ngaf-chat-font-size-sm);
    cursor: pointer;
    border: 1px solid var(--ngaf-chat-separator);
    background: var(--ngaf-chat-bg);
    color: var(--ngaf-chat-text);
  }
  .chat-confirm-dialog__cancel:hover { background: var(--ngaf-chat-surface-alt); }
  .chat-confirm-dialog__confirm {
    background: var(--ngaf-chat-text);
    color: var(--ngaf-chat-bg);
    border-color: transparent;
  }
  .chat-confirm-dialog__confirm--destructive {
    background: var(--ngaf-chat-error-text);
    color: #fff;
  }
  .chat-confirm-dialog__cancel:focus-visible,
  .chat-confirm-dialog__confirm:focus-visible {
    outline: 2px solid var(--ngaf-chat-primary);
    outline-offset: 2px;
  }
`;
