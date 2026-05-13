// libs/chat/src/lib/styles/chat-project-list.styles.ts
// SPDX-License-Identifier: MIT
export const CHAT_PROJECT_LIST_STYLES = `
  :host { display: block; padding: var(--ngaf-chat-space-2); }
  .chat-project-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 2px; }
  .chat-project-list__item-wrap {
    position: relative;
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .chat-project-list__item {
    flex: 1 1 auto;
    min-width: 0;
    min-height: 32px;
    padding: 6px 12px;
    border-radius: var(--ngaf-chat-radius-button);
    cursor: pointer;
    color: var(--ngaf-chat-text);
    font-size: var(--ngaf-chat-font-size-sm);
    background: transparent;
    border: 0;
    text-align: left;
    box-sizing: border-box;
    transition: background-color 150ms ease;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .chat-project-list__item:hover { background: color-mix(in srgb, var(--ngaf-chat-text) 5%, transparent); }
  .chat-project-list__item[data-active="true"] {
    background: var(--ngaf-chat-surface-alt);
    font-weight: 500;
    box-shadow: inset 2px 0 0 var(--a2ui-primary, var(--ngaf-chat-primary));
  }
  .chat-project-list__kebab {
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    border: 0;
    background: transparent;
    color: var(--ngaf-chat-text-muted);
    border-radius: 4px;
    cursor: pointer;
    opacity: 0;
    transition: opacity 100ms ease;
    padding: 0;
    line-height: 1;
    font-size: 18px;
  }
  .chat-project-list__item-wrap:hover .chat-project-list__kebab,
  .chat-project-list__item-wrap:focus-within .chat-project-list__kebab {
    opacity: 1;
  }
  .chat-project-list__kebab:hover {
    background: var(--ngaf-chat-surface-alt);
    color: var(--ngaf-chat-text);
  }
  .chat-project-list__kebab:focus-visible {
    opacity: 1;
    outline: 2px solid var(--ngaf-chat-primary);
    outline-offset: 2px;
  }
  .chat-project-list__edit {
    flex: 1 1 auto;
    border: 1px solid var(--ngaf-chat-primary);
    border-radius: var(--ngaf-chat-radius-button);
    background: var(--ngaf-chat-bg);
    color: var(--ngaf-chat-text);
    font: inherit;
    font-size: var(--ngaf-chat-font-size-sm);
    padding: 6px 10px;
    min-height: 32px;
    outline: none;
    box-sizing: border-box;
  }
  .chat-project-list__new {
    display: block;
    width: 100%;
    height: 32px;
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
  .chat-project-list__new:hover { background: var(--ngaf-chat-surface-alt); }
`;
