// libs/chat/src/lib/styles/chat-window.styles.ts
// SPDX-License-Identifier: MIT
export const CHAT_WINDOW_STYLES = `
  :host {
    display: flex;
    flex-direction: column;
    min-height: 0;
    height: 100%;
    background: var(--ngaf-chat-bg);
    color: var(--ngaf-chat-text);
  }
  .chat-window__header {
    height: 56px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 var(--ngaf-chat-space-6);
    border-bottom: 1px solid var(--ngaf-chat-separator);
    font-weight: 500;
    color: var(--ngaf-chat-primary);
  }
  .chat-window__header:empty { display: none; }
  .chat-window__body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .chat-window__footer {
    flex-shrink: 0;
  }
  .chat-window__footer:empty { display: none; }
`;
