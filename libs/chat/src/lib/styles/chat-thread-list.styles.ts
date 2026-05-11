// SPDX-License-Identifier: MIT
export const CHAT_THREAD_LIST_STYLES = `
  :host { display: block; padding: var(--ngaf-chat-space-2); }
  .chat-thread-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 2px; }
  .chat-thread-list__item {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-height: 36px;
    padding: 8px 12px;
    border-radius: var(--ngaf-chat-radius-button);
    cursor: pointer;
    color: var(--ngaf-chat-text);
    font-size: var(--ngaf-chat-font-size-sm);
    background: transparent;
    border: 0;
    text-align: left;
    width: 100%;
    box-sizing: border-box;
    transition: background-color 150ms ease;
  }
  .chat-thread-list__item:hover { background: color-mix(in srgb, var(--ngaf-chat-text) 5%, transparent); }
  .chat-thread-list__item[data-active="true"] {
    background: var(--ngaf-chat-surface-alt);
    font-weight: 500;
    box-shadow: inset 2px 0 0 var(--a2ui-primary, var(--ngaf-chat-primary));
  }
  .chat-thread-list__item-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    display: block;
  }
  .chat-thread-list__item-time {
    font-size: 11px;
    color: var(--ngaf-chat-text-muted);
    display: block;
  }
  .chat-thread-list__new {
    display: block;
    width: 100%;
    height: 36px;
    margin-bottom: var(--ngaf-chat-space-2);
    border: 1px dashed var(--ngaf-chat-separator);
    border-radius: var(--ngaf-chat-radius-button);
    background: transparent;
    color: var(--ngaf-chat-primary);
    cursor: pointer;
    font-size: var(--ngaf-chat-font-size-sm);
    box-sizing: border-box;
    transition: background 150ms ease;
  }
  .chat-thread-list__new:hover { background: var(--ngaf-chat-surface-alt); }
`;
